import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getLowProfileResult } from '@/lib/cardcom/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST/GET /api/billing/webhook?sub=<subscription_id>
 * 
 * Cardcom calls this URL after the user completes (or fails) payment.
 * We fetch the full LowProfile result and update our records.
 */
export async function POST(req: NextRequest) {
  return handleWebhook(req);
}

export async function GET(req: NextRequest) {
  return handleWebhook(req);
}

async function handleWebhook(req: NextRequest) {
  const subscriptionId = req.nextUrl.searchParams.get('sub');
  if (!subscriptionId) {
    return NextResponse.json({ error: 'missing sub param' }, { status: 400 });
  }

  // Cardcom may POST form data or JSON, or include LowProfileId in query
  let lowProfileId: string | null = req.nextUrl.searchParams.get('LowProfileId');

  if (!lowProfileId) {
    // Try parsing the body
    try {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await req.json();
        lowProfileId = body.LowProfileId || body.lowProfileId || null;
      } else if (contentType.includes('form')) {
        const form = await req.formData();
        lowProfileId = form.get('LowProfileId') as string | null;
      }
    } catch {}
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Get our subscription record
  const { data: subscription } = await service
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .maybeSingle();

  if (!subscription) {
    return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
  }

  // Use stored LowProfileId if not in webhook
  if (!lowProfileId) lowProfileId = subscription.cardcom_low_profile_id;
  if (!lowProfileId) {
    return NextResponse.json({ error: 'No LowProfileId available' }, { status: 400 });
  }

  // Fetch full result from Cardcom
  let result: any;
  try {
    result = await getLowProfileResult(lowProfileId);
  } catch (err: any) {
    await service.from('billing_events').insert({
      workspace_id: subscription.workspace_id,
      subscription_id: subscription.id,
      event_type: 'webhook.fetch_failed',
      details: { error: err.message, low_profile_id: lowProfileId },
      source: 'webhook',
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  const success = result.ResponseCode === 0;
  const tranInfo = result.TranzactionInfo || {};
  const tokenInfo = result.TokenInfo || {};

  // Create payment record
  const { data: payment } = await service
    .from('payments')
    .insert({
      subscription_id: subscription.id,
      workspace_id: subscription.workspace_id,
      amount_usd: subscription.amount_usd,
      amount_ils: subscription.amount_ils,
      currency: subscription.currency,
      status: success ? 'captured' : 'failed',
      failure_reason: success ? null : (result.Description || 'Payment failed'),
      cardcom_low_profile_id: lowProfileId,
      cardcom_deal_number: tranInfo.TranzactionId ? String(tranInfo.TranzactionId) : null,
      cardcom_response_code: String(result.ResponseCode),
      cardcom_response_text: result.Description || null,
      cardcom_token: tokenInfo.Token || null,
      cardcom_last_4: tranInfo.Last4CardDigits ? String(tranInfo.Last4CardDigits) : null,
      cardcom_card_holder_name: tranInfo.CardOwnerName || null,
      cardcom_full_response: result,
      payment_type: 'initial',
      processed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (success) {
    // Activate the subscription
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await service
      .from('subscriptions')
      .update({
        status: 'active',
        cardcom_token: tokenInfo.Token || null,
        cardcom_last_4: tranInfo.Last4CardDigits ? String(tranInfo.Last4CardDigits) : null,
        cardcom_card_brand: tranInfo.CardName || null,
        cardcom_card_holder_name: tranInfo.CardOwnerName || null,
        cardcom_card_expiry: tranInfo.CardMonth && tranInfo.CardYear 
          ? `${String(tranInfo.CardMonth).padStart(2,'0')}/${String(tranInfo.CardYear).slice(-2)}` 
          : null,
        current_period_start: new Date().toISOString(),
        current_period_end: periodEnd.toISOString(),
        customer_name: tranInfo.CardOwnerName || null,
        customer_phone: tranInfo.CardOwnerPhone || null,
        customer_id_number: tranInfo.CardOwnerIdentityNumber || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    // Upgrade workspace to enterprise plan
    await service
      .from('workspaces')
      .update({
        plan: 'enterprise',
        plan_expires_at: periodEnd.toISOString(),
        plan_set_at: new Date().toISOString(),
      })
      .eq('id', subscription.workspace_id);

    await service.from('billing_events').insert({
      workspace_id: subscription.workspace_id,
      subscription_id: subscription.id,
      payment_id: payment?.id,
      event_type: 'subscription.activated',
      details: {
        period_end: periodEnd.toISOString(),
        last_4: tranInfo.Last4CardDigits,
      },
      source: 'webhook',
    });
  } else {
    // Mark subscription as expired
    await service
      .from('subscriptions')
      .update({
        status: 'expired',
        notes: result.Description || 'Payment failed',
      })
      .eq('id', subscription.id);

    await service.from('billing_events').insert({
      workspace_id: subscription.workspace_id,
      subscription_id: subscription.id,
      payment_id: payment?.id,
      event_type: 'payment.failed',
      details: {
        response_code: result.ResponseCode,
        response_text: result.Description,
      },
      source: 'webhook',
    });
  }

  return NextResponse.json({ ok: true, success });
}
