// app/dashboard/hub/crm/leads/page.tsx
//
// All-leads list with search + filter + sort. The Hub CRM had a Kanban and
// a Dashboard but no flat list — so users couldn't actually find a lead by
// name once it scrolled out of view. This is the canonical "search through
// my leads and open a customer file" surface.

import { createClient } from '@/lib/supabase/server';
import { resolveActiveWorkspaceForUser } from '@/lib/permissions/active-workspace';
import { redirect } from 'next/navigation';
import LeadsListClient from './LeadsListClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'לידים | TaskFlow' };

export default async function LeadsListPage() {
  const ws = await resolveActiveWorkspaceForUser();
  if (!ws) redirect('/dashboard/hub');

  const sb = createClient();

  // v_lead_360 is workspace-scoped via RLS. We also filter explicitly by the
  // resolved active workspace so toggling workspaces gives clean results.
  const { data: leads } = await sb
    .from('v_lead_360')
    .select('*')
    .eq('workspace_id', ws.wsId)
    .order('lead_updated_at', { ascending: false })
    .limit(500);

  return (
    <LeadsListClient
      initialLeads={(leads || []) as any[]}
      workspaceId={ws.wsId}
    />
  );
}
