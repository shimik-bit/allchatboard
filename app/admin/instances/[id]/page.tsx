import { adminServiceClient } from '@/lib/admin/auth';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Smartphone, Share2, ChevronLeft, AlertCircle, MessageSquare, Building2 } from 'lucide-react';
import InstanceShareControls from './InstanceShareControls';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InstanceDetailPage({ params }: { params: { id: string } }) {
  const supabase = adminServiceClient();

  // Fetch instance
  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select(`
      id, provider, provider_instance_id, provider_token, provider_plan,
      display_name, phone_number, state, state_message, state_updated_at,
      is_shared, shared_at, shared_note,
      created_at, authorized_at, expires_at,
      messages_received_total, messages_sent_total, last_message_at,
      workspace_id,
      workspaces!whatsapp_instances_workspace_id_fkey(id, name, icon)
    `)
    .eq('id', params.id)
    .maybeSingle();

  if (!instance) notFound();

  // Get all workspaces (for the linking dropdown)
  const { data: allWorkspaces } = await supabase
    .from('workspaces')
    .select('id, name, icon')
    .order('name');

  // Get current links
  const { data: links } = await supabase
    .from('instance_workspace_links')
    .select(`
      id, workspace_id, workspace_display_name, priority, linked_at, notes,
      workspaces!instance_workspace_links_workspace_id_fkey(id, name, icon)
    `)
    .eq('instance_id', params.id);

  // Get group routing
  const { data: groupRoutes } = await supabase
    .from('shared_group_routing')
    .select(`
      id, green_api_chat_id, group_name, routed_to_workspace_id, routed_at, notes,
      workspaces:routed_to_workspace_id(id, name, icon)
    `)
    .eq('instance_id', params.id)
    .order('routed_at', { ascending: false });

  // Get unrouted messages (for the routing UI)
  const { data: unroutedMessages } = await supabase
    .from('wa_messages')
    .select('id, sender_phone, sender_name, text, received_at, routing_status, group_id')
    .eq('source_instance_id', params.id)
    .in('routing_status', ['unrouted_dm', 'unrouted_group'])
    .order('received_at', { ascending: false })
    .limit(30);

  const ws: any = Array.isArray(instance.workspaces) ? instance.workspaces[0] : instance.workspaces;
  const isShared = instance.is_shared;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <Link href="/admin/instances" className="text-xs text-slate-500 hover:text-amber-500 inline-flex items-center gap-1 mb-2">
            <ChevronLeft className="w-3 h-3" />
            חזרה לרשימת Instances
          </Link>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl grid place-items-center ${
              isShared ? 'bg-purple-900/40 text-purple-300' : 'bg-slate-800 text-slate-400'
            }`}>
              {isShared ? <Share2 className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{instance.display_name}</h1>
              <p className="text-sm text-slate-400 font-mono">{instance.provider_instance_id}</p>
            </div>
          </div>
        </div>

        {/* Instance info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-slate-500 mb-1">סטטוס</div>
            <div className="text-sm font-bold">
              {instance.state === 'authorized' ? '✓ מחובר' : instance.state}
            </div>
            {instance.state_message && (
              <div className="text-xs text-slate-400 mt-1">{instance.state_message}</div>
            )}
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-slate-500 mb-1">מספר טלפון</div>
            <div className="text-sm font-mono" dir="ltr">
              {instance.phone_number || '—'}
            </div>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <div className="text-xs text-slate-500 mb-1">הודעות שהתקבלו</div>
            <div className="text-sm font-bold">
              {(instance.messages_received_total || 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Primary workspace */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-5 mb-6">
          <h2 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            סביבה ראשית
          </h2>
          <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg">
            <div className="text-2xl">{ws?.icon || '📊'}</div>
            <div className="flex-1">
              <div className="font-semibold">{ws?.name || '?'}</div>
              <div className="text-xs text-slate-400 font-mono">{instance.workspace_id}</div>
            </div>
            <Link
              href={`/admin/workspaces/${instance.workspace_id}`}
              className="text-xs text-amber-500 hover:underline"
            >
              לדף הסביבה
            </Link>
          </div>
        </div>

        {/* Sharing controls (client component) */}
        <InstanceShareControls
          instanceId={params.id}
          instanceDisplayName={instance.display_name}
          isShared={isShared}
          primaryWorkspace={ws ? { id: ws.id, name: ws.name, icon: ws.icon } : null}
          allWorkspaces={(allWorkspaces || []).filter((w: any) => w.id !== instance.workspace_id)}
          links={(links || []).map((l: any) => ({
            id: l.id,
            workspace: Array.isArray(l.workspaces) ? l.workspaces[0] : l.workspaces,
            display_name: l.workspace_display_name,
            priority: l.priority,
            linked_at: l.linked_at,
            notes: l.notes,
          }))}
          routedGroups={(groupRoutes || []).map((g: any) => ({
            id: g.id,
            chat_id: g.green_api_chat_id,
            group_name: g.group_name,
            target_workspace: Array.isArray(g.workspaces) ? g.workspaces[0] : g.workspaces,
            routed_at: g.routed_at,
          }))}
          unroutedMessages={(unroutedMessages || []).map((m: any) => ({
            id: m.id,
            sender: m.sender_name || m.sender_phone,
            text: (m.text || '').slice(0, 100),
            received_at: m.received_at,
            routing_status: m.routing_status,
          }))}
        />

      </div>
    </div>
  );
}
