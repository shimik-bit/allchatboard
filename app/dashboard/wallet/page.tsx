import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import WalletClient from './WalletClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WalletPage({ searchParams }: { searchParams: { ws?: string; topup?: string } }) {
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

  // Ensure wallet exists
  await service.rpc('get_or_create_wallet', { p_workspace_id: workspace.id });

  const { data: wallet } = await service
    .from('wallet_status').select('*').eq('workspace_id', workspace.id).single();

  const { data: settings } = await service
    .from('ai_pricing_settings').select('*').eq('id', 1).single();

  const { data: transactions } = await service
    .from('wallet_transactions')
    .select('id, type, amount_usd, amount_ils, balance_after_usd, description, created_at')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false }).limit(30);

  const allWorkspaces = memberships.map((m: any) => {
    const ws = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
    return { id: ws.id, name: ws.name, icon: ws.icon };
  });

  return (
    <WalletClient
      workspace={workspace}
      allWorkspaces={allWorkspaces}
      wallet={wallet}
      settings={settings}
      transactions={transactions || []}
      topupResult={searchParams.topup || null}
    />
  );
}
