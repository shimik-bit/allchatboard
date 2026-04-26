import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ReportsClient from './ReportsClient';

export const metadata = { title: 'דוחות מתוזמנים · AllChatBoard' };

export default async function ReportsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(*)')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership?.workspaces) redirect('/onboarding');

  const workspace = Array.isArray(membership.workspaces) ? membership.workspaces[0] : membership.workspaces;
  const isAdmin = ['owner', 'admin'].includes(membership.role);

  return <ReportsClient workspace={workspace} isAdmin={isAdmin} />;
}
