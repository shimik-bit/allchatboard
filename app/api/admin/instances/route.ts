import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/instances
 * Returns all instances across the platform with workspace links + shared group routing.
 * Super admin only.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify platform admin
  const { data: isPlatformAdmin } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!isPlatformAdmin) {
    return NextResponse.json({ error: 'Platform admin only' }, { status: 403 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Get all instances with workspace info
  const { data: instances } = await service
    .from('whatsapp_instances')
    .select(`
      id, provider, provider_instance_id, display_name, phone_number,
      state, state_message, state_updated_at,
      is_shared, shared_at, shared_note,
      created_at, authorized_at, expires_at,
      messages_received_total, messages_sent_total, last_message_at,
      workspace_id,
      workspaces!whatsapp_instances_workspace_id_fkey(id, name, icon)
    `)
    .order('created_at', { ascending: false });

  // For shared instances, get all linked workspaces + routing info
  const sharedInstanceIds = (instances || [])
    .filter((i: any) => i.is_shared)
    .map((i: any) => i.id);

  let links: any[] = [];
  let routings: any[] = [];
  if (sharedInstanceIds.length > 0) {
    const { data: linksData } = await service
      .from('instance_workspace_links')
      .select(`
        id, instance_id, workspace_id, workspace_display_name, priority, linked_at, notes,
        workspaces(id, name, icon)
      `)
      .in('instance_id', sharedInstanceIds);
    links = linksData || [];

    const { data: routingData } = await service
      .from('shared_group_routing')
      .select(`
        id, instance_id, green_api_chat_id, group_name,
        routed_to_workspace_id, routed_at,
        workspaces:routed_to_workspace_id(id, name, icon)
      `)
      .in('instance_id', sharedInstanceIds);
    routings = routingData || [];
  }

  // Get unrouted message counts per instance
  const { data: unroutedCounts } = await service
    .from('wa_messages')
    .select('source_instance_id', { count: 'exact', head: false })
    .in('routing_status', ['unrouted_dm', 'unrouted_group']);

  const unroutedMap = new Map<string, number>();
  for (const r of unroutedCounts || []) {
    if ((r as any).source_instance_id) {
      const key = (r as any).source_instance_id;
      unroutedMap.set(key, (unroutedMap.get(key) || 0) + 1);
    }
  }

  // Enrich
  const enriched = (instances || []).map((inst: any) => {
    const ws = Array.isArray(inst.workspaces) ? inst.workspaces[0] : inst.workspaces;
    return {
      ...inst,
      workspace: ws,
      workspaces: undefined,
      linked_workspaces: links
        .filter(l => l.instance_id === inst.id)
        .map(l => ({
          link_id: l.id,
          workspace: Array.isArray(l.workspaces) ? l.workspaces[0] : l.workspaces,
          display_name: l.workspace_display_name,
          priority: l.priority,
          linked_at: l.linked_at,
          notes: l.notes,
        })),
      routed_groups: routings
        .filter(r => r.instance_id === inst.id)
        .map(r => ({
          routing_id: r.id,
          chat_id: r.green_api_chat_id,
          group_name: r.group_name,
          target_workspace: Array.isArray(r.workspaces) ? r.workspaces[0] : r.workspaces,
          routed_at: r.routed_at,
        })),
      unrouted_messages_count: unroutedMap.get(inst.id) || 0,
    };
  });

  return NextResponse.json({
    instances: enriched,
    summary: {
      total: enriched.length,
      shared: enriched.filter((i: any) => i.is_shared).length,
      unrouted_total: Array.from(unroutedMap.values()).reduce((a, b) => a + b, 0),
    },
  });
}
