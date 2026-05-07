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

  // Get all memberships — mirrors the workspace switcher pattern from WhatsApp
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(*)')
    .eq('user_id', user.id);

  if (!memberships || memberships.length === 0) redirect('/onboarding');

  // Choose workspace: URL param if valid, otherwise first
  let chosenMembership = memberships[0];
  if (searchParams.ws) {
    const requested = memberships.find((m) => m.workspace_id === searchParams.ws);
    if (requested) chosenMembership = requested;
  }

  const workspace: any = Array.isArray(chosenMembership.workspaces)
    ? chosenMembership.workspaces[0]
    : chosenMembership.workspaces;

  const { data: bots } = await supabase
    .from('telegram_bots')
    .select(
      'id, bot_id, bot_username, bot_first_name, status, last_error, last_message_at, created_at'
    )
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false });

  const allWorkspaces = memberships.map((m) => {
    const ws = Array.isArray(m.workspaces) ? m.workspaces[0] : m.workspaces;
    return { id: ws.id, name: ws.name, icon: ws.icon };
  });

  return (
    <TelegramClient
      workspace={workspace}
      allWorkspaces={allWorkspaces}
      initialBots={bots || []}
      canEdit={chosenMembership.role === 'owner' || chosenMembership.role === 'admin'}
    />
  );
}
