import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AutomationsClient from './AutomationsClient';

export const metadata = { title: 'אוטומציות · AllChatBoard' };

export default async function AutomationsPage() {
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

  // Pre-fetch tables for all the modals
  const { data: tables } = await supabase
    .from('tables')
    .select('id, name, icon')
    .eq('workspace_id', workspace.id)
    .eq('is_archived', false)
    .order('position');

  return (
    <AutomationsClient
      workspace={workspace}
      tables={tables || []}
      isAdmin={isAdmin}
    />
  );
}
