import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { requireSuperAdmin } from '@/lib/groupguard/super-admin';
import GroupGuardClient from './GroupGuardClient';

export default async function GroupGuardPage() {
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

  const canEdit = membership.role === 'owner' || membership.role === 'admin';

  // Check if super-admin (for showing admin link)
  const superAdmin = await requireSuperAdmin(supabase);
  const isSuperAdmin = superAdmin !== null;

  return (
    <GroupGuardClient
      workspaceId={workspace.id}
      workspaceName={workspace.name}
      canEdit={canEdit}
      isSuperAdmin={isSuperAdmin}
    />
  );
}
