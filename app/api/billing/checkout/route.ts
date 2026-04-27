import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createLowProfileSession, usdToIls, isCardcomConfigured } from '@/lib/cardcom/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/billing/checkout
 * Body: { workspace_id }
 * 
 * Creates a Cardcom Low Profile session for the user to pay.
 * Returns a redirect URL.
 */
export async function POST(req: NextRequest) {
  if (!isCardcomConfigured()) {
    return NextResponse.json({
      error: 'Cardcom not configured. Add CARDCOM_USERNAME and CARDCOM_API_PASSWORD to env.',
    }, { status: 500 });
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { workspace_id } = body;
  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }

  // Verify user is owner/admin of this workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Only workspace owners and admins can manage billing' }, { status: 403 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Get workspace info
  const { data: workspace } = await service
    .from('workspaces')
    .select('id, name')
    .eq('id', workspace_id)
    .maybeSingle();
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  // Check if there's already an active subscription
  const { data: existingSub } = await service
    .from('subscriptions')
    .select('id, status')
    .eq('workspace_id', workspace_id)
    .in('status', ['active', 'past_due'])
    .maybeSingle();

  if (existingSub) {
    return NextResponse.json({
      error: 'יש כבר מנוי פעיל לסביבה הזו. בטל אותו לפני שתפתח חדש.',
      existing_subscription_id: existingSub.id,
    }, { status: 409 });
  }

  // Create a pending subscription record
  const amountUsd = 15;
  const amountIls = usdToIls(amountUsd);

  const { data: subscription, error: subError } = await service
    .from('subscriptions')
    .insert({
      workspace_id,
      status: 'pending',
      amount_usd: amountUsd,
      amount_ils: amountIls,
      currency: 'USD',
      billing_period: 'monthly',
      created_by: user.id,
      customer_email: user.email,
    })
    .select()
    .single();

  if (subError) {
    return NextResponse.json({ error: subError.message }, { status: 500 });
  }

  // Build redirect URLs
  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`;
  const successUrl = `${origin}/dashboard/billing?success=1&sub=${subscription.id}`;
  const errorUrl = `${origin}/dashboard/billing?error=1&sub=${subscription.id}`;
  const webhookUrl = `${origin}/api/billing/webhook?sub=${subscription.id}`;

  try {
    const session = await createLowProfileSession({
      amount: amountIls,
      productName: `TaskFlow AI Pro - מנוי חודשי לסביבת ${workspace.name}`,
      successUrl,
      errorUrl,
      webhookUrl,
      customerEmail: user.email || undefined,
      externalUniqTransactionId: subscription.id,
      isRecurring: true,            // Creates a token for monthly recharges
      metadata: {
        workspace_id,
        subscription_id: subscription.id,
        user_id: user.id,
      },
    });

    // Save the LowProfileId to the subscription
    await service
      .from('subscriptions')
      .update({ cardcom_low_profile_id: session.lowProfileId })
      .eq('id', subscription.id);

    // Log
    await service.from('billing_events').insert({
      workspace_id,
      subscription_id: subscription.id,
      event_type: 'checkout.created',
      details: { low_profile_id: session.lowProfileId, amount_ils: amountIls },
      source: 'api',
    });

    return NextResponse.json({
      checkout_url: session.url,
      subscription_id: subscription.id,
    });
  } catch (err: any) {
    // Mark subscription as failed
    await service
      .from('subscriptions')
      .update({ status: 'expired', notes: `Cardcom error: ${err.message}` })
      .eq('id', subscription.id);

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
