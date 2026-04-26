import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/groupguard/super-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * SUPER-ADMIN ONLY ENDPOINTS
 * ===========================
 * GET    /api/groupguard/admin/blocklist?q=&confirmed=&page=
 * POST   /api/groupguard/admin/blocklist
 *   Body: { phone, reason?, notes?, confirmed? }
 * PATCH  /api/groupguard/admin/blocklist
 *   Body: { id, is_confirmed?, notes? }
 * DELETE /api/groupguard/admin/blocklist?id=xxx
 */

const PAGE_SIZE = 50;


export async function GET(req: NextRequest) {
  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if (!admin) {
    return NextResponse.json({ error: 'super-admin only' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const confirmedFilter = searchParams.get('confirmed'); // 'yes' | 'no' | null
  const page = Math.max(0, Number(searchParams.get('page') || 0));

  // Use admin client to bypass RLS (the table has no public read policy now)
  const adminClient = createAdminClient();

  let query = adminClient
    .from('gg_global_blocklist')
    .select('*', { count: 'exact' })
    .order('last_reported_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  if (q) {
    // Phone search (digits only)
    const digits = q.replace(/\D/g, '');
    if (digits.length > 0) {
      query = query.ilike('phone', `%${digits}%`);
    }
  }

  if (confirmedFilter === 'yes') query = query.eq('is_confirmed', true);
  else if (confirmedFilter === 'no') query = query.eq('is_confirmed', false);

  const { data: entries, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate stats - count workspaces affected by each phone
  const phones = (entries || []).map((e: { phone: string }) => e.phone);
  let actionsByPhone: Record<string, number> = {};

  if (phones.length > 0) {
    const { data: actions } = await adminClient
      .from('gg_actions_log')
      .select('target_phone')
      .in('target_phone', phones)
      .eq('was_successful', true);

    for (const a of actions || []) {
      actionsByPhone[a.target_phone] = (actionsByPhone[a.target_phone] || 0) + 1;
    }
  }

  return NextResponse.json({
    entries: (entries || []).map((e: { phone: string; [key: string]: unknown }) => ({
      ...e,
      action_count: actionsByPhone[e.phone] || 0,
    })),
    page,
    page_size: PAGE_SIZE,
    total: count ?? 0,
    total_pages: Math.ceil((count ?? 0) / PAGE_SIZE),
  });
}


export async function POST(req: NextRequest) {
  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if (!admin) {
    return NextResponse.json({ error: 'super-admin only' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.phone) {
    return NextResponse.json({ error: 'phone required' }, { status: 400 });
  }

  const phone = String(body.phone).replace(/\D/g, '');
  if (phone.length < 7) {
    return NextResponse.json({ error: 'invalid phone' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from('gg_global_blocklist')
    .insert({
      phone,
      reason_summary: body.reason || 'manual_admin_add',
      notes: body.notes || `Added manually by ${admin.email}`,
      is_confirmed: body.confirmed === true,
      confirmed_at: body.confirmed === true ? new Date().toISOString() : null,
      report_count: 1,
      unique_groups_count: 0,
      unique_workspaces_count: 0,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'phone already in blocklist' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entry: data });
}


export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if (!admin) {
    return NextResponse.json({ error: 'super-admin only' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.is_confirmed === 'boolean') {
    patch.is_confirmed = body.is_confirmed;
    patch.confirmed_at = body.is_confirmed ? new Date().toISOString() : null;
  }
  if (typeof body.notes === 'string') patch.notes = body.notes;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  patch.updated_at = new Date().toISOString();

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from('gg_global_blocklist')
    .update(patch)
    .eq('id', body.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}


export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if (!admin) {
    return NextResponse.json({ error: 'super-admin only' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from('gg_global_blocklist')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
