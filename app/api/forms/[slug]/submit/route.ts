// POST /api/forms/[slug]/submit
//
// Public endpoint — anyone can submit. Translates a form submission into
// a `records` row in the form's underlying table.
//
// Flow:
//   1. Resolve form by slug (must be published)
//   2. Fetch the form's table + fields to validate the payload
//   3. Map answers (keyed by field_id) to the record's `data` jsonb
//   4. INSERT into records with source='public_form'
//   5. Bump form stats (total_submissions/completed)
//   6. Send email notifications to form.notification_emails
//   7. Return { record_id, ok: true }
//
// Anti-abuse:
//   - We don't enforce required fields here strictly — instead, we accept
//     partial submissions and rely on the client to enforce. (The form owner
//     can always see which fields are missing in the dashboard.)
//   - We DO cap string values at 5000 chars and reject huge payloads.
//   - IP + UA captured for analytics; no rate limiting at this layer (Vercel
//     edge handles DDoS).

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { FormRow } from '@/lib/forms/types';
import { isPublicSafeFieldType } from '@/lib/forms/types';

const MAX_STRING_LEN = 5000;
const MAX_FIELDS = 200; // sanity cap on number of fields per submission

type Field = {
  id: string;
  name: string;
  slug: string;
  type: string;
  is_required: boolean;
  config: any;
};

function getClientIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}

/**
 * Coerce an answer value into something we want to persist for a given field.
 * Returns null if the value should be omitted (empty, malformed).
 */
function coerceValue(rawValue: any, type: string): any {
  if (rawValue === null || rawValue === undefined || rawValue === '') return null;

  switch (type) {
    case 'number':
    case 'currency': {
      const n = Number(rawValue);
      return Number.isFinite(n) ? n : null;
    }
    case 'checkbox':
      return Boolean(rawValue);
    case 'rating': {
      const n = Number(rawValue);
      return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
    }
    case 'multiselect':
      if (!Array.isArray(rawValue)) return null;
      return rawValue
        .map((v) => (typeof v === 'string' ? v.slice(0, MAX_STRING_LEN) : String(v)))
        .filter(Boolean);
    case 'text':
    case 'longtext':
    case 'phone':
    case 'email':
    case 'url':
    case 'date':
    case 'datetime':
    case 'select':
    case 'status':
    case 'city':
    default:
      return String(rawValue).slice(0, MAX_STRING_LEN);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const admin = createAdminClient();

  // ---- 1. Resolve form ----
  const { data: formData } = await admin
    .from('forms')
    .select('*')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .maybeSingle();

  if (!formData) {
    return NextResponse.json({ error: 'form_not_found' }, { status: 404 });
  }
  const form = formData as FormRow;

  // ---- 2. Fetch table fields ----
  const { data: rawFields, error: fieldsErr } = await admin
    .from('fields')
    .select('id, name, slug, type, is_required, config')
    .eq('table_id', form.table_id);

  if (fieldsErr || !rawFields) {
    return NextResponse.json(
      { error: 'fields_load_failed' },
      { status: 500 },
    );
  }
  const fields = rawFields as Field[];
  const fieldById = new Map<string, Field>(fields.map((f) => [f.id, f]));

  // ---- 3. Validate answers ----
  const answers = body.answers;
  if (!answers || typeof answers !== 'object') {
    return NextResponse.json({ error: 'missing_answers' }, { status: 400 });
  }
  const answerEntries = Object.entries(answers);
  if (answerEntries.length > MAX_FIELDS) {
    return NextResponse.json({ error: 'too_many_fields' }, { status: 413 });
  }

  // ---- 4. Build the record's `data` payload ----
  // Note: `records.data` is keyed by field_id (uuids), matching the rest of TaskFlow.
  const recordData: Record<string, any> = {};
  for (const [fieldId, rawValue] of answerEntries) {
    const field = fieldById.get(fieldId);
    if (!field) continue; // Skip unknown fields silently
    if (!isPublicSafeFieldType(field.type)) continue;

    // Skip fields that aren't exposed by this form
    const settings = form.field_settings[fieldId];
    if (settings && settings.visible === false) continue;

    const coerced = coerceValue(rawValue, field.type);
    if (coerced !== null && coerced !== undefined && coerced !== '') {
      recordData[fieldId] = coerced;
    }
  }

  // Add contact info if provided. We store them as keys with __form_ prefix
  // so they don't collide with field IDs. The dashboard's submission view can
  // surface these specially.
  const contactPhone = typeof body.contact_phone === 'string' ? body.contact_phone.slice(0, 50) : null;
  const contactEmail = typeof body.contact_email === 'string' ? body.contact_email.slice(0, 200) : null;
  const contactName = typeof body.contact_name === 'string' ? body.contact_name.slice(0, 200) : null;

  // Build the insert row. We use source_phone for the contact phone so existing
  // TaskFlow features (CRM conversion, inbox routing) automatically work.
  const insertRow: Record<string, any> = {
    table_id: form.table_id,
    workspace_id: form.workspace_id,
    data: recordData,
    source: 'public_form',
    source_phone: contactPhone,
    notes: [
      contactName ? `Contact: ${contactName}` : null,
      contactEmail ? `Email: ${contactEmail}` : null,
      body.utm_source ? `UTM source: ${body.utm_source}` : null,
      body.utm_medium ? `UTM medium: ${body.utm_medium}` : null,
      body.utm_campaign ? `UTM campaign: ${body.utm_campaign}` : null,
      `Form: ${form.slug}`,
    ]
      .filter(Boolean)
      .join('\n'),
  };

  // ---- 5. INSERT record ----
  const { data: record, error: insertErr } = await admin
    .from('records')
    .insert(insertRow as any)
    .select('id')
    .single();

  if (insertErr) {
    console.error('[forms/submit] insert failed:', insertErr);
    return NextResponse.json(
      { error: 'db_failed', message: insertErr.message },
      { status: 500 },
    );
  }

  // ---- 6. Bump form stats ----
  await admin
    .from('forms')
    .update({
      total_submissions: form.total_submissions + 1,
      total_completed: form.total_completed + 1,
      last_submission_at: new Date().toISOString(),
    })
    .eq('id', form.id);

  // ---- 7. Fire-and-forget notifications ----
  if (form.notification_emails && form.notification_emails.length > 0) {
    sendNotificationEmails(form, record.id, contactName, contactPhone, contactEmail).catch(
      (e) => console.error('[forms/submit] notification failed:', e),
    );
  }

  return NextResponse.json({ record_id: record.id, ok: true });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

async function sendNotificationEmails(
  form: FormRow,
  recordId: string,
  contactName: string | null,
  contactPhone: string | null,
  contactEmail: string | null,
) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[forms/submit] RESEND_API_KEY not set, skipping notification');
    return;
  }

  const subject = `📝 הגשה חדשה: ${form.title}`;
  const adminUrl = `https://taskflow-ai.com/dashboard/forms/${form.id}/submissions/${recordId}`;
  const safe = (v: any): string => {
    if (v === null || v === undefined || v === '') return '—';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);color:white;padding:24px;">
      <div style="font-size:14px;opacity:0.9;">📝 הגשה חדשה</div>
      <div style="font-size:20px;font-weight:bold;margin-top:4px;">${safe(form.title)}</div>
    </div>
    <div style="padding:20px;font-size:14px;line-height:1.6;color:#1f2937;">
      <table style="width:100%;">
        <tr><td style="color:#6b7280;width:80px;">שם:</td><td>${safe(contactName)}</td></tr>
        <tr><td style="color:#6b7280;">טלפון:</td><td>${safe(contactPhone)}</td></tr>
        <tr><td style="color:#6b7280;">אימייל:</td><td>${contactEmail ? `<a href="mailto:${safe(contactEmail)}">${safe(contactEmail)}</a>` : '—'}</td></tr>
      </table>
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;">
        <a href="${adminUrl}" style="display:inline-block;background:#7c3aed;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold;">
          פתח בדשבורד ←
        </a>
      </div>
    </div>
  </div>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TaskFlow Forms <noreply@taskflow-ai.com>',
      to: form.notification_emails,
      reply_to: contactEmail || undefined,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text.slice(0, 200)}`);
  }
}
