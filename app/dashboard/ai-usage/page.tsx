import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import AIUsageClient from './AIUsageClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AIUsagePage({ searchParams }: { searchParams: { ws?: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(id, name, icon)')
    .eq('user_id', user.id)
    .in('role', ['owner', 'admin']);

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

  const { data: summary } = await service
    .from('workspace_ai_usage_summary')
    .select('*')
    .eq('workspace_id', workspace.id)
    .single();

  const { data: byFeature } = await service
    .from('ai_usage_log')
    .select('feature, cost_ils, charged_ils')
    .eq('workspace_id', workspace.id)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const { data: daily } = await service
    .rpc('get_ai_usage_daily', { p_workspace_id: workspace.id, p_days: 30 });

  const { data: recent } = await service
    .from('ai_usage_log')
    .select('feature, ai_model, tokens_input, tokens_output, charged_ils, is_overage, created_at')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })
    .limit(20);

  const allWorkspaces = memberships.map((m: any) => {
    const ws = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
    return { id: ws.id, name: ws.name, icon: ws.icon };
  });

  return (
    <AIUsageClient
      workspace={workspace}
      allWorkspaces={allWorkspaces}
      summary={summary}
      byFeature={byFeature || []}
      daily={daily || []}
      recent={recent || []}
    />
  );
}
