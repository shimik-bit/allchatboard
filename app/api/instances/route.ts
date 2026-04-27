import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import {
  createInstance, setWebhook, hasPartnerToken,
} from '@/lib/instances/green-api-client';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/instances?workspace_id=xxx
 * List all instances for a workspace
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

  // Verify membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data: instances } = await supabase
    .from('whatsapp_instances')
    .select('id, display_name, provider, provider_instance_id, phone_number, state, state_message, state_updated_at, authorized_at, expires_at, messages_received_total, messages_sent_total, last_message_at, created_at, is_primary, is_shared')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    instances: instances || [],
    can_create_more: ['owner', 'admin'].includes(membership.role),
    partner_token_configured: hasPartnerToken(),
  });
}

/**
 * POST /api/instances
 * Body: { workspace_id, display_name, plan?, manual? }
 * 
 * If manual=true: creates a row but doesn't call Green API (user provides
 *                 instance_id + token from outside)
 * If manual=false: auto-provisions via Partner API
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const {
    workspace_id, display_name, plan = 'developer', manual = false,
    manual_instance_id, manual_token,
  } = body;

  if (!workspace_id || !display_name) {
    return NextResponse.json({ error: 'workspace_id and display_name required' }, { status: 400 });
  }

  // Verify admin/owner
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Only workspace owners/admins can create instances' }, { status: 403 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // ─── Manual mode: user provides credentials ───
  if (manual) {
    if (!manual_instance_id || !manual_token) {
      return NextResponse.json({
        error: 'manual_instance_id and manual_token required for manual mode'
      }, { status: 400 });
    }

    // Check if this workspace already has any instance — if not, mark the new one as primary
    const { count: existingCount } = await service
      .from('whatsapp_instances')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace_id);

    const shouldBePrimary = !existingCount || existingCount === 0;

    const { data: instance, error } = await service
      .from('whatsapp_instances')
      .insert({
        workspace_id,
        provider: 'green_api',
        provider_instance_id: String(manual_instance_id),
        provider_token: manual_token,
        display_name,
        state: 'authorized', // Assume working since user provided credentials
        created_by: user.id,
        is_primary: shouldBePrimary,
      })
      .select()
      .single();

    if (error) {
      // Check if it's a unique constraint violation - duplicate instance ID
      if (error.code === '23505') {
        // Find the existing instance to give better error
        const { data: existingInstance } = await service
          .from('whatsapp_instances')
          .select('id, workspace_id, display_name, is_shared, workspaces(name)')
          .eq('provider', 'green_api')
          .eq('provider_instance_id', String(manual_instance_id))
          .maybeSingle();

        if (existingInstance) {
          const ws: any = Array.isArray(existingInstance.workspaces)
            ? existingInstance.workspaces[0]
            : existingInstance.workspaces;
          return NextResponse.json({
            error: `Instance ID ${manual_instance_id} כבר משויך לסביבה "${ws?.name || '?'}". כדי לחבר את אותו instance לסביבה זו, צריכה להיות אישור מסופר אדמין דרך /admin/instances.`,
            duplicate: true,
            existing_instance_id: existingInstance.id,
            existing_workspace_name: ws?.name,
            existing_is_shared: existingInstance.is_shared,
          }, { status: 409 });
        }
        return NextResponse.json({
          error: 'Instance ID זה כבר רשום במערכת.'
        }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also try to set the webhook automatically
    try {
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://taskflow-ai.com'}/api/whatsapp/webhook?workspace=${workspace_id}`;
      await setWebhook(String(manual_instance_id), manual_token, webhookUrl);

      await service.from('instance_provisioning_log').insert({
        instance_id: instance.id,
        workspace_id,
        user_id: user.id,
        action: 'webhook_set',
        details: { webhook_url: webhookUrl },
      });
    } catch (err: any) {
      console.warn('Failed to auto-set webhook:', err.message);
    }

    return NextResponse.json({ instance });
  }

  // ─── Auto-provision mode: requires Partner token ───
  if (!hasPartnerToken()) {
    return NextResponse.json({
      error: 'יצירה אוטומטית דורשת הגדרת Partner Token של Green API. צור instance ידנית במקום.',
      partner_token_missing: true,
    }, { status: 503 });
  }

  // Log start
  const { data: logRow } = await service.from('instance_provisioning_log').insert({
    workspace_id,
    user_id: user.id,
    action: 'provision_start',
    details: { display_name, plan },
  }).select('id').single();

  try {
    // Step 1: Create instance via Partner API
    const greenInstance = await createInstance({
      paymentType: plan,
      email: user.email,
    });

    const providerInstanceId = String(greenInstance.idInstance);

    // Step 2: Save to DB
    const { data: instance, error: insertError } = await service
      .from('whatsapp_instances')
      .insert({
        workspace_id,
        provider: 'green_api',
        provider_instance_id: providerInstanceId,
        provider_token: greenInstance.apiTokenInstance,
        provider_plan: greenInstance.typeInstance,
        provider_metadata: greenInstance,
        display_name,
        state: 'awaiting_qr',
        created_by: user.id,
        expires_at: greenInstance.paymentExpiredDate
          ? new Date(greenInstance.paymentExpiredDate * 1000).toISOString()
          : null,
      })
      .select()
      .single();

    if (insertError || !instance) {
      throw new Error(insertError?.message || 'Failed to save instance');
    }

    // Step 3: Set webhook URL automatically
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://taskflow-ai.com'}/api/whatsapp/webhook?workspace=${workspace_id}`;
    try {
      await setWebhook(providerInstanceId, greenInstance.apiTokenInstance, webhookUrl);
    } catch (webhookErr: any) {
      console.warn('Webhook setup failed (non-fatal):', webhookErr.message);
    }

    // Log success
    await service.from('instance_provisioning_log').insert({
      instance_id: instance.id,
      workspace_id,
      user_id: user.id,
      action: 'provision_success',
      details: {
        provider_instance_id: providerInstanceId,
        plan: greenInstance.typeInstance,
        webhook_url: webhookUrl,
      },
    });

    return NextResponse.json({ instance });
  } catch (err: any) {
    // Log failure
    if (logRow) {
      await service.from('instance_provisioning_log').insert({
        workspace_id,
        user_id: user.id,
        action: 'provision_fail',
        error_message: err.message,
        details: { display_name, plan },
      });
    }

    return NextResponse.json({
      error: err.message || 'Failed to provision instance'
    }, { status: 500 });
  }
}
