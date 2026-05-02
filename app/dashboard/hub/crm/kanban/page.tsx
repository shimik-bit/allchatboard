// app/dashboard/hub/crm/kanban/page.tsx
// CRM Kanban - Server Component שטוען לידים ומעביר ל-Client

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import KanbanBoard from './KanbanBoard';

export const metadata = { title: 'קנבן לידים | TaskFlow' };
export const dynamic = 'force-dynamic';

export default async function KanbanPage() {
  // 1. אימות
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // 2. workspace
  const cookieStore = cookies();
  const cookieWsId = cookieStore.get('tf_active_workspace')?.value;
  
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id);
  
  if (!memberships || memberships.length === 0) redirect('/onboarding');
  
  const wsId = cookieWsId && memberships.find(m => m.workspace_id === cookieWsId)
    ? cookieWsId
    : memberships[0].workspace_id;

  // 3. שליפת הלידים
  const admin = createAdminClient();
  
  // מציאת טבלת leads ב-workspace הזה
  const { data: leadsTable } = await admin
    .from('tables')
    .select('id')
    .eq('workspace_id', wsId)
    .eq('slug', 'leads')
    .maybeSingle();

  let leads: any[] = [];
  if (leadsTable) {
    const { data } = await admin
      .from('records')
      .select('id, data, created_at, updated_at')
      .eq('table_id', leadsTable.id)
      .order('updated_at', { ascending: false });
    leads = data || [];
  }

  return <KanbanBoard initialLeads={leads} hasLeadsTable={!!leadsTable} />;
}
