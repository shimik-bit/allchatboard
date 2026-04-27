import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import InvoicesClient from './InvoicesClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InvoicesPage({ searchParams }: { searchParams: { ws?: string } }) {
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

  const { data: invoices } = await service
    .from('invoices')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('issued_at', { ascending: false });

  const allWorkspaces = memberships.map((m: any) => {
    const ws = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
    return { id: ws.id, name: ws.name, icon: ws.icon };
  });

  return <InvoicesClient workspace={workspace} allWorkspaces={allWorkspaces} invoices={invoices || []} />;
}
