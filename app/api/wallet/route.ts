import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/wallet?workspace_id=xxx
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspaceId = req.nextUrl.searchParams.get('workspace_id');
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

  const { data: membership } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspaceId).eq('user_id', user.id).maybeSingle();
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Ensure wallet exists
  await service.rpc('get_or_create_wallet', { p_workspace_id: workspaceId });

  // Get wallet status
  const { data: wallet } = await service
    .from('wallet_status').select('*').eq('workspace_id', workspaceId).single();

  // Get pricing settings (presets)
  const { data: settings } = await service
    .from('ai_pricing_settings').select('*').eq('id', 1).single();

  // Recent transactions
  const { data: transactions } = await service
    .from('wallet_transactions')
    .select('id, type, amount_usd, amount_ils, balance_after_usd, description, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false }).limit(30);

  return NextResponse.json({ wallet, settings, transactions: transactions || [] });
}

// PATCH /api/wallet - update auto-recharge settings
export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { workspace_id, auto_recharge_enabled, auto_recharge_threshold_usd, auto_recharge_amount_usd } = body;

  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

  const { data: membership } = await supabase
    .from('workspace_members').select('role')
    .eq('workspace_id', workspace_id).eq('user_id', user.id).maybeSingle();
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const update: any = {};
  if (auto_recharge_enabled !== undefined) update.auto_recharge_enabled = auto_recharge_enabled;
  if (auto_recharge_threshold_usd !== undefined) update.auto_recharge_threshold_usd = auto_recharge_threshold_usd;
  if (auto_recharge_amount_usd !== undefined) update.auto_recharge_amount_usd = auto_recharge_amount_usd;

  const { data, error } = await service
    .from('ai_wallets').update(update).eq('workspace_id', workspace_id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ wallet: data });
}
