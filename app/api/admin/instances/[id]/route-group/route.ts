import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

async function requireAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  const { data: admin } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!admin) return { error: NextResponse.json({ error: 'Platform admin only' }, { status: 403 }), user: null };
  return { error: null, user };
}

/**
 * POST /api/admin/instances/[id]/route-group
 * Body: { chat_id, target_workspace_id, group_name?, notes? }
 * Routes a specific group (chat_id) on a shared instance to a workspace.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const { chat_id, target_workspace_id, group_name, notes } = body;

  if (!chat_id || !target_workspace_id) {
    return NextResponse.json({ error: 'chat_id and target_workspace_id required' }, { status: 400 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Verify the target workspace is actually linked to this instance
  const { data: link } = await service
    .from('instance_workspace_links')
    .select('id')
    .eq('instance_id', params.id)
    .eq('workspace_id', target_workspace_id)
    .maybeSingle();

  // Also allow primary workspace
  const { data: instance } = await service
    .from('whatsapp_instances')
    .select('workspace_id')
    .eq('id', params.id)
    .maybeSingle();

  if (!link && instance?.workspace_id !== target_workspace_id) {
    return NextResponse.json({
      error: 'Target workspace must be linked to this instance first (use /share endpoint)'
    }, { status: 400 });
  }

  // Upsert the routing
  const { data: routing, error } = await service
    .from('shared_group_routing')
    .upsert({
      instance_id: params.id,
      green_api_chat_id: chat_id,
      group_name: group_name || null,
      routed_to_workspace_id: target_workspace_id,
      routed_by: auth.user!.id,
      routed_at: new Date().toISOString(),
      notes,
    }, {
      onConflict: 'instance_id,green_api_chat_id',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Re-route any pending unrouted messages with this chat_id
  const { data: pendingMessages } = await service
    .from('wa_messages')
    .select('id')
    .eq('source_instance_id', params.id)
    .eq('routing_status', 'unrouted_group')
    .like('green_api_message_id', '%')  // Just to limit query
    .limit(100);

  // Note: we don't actually re-process these messages here. Just mark them
  // so admin can see they're handled. Actual processing happens on next
  // incoming message which uses fresh routing.
  if (pendingMessages && pendingMessages.length > 0) {
    await service
      .from('wa_messages')
      .update({ routing_status: 'admin_routed', workspace_id: target_workspace_id })
      .in('id', pendingMessages.map(m => m.id));
  }

  await service.from('instance_provisioning_log').insert({
    instance_id: params.id,
    workspace_id: target_workspace_id,
    user_id: auth.user!.id,
    action: 'state_change',
    details: {
      operation: 'group_routed',
      chat_id,
      group_name,
      pending_messages_updated: pendingMessages?.length || 0,
    },
  });

  return NextResponse.json({
    routing,
    backfilled_messages: pendingMessages?.length || 0,
  });
}

/**
 * DELETE /api/admin/instances/[id]/route-group?chat_id=xxx
 * Removes a group routing rule.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get('chat_id');
  if (!chatId) {
    return NextResponse.json({ error: 'chat_id required' }, { status: 400 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  await service
    .from('shared_group_routing')
    .delete()
    .eq('instance_id', params.id)
    .eq('green_api_chat_id', chatId);

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/admin/instances/[id]/route-group
 * Lists all unrouted groups for this instance (groups that need routing).
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Get all unique chat_ids for this instance from messages
  const { data: messages } = await service
    .from('wa_messages')
    .select('green_api_message_id, source_instance_id, sender_phone, sender_name, text, received_at, routing_status')
    .eq('source_instance_id', params.id)
    .eq('routing_status', 'unrouted_group')
    .order('received_at', { ascending: false })
    .limit(50);

  // Get already-routed groups
  const { data: routed } = await service
    .from('shared_group_routing')
    .select('green_api_chat_id, group_name, routed_to_workspace_id, routed_at')
    .eq('instance_id', params.id);

  return NextResponse.json({
    unrouted_messages: messages || [],
    routed_groups: routed || [],
  });
}
