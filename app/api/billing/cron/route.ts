import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { chargeToken } from '@/lib/cardcom/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/billing/cron
 * 
 * Run daily by Vercel cron. For each subscription whose period_end has passed:
 *   - If cancel_at_period_end → mark as expired, downgrade workspace to trial
 *   - Else → charge the saved token, extend period by 1 month
 */
export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (cronSecret !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Find subscriptions due for renewal/expiration
  const now = new Date().toISOString();
  const { data: dueSubs } = await service
    .from('subscriptions')
    .select('*')
    .in('status', ['active', 'past_due'])
    .lte('current_period_end', now);

  const results = {
    total: dueSubs?.length || 0,
    renewed: 0,
    expired: 0,
    failed: 0,
    errors: [] as any[],
  };

  for (const sub of dueSubs || []) {
    try {
      // Cancel-at-period-end → expire and downgrade
      if (sub.cancel_at_period_end) {
        await service
          .from('subscriptions')
          .update({ status: 'expired' })
          .eq('id', sub.id);
        
        await service
          .from('workspaces')
          .update({ plan: 'trial', plan_expires_at: null })
          .eq('id', sub.workspace_id);
        
        await service.from('billing_events').insert({
          workspace_id: sub.workspace_id,
          subscription_id: sub.id,
          event_type: 'subscription.expired',
          details: { reason: 'cancelled_at_period_end' },
          source: 'cron',
        });
        
        results.expired++;
        continue;
      }

      // No token? Can't charge - mark past_due
      if (!sub.cardcom_token) {
        await service
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('id', sub.id);
        results.failed++;
        continue;
      }

      // Charge the token
      const charge = await chargeToken({
        token: sub.cardcom_token,
        amount: Number(sub.amount_ils),
        productName: 'TaskFlow AI Pro - חיוב חודשי',
        customerName: sub.customer_name || undefined,
        customerEmail: sub.customer_email || undefined,
        externalUniqTransactionId: sub.id,
        cardLast4: sub.cardcom_last_4 || undefined,
      });

      // Log payment
      await service.from('payments').insert({
        subscription_id: sub.id,
        workspace_id: sub.workspace_id,
        amount_usd: sub.amount_usd,
        amount_ils: sub.amount_ils,
        currency: sub.currency,
        status: charge.success ? 'captured' : 'failed',
        failure_reason: charge.success ? null : charge.responseText,
        cardcom_deal_number: charge.dealNumber || null,
        cardcom_response_code: String(charge.responseCode),
        cardcom_response_text: charge.responseText,
        cardcom_full_response: charge.raw,
        payment_type: 'subscription',
        processed_at: new Date().toISOString(),
      });

      if (charge.success) {
        // Extend period by 1 month
        const newPeriodEnd = new Date(sub.current_period_end);
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

        await service
          .from('subscriptions')
          .update({
            status: 'active',
            current_period_start: sub.current_period_end,
            current_period_end: newPeriodEnd.toISOString(),
          })
          .eq('id', sub.id);

        await service
          .from('workspaces')
          .update({ plan_expires_at: newPeriodEnd.toISOString() })
          .eq('id', sub.workspace_id);

        await service.from('billing_events').insert({
          workspace_id: sub.workspace_id,
          subscription_id: sub.id,
          event_type: 'payment.succeeded',
          details: { period_end: newPeriodEnd.toISOString() },
          source: 'cron',
        });

        results.renewed++;
      } else {
        // Mark past_due (will retry on next cron run if still in window)
        await service
          .from('subscriptions')
          .update({ status: 'past_due', notes: charge.responseText })
          .eq('id', sub.id);

        await service.from('billing_events').insert({
          workspace_id: sub.workspace_id,
          subscription_id: sub.id,
          event_type: 'payment.failed',
          details: { response_code: charge.responseCode, text: charge.responseText },
          source: 'cron',
        });
        results.failed++;
      }
    } catch (err: any) {
      results.errors.push({ subscription_id: sub.id, error: err.message });
    }
  }

  return NextResponse.json(results);
}
