// GET /api/admin/diagnostic/export
//
// Returns submissions as a CSV download. Admin-only.
// Excel-friendly: UTF-8 BOM prefix + CRLF line endings + Hebrew headers.

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/server';

const COLUMNS: Array<{ key: string; label: string }> = [
  { key: 'created_at', label: 'תאריך יצירה' },
  { key: 'submitted_at', label: 'תאריך שליחה' },
  { key: 'is_complete', label: 'הושלם' },
  { key: 'company_name', label: 'שם החברה' },
  { key: 'company_id', label: 'ח.פ.' },
  { key: 'years_in_industry', label: 'ותק' },
  { key: 'team_size', label: 'מס עובדים' },
  { key: 'annual_revenue', label: 'מחזור שנתי' },
  { key: 'active_projects', label: 'פרויקטים פעילים' },
  { key: 'activity_type', label: 'סוג פעילות' },
  { key: 'contact_name', label: 'איש קשר' },
  { key: 'contact_phone', label: 'טלפון' },
  { key: 'contact_email', label: 'אימייל' },
  { key: 'q_financial_health_score', label: 'בריאות פיננסית (1-10)' },
  { key: 'q_cashflow_tracking', label: 'מעקב תזרים' },
  { key: 'q_payment_terms', label: 'תנאי תשלום' },
  { key: 'q_payment_followup', label: 'מעקב תשלומים' },
  { key: 'q_project_profitability', label: 'רווחיות פרויקטים' },
  { key: 'q_credit_lines', label: 'מסגרות אשראי' },
  { key: 'q_known_exposures', label: 'חשיפות ידועות' },
  { key: 'q_insurance', label: 'ביטוחים' },
  { key: 'q_litigation_exposure', label: 'תביעות' },
  { key: 'q_prevention_system', label: 'מניעת תביעות' },
  { key: 'q_legal_coverage', label: 'כיסוי משפטי' },
  { key: 'q_software_used', label: 'תוכנות בשימוש' },
  { key: 'q_quote_time', label: 'זמן הצעת מחיר' },
  { key: 'q_field_reporting', label: 'דיווחי שטח' },
  { key: 'q_document_storage', label: 'אחסון מסמכים' },
  { key: 'q_manual_processes', label: 'תהליכים ידניים' },
  { key: 'q_morning_dashboard', label: 'דאשבורד בוקר' },
  { key: 'q_people_dependency', label: 'תלות באנשים (1-10)' },
  { key: 'q_first_delegate', label: 'ראשון להעביר' },
  { key: 'q_top_three_priorities', label: '3 עדיפויות' },
  { key: 'q_urgency', label: 'דחיפות (1-10)' },
  { key: 'q_budget', label: 'תקציב' },
  { key: 'q_when_to_start', label: 'מתי להתחיל' },
  { key: 'utm_source', label: 'UTM Source' },
  { key: 'utm_medium', label: 'UTM Medium' },
  { key: 'utm_campaign', label: 'UTM Campaign' },
  { key: 'notes', label: 'הערות פנימיות' },
];

function escapeCsv(v: any): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  // Strip newlines that break Excel rows
  s = s.replace(/\r?\n/g, ' / ');
  // Quote if needed
  if (s.includes(',') || s.includes('"') || s.includes(';')) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function fmtCell(key: string, val: any): string {
  if (key === 'is_complete') return val ? 'כן' : 'לא';
  if ((key === 'created_at' || key === 'submitted_at') && val) {
    try {
      return new Date(val).toLocaleString('he-IL', {
        timeZone: 'Asia/Jerusalem',
        dateStyle: 'short',
        timeStyle: 'short',
      });
    } catch {
      return String(val);
    }
  }
  return val === null || val === undefined ? '' : String(val);
}

export async function GET(req: NextRequest) {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const status = req.nextUrl.searchParams.get('status') ?? 'all';

  let query = admin
    .from('diagnostic_submissions')
    .select(COLUMNS.map((c) => c.key).join(','))
    .order('created_at', { ascending: false });

  if (status === 'complete') query = query.eq('is_complete', true);
  if (status === 'draft') query = query.eq('is_complete', false);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'db_failed', details: error.message }, { status: 500 });
  }

  const header = COLUMNS.map((c) => escapeCsv(c.label)).join(',');
  const rows = ((data ?? []) as any[]).map((row) =>
    COLUMNS.map((c) => escapeCsv(fmtCell(c.key, row[c.key]))).join(','),
  );
  // UTF-8 BOM so Excel auto-detects Hebrew correctly
  const csv = '\uFEFF' + [header, ...rows].join('\r\n');

  const filename = `diagnostic-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
