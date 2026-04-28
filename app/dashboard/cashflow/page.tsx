import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CashflowClient from './CashflowClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CashflowPage({
  searchParams,
}: {
  searchParams: { ws?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(id, name, icon)')
    .eq('user_id', user.id);

  if (!memberships || memberships.length === 0) redirect('/dashboard');

  let chosen = memberships[0];
  if (searchParams.ws) {
    const found = memberships.find((m: any) => m.workspace_id === searchParams.ws);
    if (found) chosen = found;
  }
  const workspace: any = Array.isArray(chosen.workspaces) ? chosen.workspaces[0] : chosen.workspaces;

  // Check if cashflow template is installed
  const { data: cashflowTable } = await supabase
    .from('tables')
    .select('id')
    .eq('workspace_id', workspace.id)
    .eq('slug', 'cashflow_forecast')
    .maybeSingle();

  const isInstalled = !!cashflowTable;

  // Check plan supports cashflow
  const { data: ws } = await supabase
    .from('workspaces')
    .select('plan')
    .eq('id', workspace.id)
    .single();

  const { data: planLimits } = await supabase
    .from('plan_limits')
    .select('feature_cashflow, cashflow_forecast_days')
    .eq('plan', ws?.plan || 'trial')
    .single();

  return (
    <CashflowClient
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      isInstalled={isInstalled}
      cashflowTableId={cashflowTable?.id || null}
      featureEnabled={planLimits?.feature_cashflow || false}
      forecastHorizonDays={planLimits?.cashflow_forecast_days || 30}
      userRole={chosen.role}
    />
  );
}
