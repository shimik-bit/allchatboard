import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import FocusClient from './FocusClient';

export const dynamic = 'force-dynamic';

export default async function FocusPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Get user's workspaces
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(id, name, icon)')
    .eq('user_id', user.id);

  if (!memberships || memberships.length === 0) {
    redirect('/onboarding');
  }

  // Get current role for first workspace
  const firstWorkspaceId = (memberships[0] as any).workspace_id;
  const { data: role } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', user.id)
    .eq('workspace_id', firstWorkspaceId)
    .maybeSingle();

  return (
    <FocusClient
      userId={user.id}
      memberships={memberships as any}
      initialWorkspaceId={firstWorkspaceId}
      currentRole={role}
    />
  );
}
