import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppText } from '@/lib/reports/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public booking API — no authentication required.
 *
 * GET  /api/bookings/[slug]?date=YYYY-MM-DD
 *   - Without `date`: returns page metadata only (title, description, working_hours,
 *     duration, form_fields, etc) + the list of dates available in the booking window.
 *   - With `date`: returns the available time slots for that specific day,
 *     subtracting any existing records on the bound table.
 *
 * POST /api/bookings/[slug]
 *   Body: { selected_at: ISO datetime, form_data: { name, phone, ... } }
 *   Creates a record in the bound table with the slot + form data merged according
 *   to the page's field_mapping. The existing workflows on the table fire normally.
 *
 * IMPORTANT: This route uses the admin client (service role) because:
 *   1. The /book/{slug} page is unauthenticated (anon visitors).
 *   2. Creating a record requires bypassing RLS on `records`.
 * Security is enforced via the slug being unguessable + the page's `enabled` flag.
 */

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ============================================================================
// GET — page info + available slots
// ============================================================================
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const db = admin();

  const { data: page, error } = await db
    .from('booking_pages')
    .select('*')
    .eq('slug', params.slug)
    .eq('enabled', true)
    .maybeSingle();

  if (error || !page) {
    return NextResponse.json({ error: 'booking page not found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get('date');

  if (!dateParam) {
    // Increment view count (fire-and-forget, ignore errors)
    db.from('booking_pages').update({ view_count: (page.view_count || 0) + 1 }).eq('id', page.id).then(() => {});

    // Return only public-safe metadata
    return NextResponse.json({
      page: publicPageView(page),
      available_dates: computeAvailableDates(page),
    });
  }

  // Date-specific: compute available slots
  const slots = await computeSlotsForDate(db, page, dateParam);
  return NextResponse.json({ slots });
}

// ============================================================================
// POST — create a booking
// ============================================================================
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const db = admin();

  const { data: page } = await db
    .from('booking_pages')
    .select('*')
    .eq('slug', params.slug)
    .eq('enabled', true)
    .maybeSingle();

  if (!page) {
    return NextResponse.json({ error: 'booking page not found' }, { status: 404 });
  }

  const body = await req.json();
  const selectedAt: string = body.selected_at;
  const formData: Record<string, any> = body.form_data || {};

  if (!selectedAt) {
    return NextResponse.json({ error: 'selected_at required' }, { status: 400 });
  }

  // Validate the selected slot is still available (race condition guard)
  const slotDate = new Date(selectedAt);
  if (isNaN(slotDate.getTime())) {
    return NextResponse.json({ error: 'invalid selected_at' }, { status: 400 });
  }

  const dateStr = isoDateInIsrael(slotDate);
  const availableSlots = await computeSlotsForDate(db, page, dateStr);
  const slotIsoMin = slotDate.toISOString().slice(0, 16); // ignore seconds

  if (!availableSlots.some((s: any) => s.iso.slice(0, 16) === slotIsoMin)) {
    return NextResponse.json({ error: 'slot no longer available' }, { status: 409 });
  }

  // Validate required form fields
  const formFields = (page.form_fields || []) as Array<{ key: string; label: string; required: boolean }>;
  for (const f of formFields) {
    if (f.required && !String(formData[f.key] || '').trim()) {
      return NextResponse.json({ error: `field "${f.label}" is required` }, { status: 400 });
    }
  }

  // Build the record data based on field_mapping
  const mapping = (page.field_mapping || {}) as Record<string, string>;
  const recordData: Record<string, any> = {};

  // Required: datetime field
  const dtFieldSlug = mapping.datetime_field_slug;
  if (!dtFieldSlug) {
    return NextResponse.json({ error: 'booking page misconfigured: no datetime_field_slug' }, { status: 500 });
  }
  recordData[dtFieldSlug] = selectedAt;

  // Map form fields
  if (mapping.name_field_slug && formData.name) recordData[mapping.name_field_slug] = String(formData.name).trim();
  if (mapping.phone_field_slug && formData.phone) recordData[mapping.phone_field_slug] = normalizePhone(String(formData.phone));
  if (mapping.email_field_slug && formData.email) recordData[mapping.email_field_slug] = String(formData.email).trim();
  if (mapping.notes_field_slug && formData.notes) recordData[mapping.notes_field_slug] = String(formData.notes).trim();

  // Title field: use mapping if provided, else generate
  if (mapping.title_field_slug) {
    recordData[mapping.title_field_slug] =
      `${page.title}${formData.name ? ` — ${formData.name}` : ''}`;
  }

  // Insert record (admin client bypasses RLS)
  const { data: newRecord, error: insertErr } = await db
    .from('records')
    .insert({
      table_id: page.table_id,
      workspace_id: page.workspace_id,
      data: recordData,
      source: 'booking_page',
      conversion_links: {
        booking_page_id: page.id,
        booking_page_slug: page.slug,
        booked_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single();

  if (insertErr) {
    return NextResponse.json({ error: 'failed to create record: ' + insertErr.message }, { status: 500 });
  }

  // Increment booking count
  db.from('booking_pages').update({ booking_count: (page.booking_count || 0) + 1 }).eq('id', page.id).then(() => {});

  return NextResponse.json({
    success: true,
    record_id: newRecord.id,
    confirmation_message: page.confirmation_message,
  }, { status: 201 });
}

// ============================================================================
// Slot computation
// ============================================================================
function publicPageView(page: any) {
  // Don't expose internal IDs / mapping config to the public
  return {
    slug: page.slug,
    title: page.title,
    description: page.description,
    duration_minutes: page.duration_minutes,
    form_fields: page.form_fields,
    confirmation_message: page.confirmation_message,
  };
}

function computeAvailableDates(page: any): string[] {
  const out: string[] = [];
  const today = new Date();
  const wh = page.working_hours as Array<{ enabled: boolean; start: string; end: string }>;

  for (let i = 0; i <= page.advance_notice_days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    const settings = wh[dow];
    if (settings?.enabled) {
      out.push(isoDateInIsrael(d));
    }
  }
  return out;
}

async function computeSlotsForDate(db: any, page: any, dateStr: string): Promise<any[]> {
  // Parse the date as Israel-local midnight
  const [y, m, dd] = dateStr.split('-').map(Number);
  const dayStart = new Date(Date.UTC(y, m - 1, dd, 0, 0, 0));

  // Determine day-of-week & working hours (Israel-local)
  const israelDate = new Date(dayStart.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const dow = israelDate.getDay();
  const wh = (page.working_hours as any[])[dow];
  if (!wh?.enabled) return [];

  // Build candidate slots from start to end every duration_minutes (+ buffer)
  const [startH, startM] = wh.start.split(':').map(Number);
  const [endH, endM] = wh.end.split(':').map(Number);
  const stepMinutes = page.duration_minutes + (page.buffer_minutes || 0);

  const candidates: { iso: string; label: string }[] = [];
  let cursor = startH * 60 + startM;
  const endMins = endH * 60 + endM;

  while (cursor + page.duration_minutes <= endMins) {
    // This is in Israel-local minutes; convert to a UTC ISO timestamp.
    // We treat dateStr as a date in Israel, and the cursor as the local hour/minute.
    const slotIso = israelLocalToUtcIso(dateStr, Math.floor(cursor / 60), cursor % 60);
    candidates.push({
      iso: slotIso,
      label: `${pad(Math.floor(cursor / 60))}:${pad(cursor % 60)}`,
    });
    cursor += stepMinutes;
  }

  // Filter out slots in the past or within the min_lead_time window
  const now = new Date();
  const minLeadMs = (page.min_lead_time_hours || 0) * 3600 * 1000;
  const earliestAllowed = now.getTime() + minLeadMs;
  const futureCandidates = candidates.filter((s) => new Date(s.iso).getTime() >= earliestAllowed);

  if (futureCandidates.length === 0) return [];

  // Subtract existing bookings: any record on this table whose datetime field
  // falls within an interval that overlaps a candidate slot.
  const mapping = (page.field_mapping || {}) as Record<string, string>;
  const dtSlug = mapping.datetime_field_slug;
  if (!dtSlug) return futureCandidates;

  const dayStartUtc = futureCandidates[0].iso;
  const dayEndUtc = new Date(new Date(futureCandidates[futureCandidates.length - 1].iso).getTime() + page.duration_minutes * 60_000).toISOString();

  // Postgres JSONB query: data->>{slug} BETWEEN dayStart AND dayEnd
  const { data: existing } = await db
    .from('records')
    .select('data')
    .eq('table_id', page.table_id)
    .gte(`data->>${dtSlug}`, dayStartUtc)
    .lte(`data->>${dtSlug}`, dayEndUtc);

  const taken = new Set<number>();
  for (const r of existing || []) {
    const t = r.data?.[dtSlug];
    if (!t) continue;
    const start = new Date(t).getTime();
    if (isNaN(start)) continue;
    const end = start + page.duration_minutes * 60_000;
    // Mark every minute in [start, end) as taken so any candidate overlapping it is filtered out
    for (let ms = start; ms < end; ms += 60_000) {
      taken.add(Math.floor(ms / 60_000));
    }
  }

  return futureCandidates.filter((s) => {
    const slotMs = new Date(s.iso).getTime();
    const slotEnd = slotMs + page.duration_minutes * 60_000;
    for (let ms = slotMs; ms < slotEnd; ms += 60_000) {
      if (taken.has(Math.floor(ms / 60_000))) return false;
    }
    return true;
  });
}

// ─── Time helpers ───────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, '0'); }

function isoDateInIsrael(d: Date): string {
  const il = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  return `${il.getFullYear()}-${pad(il.getMonth() + 1)}-${pad(il.getDate())}`;
}

/**
 * Convert "Israel-local date + hour + minute" to a UTC ISO string.
 * Uses Intl.DateTimeFormat to compute the exact UTC offset for that specific
 * date (which handles DST transitions correctly — Israel observes DST).
 */
function israelLocalToUtcIso(dateStr: string, hour: number, minute: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);

  // Build the wall-clock time as if it were UTC, then figure out by how much
  // Israel time differs from UTC at that moment, and shift accordingly.
  const naiveUtcMs = Date.UTC(y, m - 1, d, hour, minute);
  const naiveDate = new Date(naiveUtcMs);

  // What's Israel time when wall-clock is naiveUtcMs?
  const ilFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = ilFmt.formatToParts(naiveDate);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const ilUtcMs = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  const offsetMs = ilUtcMs - naiveUtcMs; // positive = Israel ahead of UTC

  return new Date(naiveUtcMs - offsetMs).toISOString();
}

function normalizePhone(s: string): string {
  // Remove all non-digit chars, then format as Israeli international if it looks local
  const digits = s.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length === 10) {
    return '972' + digits.slice(1);
  }
  if (digits.startsWith('972')) return digits;
  return digits;
}
