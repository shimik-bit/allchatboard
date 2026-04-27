import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import {
  deleteInstance as deleteFromGreenApi,
  logoutInstance,
  setWebhook,
} from '@/lib/instances/green-api-client';

export const runtime = 'nodejs';

/**
 * GET /api/instances/[id]
 * Get single instance details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: instance, error } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (error || !instance) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // RLS already verifies access, but double-check
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', instance.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Don't return the token in the response - it's sensitive
  // Only show last 4 chars
  const safeInstance = {
    ...instance,
    provider_token: instance.provider_token
      ? `••••${instance.provider_token.slice(-4)}`
      : null,
  };

  return NextResponse.json({
    instance: safeInstance,
    can_edit: ['owner', 'admin'].includes(membership.role),
  });
}

/**
 * PATCH /api/instances/[id]
 * Update display_name, state (pause/resume), or rotate webhook
 * Body: { display_name?, paused?, rotate_webhook? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { display_name, paused, rotate_webhook } = body;

  // Get instance + verify owner/admin
  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (!instance) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', instance.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const updates: any = {};

  if (typeof display_name === 'string' && display_name.trim()) {
    updates.display_name = display_name.trim();
  }

  if (typeof paused === 'boolean') {
    updates.state = paused ? 'paused' : 'authorized';
    updates.state_updated_at = new Date().toISOString();
    updates.state_message = paused ? 'הושעה ידנית' : 'הופעל מחדש';
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await service
      .from('whatsapp_instances')
      .update(updates)
      .eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Log it
    await service.from('instance_provisioning_log').insert({
      instance_id: params.id,
      workspace_id: instance.workspace_id,
      user_id: user.id,
      action: 'state_change',
      state_before: instance.state,
      state_after: updates.state || instance.state,
      details: updates,
    });
  }

  // Re-set webhook if requested (e.g. domain changed)
  if (rotate_webhook) {
    try {
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://taskflow-ai.com'}/api/whatsapp/webhook?workspace=${instance.workspace_id}`;
      await setWebhook(instance.provider_instance_id, instance.provider_token, webhookUrl);

      await service.from('instance_provisioning_log').insert({
        instance_id: params.id,
        workspace_id: instance.workspace_id,
        user_id: user.id,
        action: 'webhook_set',
        details: { webhook_url: webhookUrl, rotated: true },
      });
    } catch (err: any) {
      return NextResponse.json({ error: 'Webhook update failed: ' + err.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/instances/[id]?mode=logout|delete
 *
 * - mode=logout (default): just disconnects WhatsApp, keeps instance for re-auth
 * - mode=delete: full deletion - removes from Green API + DB
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') || 'logout';

  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (!instance) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', instance.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Safeguard: block deletion of primary if other instances exist (must promote first)
  if (instance.is_primary) {
    const { count: siblingCount } = await supabase
      .from('whatsapp_instances')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', instance.workspace_id)
      .neq('id', params.id);

    if ((siblingCount || 0) > 0) {
      return NextResponse.json({
        error: 'לא ניתן למחוק את ה-instance הראשי כשיש instances נוספים בסביבה. הפוך instance אחר לראשי קודם.'
      }, { status: 400 });
    }
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  await service.from('instance_provisioning_log').insert({
    instance_id: params.id,
    workspace_id: instance.workspace_id,
    user_id: user.id,
    action: 'delete_request',
    details: { mode },
  });

  if (mode === 'logout') {
    // Just logout from WhatsApp, keep the instance row for re-auth
    try {
      await logoutInstance(instance.provider_instance_id, instance.provider_token);
    } catch (err) {
      // Continue even if logout fails
    }

    await service.from('whatsapp_instances')
      .update({
        state: 'expired',
        state_message: 'נותק על ידי המשתמש',
        state_updated_at: new Date().toISOString(),
      })
      .eq('id', params.id);

    return NextResponse.json({ ok: true, mode: 'logout' });
  }

  // Full delete: try to remove from Green API, then DB
  try {
    await deleteFromGreenApi(instance.provider_instance_id);
  } catch (err: any) {
    // Log but don't fail - we still want to remove from our DB
    console.warn('Green API delete failed:', err.message);
  }

  await service.from('instance_provisioning_log').insert({
    instance_id: params.id,
    workspace_id: instance.workspace_id,
    user_id: user.id,
    action: 'deleted',
    details: { mode },
  });

  // Mark as deleted (don't actually delete the row - keep for audit)
  await service.from('whatsapp_instances')
    .update({
      state: 'deleted',
      state_message: 'נמחק על ידי המשתמש',
      state_updated_at: new Date().toISOString(),
    })
    .eq('id', params.id);

  return NextResponse.json({ ok: true, mode: 'delete' });
}
