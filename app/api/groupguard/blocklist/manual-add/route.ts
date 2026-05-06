import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/groupguard/blocklist/manual-add
 *
 * Body: { workspace_id, phone, reason?, notes? }
 *
 * Manually flags a phone as a confirmed spammer and writes it into the
 * global blocklist (gg_global_blocklist). After this, any incoming message
 * from that phone will be auto-kicked by lib/groupguard/detection-pipeline
 * checkGlobalBlocklist() — same code path that auto-detected spammers go
 * through, just with a human telling us instead of the AI / report-threshold
 * system.
 *
 * Behavior:
 *   - First time the phone is added → insert with report_count=1,
 *     is_confirmed=true (manual add IS a confirmation), unique_workspaces=1.
 *   - Already in blocklist → bump report_count, last_reported_at,
 *     ensure is_confirmed=true, and prepend the new note to notes.
 *
 * Note on scope: this writes to the GLOBAL blocklist on purpose. The
 * existing detection-pipeline only reads gg_global_blocklist, not anything
 * per-workspace. If we wanted workspace-scoped blocking we'd need a new
 * table — that's a bigger architectural change. For now, manual additions
 * are global, same as auto-detected spammers.
 *
 * Membership check: any workspace member can add (same level as triggering
 * a manual report). Owner/admin restriction would be too tight — group
 * admins should be able to flag spammers they see, even without owner
 * permissions.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    workspace_id?: string;
    phone?: string;
    reason?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!body.workspace_id || !body.phone) {
    return NextResponse.json(
      { error: 'workspace_id and phone are required' },
      { status: 400 },
    );
  }

  // Normalize phone — strip non-digits, drop @c.us suffix if user pasted it
  const phone = String(body.phone)
    .replace(/@.*$/, '')
    .replace(/\D/g, '');

  if (phone.length < 8 || phone.length > 15) {
    // E.164 phone numbers are 8-15 digits. Anything outside that range is
    // almost certainly a typo (or someone trying to inject something weird).
    return NextResponse.json(
      { error: 'מספר טלפון לא תקין (חייב להיות 8–15 ספרות)' },
      { status: 400 },
    );
  }

  // Membership check
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', body.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Build the note line — combines reason + notes + reporter context. Stored
  // as plain text; the existing UI displays this verbatim, so giving it a
  // consistent format makes the audit trail readable.
  const noteParts: string[] = [];
  if (body.reason) noteParts.push(`סיבה: ${body.reason}`);
  if (body.notes) noteParts.push(body.notes);
  noteParts.push(`(נוסף ידנית ע"י משתמש ${user.email || user.id})`);
  const newNote = noteParts.join(' | ');

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Check if the phone already exists. We can't use a single upsert here
  // because we need to read existing notes/report_count to merge them
  // correctly — Postgres doesn't have a clean "append to text" upsert
  // expression in PostgREST.
  const { data: existing } = await admin
    .from('gg_global_blocklist')
    .select('id, report_count, notes, is_confirmed, added_manually_at')
    .eq('phone', phone)
    .maybeSingle();

  const nowIso = new Date().toISOString();

  if (existing) {
    // Bump the counter, reaffirm confirmation, prepend the new note. Also
    // mark this entry as manually-added (even if it was originally
    // auto-detected — a manual confirmation by a workspace member is a
    // stronger signal than the auto-detection alone). We keep the email
    // snapshot of the latest manual adder; first manual_at is preserved
    // if already set.
    const mergedNotes = existing.notes
      ? `${newNote}\n${existing.notes}`
      : newNote;

    const { error: updateErr } = await admin
      .from('gg_global_blocklist')
      .update({
        report_count: (existing.report_count || 0) + 1,
        last_reported_at: nowIso,
        is_confirmed: true,
        notes: mergedNotes,
        reason_summary: body.reason || null,
        added_manually: true,
        added_manually_by: user.id,
        added_manually_by_email: user.email || null,
        // If never set before, stamp now. If already set (someone else
        // added manually previously), keep the older timestamp.
        ...(existing.added_manually_at ? {} : { added_manually_at: nowIso }),
        updated_at: nowIso,
      })
      .eq('id', existing.id);

    if (updateErr) {
      console.error('[blocklist/manual-add] update failed:', updateErr);
      return NextResponse.json(
        { error: 'database update failed' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      action: 'updated',
      phone,
      report_count: (existing.report_count || 0) + 1,
      message:
        'המספר היה כבר במאגר — עודכן לפי הסיבה החדשה ונספר דיווח נוסף.',
    });
  }

  // First-time insert
  const { error: insertErr } = await admin.from('gg_global_blocklist').insert({
    phone,
    first_reported_at: nowIso,
    last_reported_at: nowIso,
    report_count: 1,
    unique_groups_count: 0, // manual adds don't have a group context
    unique_workspaces_count: 1,
    reason_summary: body.reason || null,
    is_confirmed: true,
    confirmed_at: nowIso,
    notes: newNote,
    added_manually: true,
    added_manually_by: user.id,
    added_manually_by_email: user.email || null,
    added_manually_at: nowIso,
  });

  if (insertErr) {
    console.error('[blocklist/manual-add] insert failed:', insertErr);
    return NextResponse.json(
      { error: 'database insert failed' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    action: 'inserted',
    phone,
    report_count: 1,
    message:
      'המספר נוסף למאגר הספאמרים. כל הודעה נכנסת ממנו תזוהה אוטומטית.',
  });
}
