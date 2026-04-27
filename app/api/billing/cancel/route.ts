import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/cancel
 * Body: { subscription_id }
 * Marks subscription as cancel_at_period_end. Will run until period_end then expire.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { subscription_id } = body;
  if (!subscription_id) {
    return NextResponse.json({ error: 'subscription_id required' }, { status: 400 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: sub } = await service
    .from('subscriptions')
    .select('id, workspace_id, status, current_period_end')
    .eq('id', subscription_id)
    .maybeSingle();

  if (!sub) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });

  // Verify user is owner/admin
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', sub.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (!['active', 'past_due', 'pending'].includes(sub.status)) {
    return NextResponse.json({ error: 'Subscription is not active' }, { status: 400 });
  }

  await service
    .from('subscriptions')
    .update({
      cancel_at_period_end: true,
      cancelled_at: new Date().toISOString(),
      status: 'cancelled',
    })
    .eq('id', subscription_id);

  await service.from('billing_events').insert({
    workspace_id: sub.workspace_id,
    subscription_id: sub.id,
    event_type: 'subscription.cancelled',
    details: { will_expire_at: sub.current_period_end },
    source: 'api',
  });

  return NextResponse.json({ ok: true, will_expire_at: sub.current_period_end });
}
