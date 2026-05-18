// GET /api/admin/diagnostic/list
//
// Returns a paginated list of diagnostic submissions. Admin-only.
//
// Query params (all optional):
//   status: 'all' | 'complete' | 'draft'  (default: 'all')
//   q:      search string (matches company_name, contact_name, contact_email, contact_phone)
//   limit:  default 50, max 200
//   offset: default 0
//
// Response: { submissions: [...], total: number }

import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const url = req.nextUrl;
  const status = url.searchParams.get('status') ?? 'all';
  const q = url.searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10) || 50, 200);
  const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10) || 0, 0);

  // Light list view — only the columns the table needs
  let query = admin
    .from('diagnostic_submissions')
    .select(
      `
      id,
      created_at,
      submitted_at,
      is_complete,
      company_name,
      contact_name,
      contact_phone,
      contact_email,
      activity_type,
      annual_revenue,
      q_urgency,
      q_financial_health_score,
      utm_source,
      reviewed_at
    `,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false });

  if (status === 'complete') {
    query = query.eq('is_complete', true);
  } else if (status === 'draft') {
    query = query.eq('is_complete', false);
  }

  if (q) {
    // Escape % and _ to avoid LIKE injection
    const esc = q.replace(/[%_\\]/g, '\\$&');
    query = query.or(
      `company_name.ilike.%${esc}%,contact_name.ilike.%${esc}%,contact_email.ilike.%${esc}%,contact_phone.ilike.%${esc}%`,
    );
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: 'db_failed', details: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    submissions: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  });
}
