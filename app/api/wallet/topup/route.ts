import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createLowProfileSession, isCardcomConfigured, usdToIls } from '@/lib/cardcom/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/wallet/topup { workspace_id, amount_usd }
export async function POST(req: NextRequest) {
  if (!isCardcomConfigured()) {
    return NextResponse.json({ error: 'Cardcom is not configured on the server' }, { status: 500 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { workspace_id, amount_usd } = body;

  if (!workspace_id || !amount_usd) {
    return NextResponse.json({ error: 'workspace_id and amount_usd required' }, { status: 400 });
  }

  const amount = Number(amount_usd);
  if (amount < 5) {
    return NextResponse.json({ error: 'Minimum top-up is $5' }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from('workspace_members').select('role, workspaces(name)')
    .eq('workspace_id', workspace_id).eq('user_id', user.id).maybeSingle();
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const wsName = (Array.isArray((membership as any).workspaces)
    ? (membership as any).workspaces[0]
    : (membership as any).workspaces)?.name || 'TaskFlow AI';

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  await service.rpc('get_or_create_wallet', { p_workspace_id: workspace_id });

  const amountIls = usdToIls(amount);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://taskflow-ai.com';

  // Create pending payment record
  const { data: pendingPayment, error: paymentErr } = await service
    .from('payments').insert({
      workspace_id,
      amount_ils: amountIls,
      currency: 'ILS',
      status: 'pending',
      type: 'wallet_topup',
      metadata: { wallet_topup: true, amount_usd: amount },
    }).select('id').single();

  if (paymentErr || !pendingPayment) {
    return NextResponse.json({ error: paymentErr?.message || 'Could not create payment' }, { status: 500 });
  }

  try {
    const session = await createLowProfileSession({
      amount: amountIls,
      productName: `${wsName} - טעינת ארנק AI $${amount}`,
      successUrl: `${baseUrl}/dashboard/wallet?topup=success&payment_id=${pendingPayment.id}`,
      errorUrl: `${baseUrl}/dashboard/wallet?topup=cancel`,
      webhookUrl: `${baseUrl}/api/wallet/topup/webhook?payment_id=${pendingPayment.id}&workspace_id=${workspace_id}&amount_usd=${amount}`,
      externalUniqTransactionId: pendingPayment.id,
      isRecurring: false,
      metadata: {
        type: 'wallet_topup',
        workspace: workspace_id,
      },
    });

    // Save the lowProfileId
    await service
      .from('payments')
      .update({ cardcom_low_profile_id: session.lowProfileId })
      .eq('id', pendingPayment.id);

    return NextResponse.json({
      payment_url: session.url,
      low_profile_id: session.lowProfileId,
      amount_usd: amount,
      amount_ils: amountIls,
      payment_id: pendingPayment.id,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Cardcom error' }, { status: 500 });
  }
}
