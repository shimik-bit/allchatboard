import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import WhatsAppClient from './WhatsAppClient';

export const dynamic = 'force-dynamic';

export default async function WhatsAppPage({
  searchParams,
}: {
  searchParams: { ws?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Get ALL memberships
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(*)')
    .eq('user_id', user.id);

  if (!memberships || memberships.length === 0) redirect('/onboarding');

  // Determine which workspace to show:
  // 1. URL param ?ws=xxx if provided and user is a member
  // 2. Workspace with the most groups (most useful for WhatsApp page)
  // 3. First workspace as fallback
  
  let chosenMembership = memberships[0];
  
  if (searchParams.ws) {
    const requested = memberships.find(m => m.workspace_id === searchParams.ws);
    if (requested) chosenMembership = requested;
  } else {
    // Pick workspace with most groups - more useful for WhatsApp page
    const workspaceIds = memberships.map(m => m.workspace_id);
    const { data: groupCounts } = await supabase
      .from('whatsapp_groups')
      .select('workspace_id')
      .in('workspace_id', workspaceIds);
    
    const counts = new Map<string, number>();
    for (const g of (groupCounts || []) as any[]) {
      counts.set(g.workspace_id, (counts.get(g.workspace_id) || 0) + 1);
    }
    
    const winnerWsId = workspaceIds.reduce((best, wsId) => 
      (counts.get(wsId) || 0) > (counts.get(best) || 0) ? wsId : best
    , workspaceIds[0]);
    
    const winner = memberships.find(m => m.workspace_id === winnerWsId);
    if (winner) chosenMembership = winner;
  }

  const workspace: any = Array.isArray(chosenMembership.workspaces)
    ? chosenMembership.workspaces[0]
    : chosenMembership.workspaces;

  const [{ data: messages }, { data: groups }] = await Promise.all([
    supabase
      .from('wa_messages')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('received_at', { ascending: false })
      .limit(50),
    supabase
      .from('whatsapp_groups')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at'),
  ]);

  // List of all workspaces for selector
  const allWorkspaces = memberships.map(m => {
    const ws = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
    return { id: ws.id, name: ws.name, icon: ws.icon };
  });

  return (
    <WhatsAppClient
      workspace={workspace}
      allWorkspaces={allWorkspaces}
      initialMessages={messages || []}
      initialGroups={groups || []}
      canEdit={chosenMembership.role === 'owner' || chosenMembership.role === 'admin'}
    />
  );
}
