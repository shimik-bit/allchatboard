import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  const { data: admin } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!admin) return { error: NextResponse.json({ error: 'Platform admin only' }, { status: 403 }), user: null };
  return { error: null, user };
}

/**
 * POST /api/admin/workspaces/[id]/limits
 * Body: {
 *   plan: 'trial'|'starter'|'business'|'enterprise',
 *   limit_overrides: { max_tables: 50, ... },
 *   feature_overrides: { feature_white_label: true },
 *   plan_notes: string,
 *   plan_expires_at: ISO date string | null
 * }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const { plan, limit_overrides, feature_overrides, plan_notes, plan_expires_at } = body;

  if (!['trial', 'starter', 'business', 'enterprise'].includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Update workspace
  const { error } = await service
    .from('workspaces')
    .update({
      plan,
      limit_overrides: limit_overrides || {},
      feature_overrides: feature_overrides || {},
      plan_notes: plan_notes || null,
      plan_expires_at: plan_expires_at || null,
      plan_set_by_admin_id: auth.user!.id,
      plan_set_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sync ai_messages_limit on workspaces table from the new effective limit
  // (since legacy code reads workspaces.ai_messages_limit directly)
  const { data: planData } = await service
    .from('plan_limits')
    .select('ai_messages_per_month')
    .eq('plan', plan)
    .maybeSingle();

  const effectiveAiLimit =
    (limit_overrides?.ai_messages_per_month as number | undefined) ??
    planData?.ai_messages_per_month ??
    500;

  await service
    .from('workspaces')
    .update({ ai_messages_limit: effectiveAiLimit })
    .eq('id', params.id);

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/admin/workspaces/[id]/limits
 * Returns effective limits + usage for the workspace
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: ws } = await service
    .from('workspaces')
    .select('plan, limit_overrides, feature_overrides, plan_notes, plan_expires_at')
    .eq('id', params.id)
    .maybeSingle();

  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const { data: planLimits } = await service
    .from('plan_limits')
    .select('*')
    .eq('plan', ws.plan)
    .maybeSingle();

  const { data: usage } = await service.rpc('get_workspace_usage', {
    p_workspace_id: params.id,
  });

  return NextResponse.json({
    plan: ws.plan,
    plan_limits: planLimits,
    limit_overrides: ws.limit_overrides,
    feature_overrides: ws.feature_overrides,
    plan_notes: ws.plan_notes,
    plan_expires_at: ws.plan_expires_at,
    usage,
  });
}
