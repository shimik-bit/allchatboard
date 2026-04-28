import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getLowProfileResult } from '@/lib/cardcom/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cardcom calls this after payment completes
async function handleWebhook(req: NextRequest, params: { lowProfileId?: string; payment_id?: string; workspace_id?: string; amount_usd?: string }) {
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const lowProfileId = params.lowProfileId;
  if (!lowProfileId) {
    console.error('[wallet/topup/webhook] No LowProfileId received');
    return NextResponse.json({ ok: false, error: 'Missing LowProfileId' }, { status: 400 });
  }

  // Fetch full result from Cardcom
  let result: any;
  try {
    result = await getLowProfileResult(lowProfileId);
  } catch (err: any) {
    console.error('[wallet/topup/webhook] getLowProfileResult error:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }

  const success = result?.ResponseCode === 0;
  const dealNumber = result?.TranzactionInfo?.DealNumber || result?.DealNumber || null;

  // Find the pending payment
  let paymentId = params.payment_id;
  if (!paymentId && result?.ReturnValue) paymentId = result.ReturnValue;

  if (!paymentId) {
    console.error('[wallet/topup/webhook] No payment ID found in webhook');
    return NextResponse.json({ ok: false, error: 'No payment_id' }, { status: 400 });
  }

  const { data: payment } = await service
    .from('payments').select('*').eq('id', paymentId).maybeSingle();
  if (!payment) {
    console.error('[wallet/topup/webhook] Payment not found:', paymentId);
    return NextResponse.json({ ok: false, error: 'Payment not found' }, { status: 404 });
  }

  if (success) {
    // Update payment record
    await service
      .from('payments')
      .update({
        status: 'captured',
        cardcom_deal_number: dealNumber ? String(dealNumber) : null,
        cardcom_full_response: result,
        captured_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    // Top up wallet
    const amountUsd = Number(params.amount_usd || payment?.metadata?.amount_usd || 0);
    if (amountUsd > 0) {
      await service.rpc('topup_wallet', {
        p_workspace_id: payment.workspace_id,
        p_amount_usd: amountUsd,
        p_type: 'topup',
        p_payment_id: paymentId,
        p_cardcom_deal_number: dealNumber ? String(dealNumber) : null,
        p_description: `טעינת ארנק $${amountUsd}`,
      });
    }
  } else {
    // Mark payment as failed
    await service
      .from('payments')
      .update({
        status: 'failed',
        cardcom_full_response: result,
      })
      .eq('id', paymentId);
  }

  return NextResponse.json({ ok: true, success });
}

export async function POST(req: NextRequest) {
  // Cardcom may POST as form-data or JSON
  let body: any = {};
  const contentType = req.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      body = await req.json();
    } else {
      const formData = await req.formData();
      body = Object.fromEntries(formData.entries());
    }
  } catch {
    body = {};
  }

  return handleWebhook(req, {
    lowProfileId: body.LowProfileId || req.nextUrl.searchParams.get('LowProfileId') || undefined,
    payment_id: req.nextUrl.searchParams.get('payment_id') || undefined,
    workspace_id: req.nextUrl.searchParams.get('workspace_id') || undefined,
    amount_usd: req.nextUrl.searchParams.get('amount_usd') || undefined,
  });
}

export async function GET(req: NextRequest) {
  return handleWebhook(req, {
    lowProfileId: req.nextUrl.searchParams.get('LowProfileId') || undefined,
    payment_id: req.nextUrl.searchParams.get('payment_id') || undefined,
    workspace_id: req.nextUrl.searchParams.get('workspace_id') || undefined,
    amount_usd: req.nextUrl.searchParams.get('amount_usd') || undefined,
  });
}
