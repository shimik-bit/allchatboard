import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import BillingClient from './BillingClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { ws?: string; success?: string; error?: string; sub?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Get user's workspaces (only owner/admin)
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(id, name, icon, plan, plan_expires_at)')
    .eq('user_id', user.id)
    .in('role', ['owner', 'admin']);

  if (!memberships || memberships.length === 0) {
    redirect('/dashboard');
  }

  // Pick workspace from URL or default to first
  let chosenMembership = memberships[0];
  if (searchParams.ws) {
    const requested = memberships.find((m: any) => m.workspace_id === searchParams.ws);
    if (requested) chosenMembership = requested;
  }

  const workspace: any = Array.isArray(chosenMembership.workspaces)
    ? chosenMembership.workspaces[0]
    : chosenMembership.workspaces;

  // Get subscription info via service (RLS requires admin)
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: subscription } = await service
    .from('subscriptions')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: payments } = await service
    .from('payments')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })
    .limit(20);

  const allWorkspaces = memberships.map((m: any) => {
    const ws = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
    return { id: ws.id, name: ws.name, icon: ws.icon };
  });

  return (
    <BillingClient
      workspace={workspace}
      allWorkspaces={allWorkspaces}
      subscription={subscription}
      payments={payments || []}
      successFlag={searchParams.success === '1'}
      errorFlag={searchParams.error === '1'}
    />
  );
}
