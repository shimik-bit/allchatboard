import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TelegramClient from './TelegramClient';

export const dynamic = 'force-dynamic';

export default async function TelegramPage({
  searchParams,
}: {
  searchParams: { ws?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(*)')
    .eq('user_id', user.id);

  if (!memberships || memberships.length === 0) redirect('/onboarding');

  // Determine which workspace to show:
  // 1. URL param ?ws=xxx if provided and user is a member
  // 2. First workspace as fallback
  let chosen = memberships[0];
  if (searchParams.ws) {
    const requested = memberships.find((m) => m.workspace_id === searchParams.ws);
    if (requested) chosen = requested;
  }

  const workspace: any = Array.isArray(chosen.workspaces)
    ? chosen.workspaces[0]
    : chosen.workspaces;

  const canEdit = chosen.role === 'owner' || chosen.role === 'admin';

  return (
    <TelegramClient
      workspaceId={chosen.workspace_id}
      workspaceName={workspace?.name || ''}
      canEdit={canEdit}
    />
  );
}
