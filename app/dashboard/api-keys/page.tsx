import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ApiKeysClient from './ApiKeysClient';

export const metadata = { title: 'מפתחות API · AllChatBoard' };

export default async function ApiKeysPage() {
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

  return <ApiKeysClient workspace={workspace} isAdmin={isAdmin} />;
}
