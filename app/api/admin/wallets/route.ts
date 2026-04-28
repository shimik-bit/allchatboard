import { NextRequest, NextResponse } from 'next/server';
import { adminServiceClient, requirePlatformAdmin } from '@/lib/admin/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PATCH /api/admin/wallets { workspace_id, markup_multiplier?, balance_adjustment?, description? }
export async function PATCH(req: NextRequest) {
  const { user } = await requirePlatformAdmin();
  const body = await req.json();
  const { workspace_id, markup_multiplier, balance_adjustment_usd, is_blocked, description } = body;

  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

  const supabase = adminServiceClient();
  await supabase.rpc('get_or_create_wallet', { p_workspace_id: workspace_id });

  // Update markup / blocked status
  const update: any = {};
  if (markup_multiplier !== undefined) {
    update.markup_multiplier = markup_multiplier === null ? null : Number(markup_multiplier);
  }
  if (is_blocked !== undefined) {
    update.is_blocked = is_blocked;
    update.blocked_reason = is_blocked ? (description || 'חסום ע"י אדמין') : null;
  }

  if (Object.keys(update).length > 0) {
    await supabase.from('ai_wallets').update(update).eq('workspace_id', workspace_id);
  }

  // Manual balance adjustment
  if (balance_adjustment_usd && Number(balance_adjustment_usd) !== 0) {
    await supabase.rpc('topup_wallet', {
      p_workspace_id: workspace_id,
      p_amount_usd: Number(balance_adjustment_usd),
      p_type: 'admin_adjustment',
      p_description: description || `התאמת אדמין: ${balance_adjustment_usd > 0 ? '+' : ''}$${balance_adjustment_usd}`,
      p_created_by: user.id,
    });
  }

  return NextResponse.json({ ok: true });
}
