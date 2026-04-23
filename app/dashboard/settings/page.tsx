import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
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
  const workspace: any = Array.isArray(membership.workspaces)
    ? membership.workspaces[0]
    : membership.workspaces;

  const { data: members } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('invited_at');

  return (
    <SettingsClient
      workspace={workspace}
      members={members || []}
      userId={user.id}
      userEmail={user.email || ''}
      myRole={membership.role}
    />
  );
}
