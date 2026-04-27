import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import KnowledgeClient from './KnowledgeClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function KnowledgePage({ searchParams }: { searchParams: { ws?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(id, name, icon, plan)')
    .eq('user_id', user.id)
    .in('role', ['owner', 'admin', 'editor']);

  if (!memberships || memberships.length === 0) redirect('/dashboard');

  let chosen = memberships[0];
  if (searchParams.ws) {
    const found = memberships.find((m: any) => m.workspace_id === searchParams.ws);
    if (found) chosen = found;
  }

  const workspace: any = Array.isArray(chosen.workspaces) ? chosen.workspaces[0] : chosen.workspaces;

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Check feature access
  const { data: hasFeature } = await service
    .rpc('has_workspace_feature', { p_workspace_id: workspace.id, p_feature_key: 'feature_knowledge_bot' });

  // Get or create bot
  const { data: bot } = await service
    .rpc('get_or_create_knowledge_bot', { p_workspace_id: workspace.id });

  // Get sources
  const { data: sources } = await service
    .from('knowledge_sources')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false });

  // Stats
  const { data: stats } = await service
    .rpc('get_knowledge_bot_stats', { p_workspace_id: workspace.id });

  // Instances for dedicated mode
  const { data: instances } = await service
    .from('whatsapp_instances')
    .select('id, provider_instance_id, state')
    .eq('workspace_id', workspace.id)
    .eq('state', 'authorized');

  const allWorkspaces = memberships.map((m: any) => {
    const ws = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
    return { id: ws.id, name: ws.name, icon: ws.icon };
  });

  return (
    <KnowledgeClient
      workspace={workspace}
      allWorkspaces={allWorkspaces}
      bot={bot}
      sources={sources || []}
      stats={stats}
      instances={instances || []}
      hasFeature={!!hasFeature}
      userRole={chosen.role as string}
    />
  );
}
