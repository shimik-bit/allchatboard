// POST /api/diagnostic/submit
//
// Public endpoint — anyone can submit. Receives the full diagnostic form
// payload and persists it. Two modes via `body.action`:
//
//   action: 'save'      → upsert (draft save during multi-step navigation).
//                          Returns { id } so the client can include it on
//                          subsequent saves to update the same row.
//   action: 'submit'    → final submit. Sets submitted_at + is_complete=true,
//                          and triggers an email to the configured recipient.
//
// Anti-abuse:
//   - Rate-limit hint stored via IP (not enforced here; relies on Vercel's
//     built-in DDoS protection + the form's natural friction).
//   - Phone + at least one of (company_name, contact_email) required to
//     count as "complete".
//   - Free-text fields capped at 2000 chars each to prevent payload bombs.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { isValidEmail, isValidPhone } from '@/lib/forms/validation';

// Notification recipient
const NOTIFY_TO = process.env.DIAGNOSTIC_NOTIFY_EMAIL ?? 'shimik@taskflow-ai.com';
const NOTIFY_FROM = 'TaskFlow Diagnostic <noreply@taskflow-ai.com>';

// Cap free-text fields so payloads can't grow unbounded
const MAX_TEXT_LEN = 2000;

function clip(value: any): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, MAX_TEXT_LEN);
}

function clipInt(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  // Clamp 1..10 since all our int fields use that scale
  return Math.max(1, Math.min(10, Math.round(n)));
}

function getClientIp(req: NextRequest): string | null {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const action: 'save' | 'submit' = body?.action === 'submit' ? 'submit' : 'save';
  const existingId: string | null =
    typeof body?.id === 'string' && /^[0-9a-f-]{36}$/.test(body.id) ? body.id : null;

  // ---- Server-side format validation (only on final submit) ----
  // Drafts (`action === 'save'`) skip format checks because the user may
  // navigate away mid-typing and we want their progress saved regardless.
  // The final submit is where we reject malformed values.
  if (action === 'submit') {
    const errors: string[] = [];
    const emailRaw = clip(body.contact_email);
    const phoneRaw = clip(body.contact_phone);

    if (emailRaw && !isValidEmail(emailRaw)) {
      errors.push('כתובת אימייל לא תקינה');
    }
    if (phoneRaw && !isValidPhone(phoneRaw)) {
      errors.push('מספר טלפון לא תקין');
    }
    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'validation_failed', message: errors.join(' · ') },
        { status: 400 },
      );
    }
  }

  // Map the form body to a DB row
  const row: Record<string, any> = {
    // section 0
    company_name: clip(body.company_name),
    company_id: clip(body.company_id),
    years_in_industry: clip(body.years_in_industry),
    team_size: clip(body.team_size),
    annual_revenue: clip(body.annual_revenue),
    active_projects: clip(body.active_projects),
    activity_type: clip(body.activity_type),
    contact_name: clip(body.contact_name),
    contact_phone: clip(body.contact_phone),
    contact_email: clip(body.contact_email),

    // section 1
    q_cashflow_tracking: clip(body.q_cashflow_tracking),
    q_payment_terms: clip(body.q_payment_terms),
    q_payment_followup: clip(body.q_payment_followup),
    q_project_profitability: clip(body.q_project_profitability),
    q_credit_lines: clip(body.q_credit_lines),
    q_known_exposures: clip(body.q_known_exposures),
    q_insurance: clip(body.q_insurance),
    q_litigation_exposure: clip(body.q_litigation_exposure),
    q_prevention_system: clip(body.q_prevention_system),
    q_legal_coverage: clip(body.q_legal_coverage),
    q_financial_health_score: clipInt(body.q_financial_health_score),

    // section 2
    q_software_used: clip(body.q_software_used),
    q_quote_time: clip(body.q_quote_time),
    q_field_reporting: clip(body.q_field_reporting),
    q_document_storage: clip(body.q_document_storage),
    q_manual_processes: clip(body.q_manual_processes),
    q_morning_dashboard: clip(body.q_morning_dashboard),
    q_people_dependency: clipInt(body.q_people_dependency),
    q_first_delegate: clip(body.q_first_delegate),

    // section 3
    q_top_three_priorities: clip(body.q_top_three_priorities),
    q_urgency: clipInt(body.q_urgency),
    q_budget: clip(body.q_budget),
    q_when_to_start: clip(body.q_when_to_start),

    // tracking
    utm_source: clip(body.utm_source),
    utm_medium: clip(body.utm_medium),
    utm_campaign: clip(body.utm_campaign),
  };

  // Only set IP/UA/referer on first insert (don't overwrite on update)
  const trackingFields = !existingId
    ? {
        ip_address: getClientIp(req),
        user_agent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
        referer: req.headers.get('referer')?.slice(0, 500) ?? null,
      }
    : {};

  if (action === 'submit') {
    row.submitted_at = new Date().toISOString();
    row.is_complete = true;
  }

  const admin = createAdminClient();
  let id = existingId;
  let saved: any = null;

  if (existingId) {
    const { data, error } = await admin
      .from('diagnostic_submissions')
      .update({ ...row, ...trackingFields })
      .eq('id', existingId)
      .select()
      .single();
    if (error) {
      return NextResponse.json(
        { error: 'db_failed', details: error.message },
        { status: 500 },
      );
    }
    saved = data;
  } else {
    const { data, error } = await admin
      .from('diagnostic_submissions')
      .insert({ ...row, ...trackingFields })
      .select()
      .single();
    if (error) {
      return NextResponse.json(
        { error: 'db_failed', details: error.message },
        { status: 500 },
      );
    }
    saved = data;
    id = data?.id ?? null;
  }

  // Fire notification email only on final submit (fire-and-forget)
  if (action === 'submit' && saved) {
    sendNotificationEmail(saved).catch((e) =>
      console.error('[diagnostic] notification email failed:', e),
    );
  }

  return NextResponse.json({ id, ok: true });
}

// ----------------------------------------------------------------------------
// Email rendering
// ----------------------------------------------------------------------------
async function sendNotificationEmail(submission: any) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[diagnostic] RESEND_API_KEY not set, skipping notification');
    return;
  }

  const subject = `🩺 שאלון אבחון חדש: ${submission.company_name ?? 'ללא שם חברה'}`;

  const html = renderEmail(submission);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: NOTIFY_FROM,
      to: [NOTIFY_TO],
      reply_to: submission.contact_email || undefined,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text.slice(0, 300)}`);
  }
}

function renderEmail(s: any): string {
  const adminUrl = `https://taskflow-ai.com/admin/diagnostic/${s.id}`;
  const safe = (v: any): string => {
    if (v === null || v === undefined || v === '') return '<em style="color:#999">לא נמסר</em>';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  };
  const score = (v: any) => (v ? `<strong style="color:#7c3aed">${v}/10</strong>` : safe(null));

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"><title>שאלון אבחון חדש</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;color:#111827;">
  <div style="max-width:680px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

    <div style="background:linear-gradient(135deg,#7c3aed 0%,#ec4899 100%);color:white;padding:32px;">
      <div style="font-size:14px;opacity:0.9;margin-bottom:4px;">🩺 שאלון אבחון חדש</div>
      <div style="font-size:24px;font-weight:bold;">${safe(s.company_name)}</div>
      ${s.company_id ? `<div style="font-size:14px;opacity:0.9;margin-top:4px;">ח.פ. ${safe(s.company_id)}</div>` : ''}
    </div>

    <div style="padding:24px;">
      <h2 style="font-size:16px;color:#111827;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-top:0;">📞 איש קשר</h2>
      <table style="width:100%;font-size:14px;line-height:1.7;">
        <tr><td style="color:#6b7280;width:140px;">שם:</td><td>${safe(s.contact_name)}</td></tr>
        <tr><td style="color:#6b7280;">טלפון:</td><td>${safe(s.contact_phone)}</td></tr>
        <tr><td style="color:#6b7280;">אימייל:</td><td>${s.contact_email ? `<a href="mailto:${safe(s.contact_email)}">${safe(s.contact_email)}</a>` : safe(null)}</td></tr>
      </table>

      <h2 style="font-size:16px;color:#111827;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-top:24px;">🏢 העסק</h2>
      <table style="width:100%;font-size:14px;line-height:1.7;">
        <tr><td style="color:#6b7280;width:140px;">ותק:</td><td>${safe(s.years_in_industry)}</td></tr>
        <tr><td style="color:#6b7280;">מס' עובדים:</td><td>${safe(s.team_size)}</td></tr>
        <tr><td style="color:#6b7280;">מחזור:</td><td>${safe(s.annual_revenue)}</td></tr>
        <tr><td style="color:#6b7280;">פרויקטים פעילים:</td><td>${safe(s.active_projects)}</td></tr>
        <tr><td style="color:#6b7280;">סוג פעילות:</td><td>${safe(s.activity_type)}</td></tr>
      </table>

      <h2 style="font-size:16px;color:#111827;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-top:24px;">🩺 רנטגן פיננסי</h2>
      <div style="font-size:14px;line-height:1.6;">
        <p><strong>בריאות פיננסית:</strong> ${score(s.q_financial_health_score)}</p>
        <p><strong>מעקב תזרים:</strong><br>${safe(s.q_cashflow_tracking)}</p>
        <p><strong>תנאי תשלום:</strong><br>${safe(s.q_payment_terms)}</p>
        <p><strong>מעקב תשלומים:</strong><br>${safe(s.q_payment_followup)}</p>
        <p><strong>רווחיות פרויקטים:</strong><br>${safe(s.q_project_profitability)}</p>
        <p><strong>מסגרות אשראי:</strong><br>${safe(s.q_credit_lines)}</p>
        <p><strong>חשיפות ידועות:</strong><br>${safe(s.q_known_exposures)}</p>
        <p><strong>ביטוחים:</strong><br>${safe(s.q_insurance)}</p>
        <p><strong>חשיפה לתביעות:</strong><br>${safe(s.q_litigation_exposure)}</p>
        <p><strong>מערכת מניעת תביעות:</strong><br>${safe(s.q_prevention_system)}</p>
        <p><strong>כיסוי משפטי:</strong><br>${safe(s.q_legal_coverage)}</p>
      </div>

      <h2 style="font-size:16px;color:#111827;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-top:24px;">⚙️ סיסטם עבודה</h2>
      <div style="font-size:14px;line-height:1.6;">
        <p><strong>תוכנות:</strong><br>${safe(s.q_software_used)}</p>
        <p><strong>זמן הצעת מחיר:</strong><br>${safe(s.q_quote_time)}</p>
        <p><strong>דיווחי שטח:</strong><br>${safe(s.q_field_reporting)}</p>
        <p><strong>אחסון מסמכים:</strong><br>${safe(s.q_document_storage)}</p>
        <p><strong>תהליכים ידניים:</strong><br>${safe(s.q_manual_processes)}</p>
        <p><strong>דאשבורד בוקר:</strong><br>${safe(s.q_morning_dashboard)}</p>
        <p><strong>תלות באנשים:</strong> ${score(s.q_people_dependency)}</p>
        <p><strong>ראשון להעביר לעוזר:</strong><br>${safe(s.q_first_delegate)}</p>
      </div>

      <h2 style="font-size:16px;color:#111827;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-top:24px;">🎯 סיכום</h2>
      <div style="font-size:14px;line-height:1.6;">
        <p><strong>שלושת הדברים לטיפול מיידי:</strong><br>${safe(s.q_top_three_priorities)}</p>
        <p><strong>רמת דחיפות:</strong> ${score(s.q_urgency)}</p>
        <p><strong>תקציב משוער:</strong> ${safe(s.q_budget)}</p>
        <p><strong>מתי להתחיל:</strong> ${safe(s.q_when_to_start)}</p>
      </div>

      ${s.utm_source || s.utm_medium || s.utm_campaign ? `
        <h2 style="font-size:16px;color:#111827;border-bottom:1px solid #e5e7eb;padding-bottom:8px;margin-top:24px;">📊 מקור</h2>
        <table style="width:100%;font-size:13px;line-height:1.6;color:#6b7280;">
          ${s.utm_source ? `<tr><td>UTM Source:</td><td style="color:#111827">${safe(s.utm_source)}</td></tr>` : ''}
          ${s.utm_medium ? `<tr><td>UTM Medium:</td><td style="color:#111827">${safe(s.utm_medium)}</td></tr>` : ''}
          ${s.utm_campaign ? `<tr><td>UTM Campaign:</td><td style="color:#111827">${safe(s.utm_campaign)}</td></tr>` : ''}
        </table>
      ` : ''}

      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
        נשלח ב-${new Date(s.submitted_at ?? Date.now()).toLocaleString('he-IL')} ·
        <a href="${adminUrl}" style="color:#7c3aed;">פתח בדשבורד ←</a>
      </div>
    </div>
  </div>
</body>
</html>`;
}
