import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/alerts
 *
 * Lists system alerts. Restricted to super-admins (defined in
 * super_admin_emails table).
 *
 * Query params:
 *   ?status=unresolved | resolved | all  (default: unresolved)
 *   ?severity=fatal | error | warning    (default: all)
 *   ?limit=50                            (default: 50, max: 200)
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Check super-admin status
  const admin = createAdminClient();
  const { data: superAdmin } = await admin
    .from('super_admin_emails')
    .select('email')
    .eq('email', user.email!.toLowerCase())
    .single();

  if (!superAdmin) {
    return NextResponse.json({ error: 'forbidden - admin only' }, { status: 403 });
  }

  // Parse query params
  const status = req.nextUrl.searchParams.get('status') || 'unresolved';
  const severity = req.nextUrl.searchParams.get('severity');
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 200);

  let query = admin
    .from('system_alerts')
    .select('*, workspaces(name, workspace_code)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status === 'unresolved') {
    query = query.eq('is_resolved', false);
  } else if (status === 'resolved') {
    query = query.eq('is_resolved', true);
  }
  // status='all' means no filter

  if (severity && ['fatal', 'error', 'warning'].includes(severity)) {
    query = query.eq('severity', severity);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ alerts: data || [] });
}

/**
 * POST /api/admin/alerts
 *
 * Body: { id, action: 'resolve' | 'unresolve', note?: string }
 *
 * Updates the resolution state of an alert.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: superAdmin } = await admin
    .from('super_admin_emails')
    .select('email')
    .eq('email', user.email!.toLowerCase())
    .single();

  if (!superAdmin) {
    return NextResponse.json({ error: 'forbidden - admin only' }, { status: 403 });
  }

  const body = await req.json();
  const { id, action, note } = body;

  if (!id || !['resolve', 'unresolve'].includes(action)) {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  const updateData =
    action === 'resolve'
      ? {
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
          resolved_note: note || null,
        }
      : {
          is_resolved: false,
          resolved_at: null,
          resolved_by: null,
          resolved_note: null,
        };

  const { error } = await admin
    .from('system_alerts')
    .update(updateData)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
