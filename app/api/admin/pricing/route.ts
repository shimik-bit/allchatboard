import { NextRequest, NextResponse } from 'next/server';
import { adminServiceClient, requirePlatformAdmin } from '@/lib/admin/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  await requirePlatformAdmin();
  const body = await req.json();
  const supabase = adminServiceClient();

  const update: any = {};
  if (body.default_markup_multiplier !== undefined) update.default_markup_multiplier = Number(body.default_markup_multiplier);
  if (body.default_topup_presets !== undefined) update.default_topup_presets = body.default_topup_presets;
  if (body.default_threshold_usd !== undefined) update.default_threshold_usd = Number(body.default_threshold_usd);
  if (body.default_recharge_amount_usd !== undefined) update.default_recharge_amount_usd = Number(body.default_recharge_amount_usd);
  if (body.min_topup_usd !== undefined) update.min_topup_usd = Number(body.min_topup_usd);

  const { data, error } = await supabase
    .from('ai_pricing_settings').update(update).eq('id', 1).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}
