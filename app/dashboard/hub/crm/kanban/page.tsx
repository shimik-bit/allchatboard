// app/dashboard/hub/crm/kanban/page.tsx
// CRM Kanban - Server Component שטוען לידים ומעביר ל-Client

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import KanbanBoard from './KanbanBoard';

export const metadata = { title: 'קנבן לידים | TaskFlow' };
export const dynamic = 'force-dynamic';

export default async function KanbanPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const cookieStore = cookies();
  const cookieWsId = cookieStore.get('tf_active_workspace')?.value;

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null);

  if (!memberships || memberships.length === 0) redirect('/onboarding');

  const wsId = cookieWsId && memberships.find((m: { workspace_id: string }) => m.workspace_id === cookieWsId)
    ? cookieWsId
    : memberships[0].workspace_id;

  // SECURITY: user-scoped client. Membership has been verified above.
  // Records and tables RLS will additionally enforce scoping.
  const { data: leadsTable } = await supabase
    .from('tables')
    .select('id')
    .eq('workspace_id', wsId)
    .eq('slug', 'leads')
    .maybeSingle();

  let leads: any[] = [];
  if (leadsTable) {
    const { data } = await supabase
      .from('records')
      .select('id, data, created_at, updated_at')
      .eq('table_id', leadsTable.id)
      .order('updated_at', { ascending: false });
    leads = data || [];
  }

  return <KanbanBoard initialLeads={leads} hasLeadsTable={!!leadsTable} />;
}
