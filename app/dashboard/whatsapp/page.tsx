import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import WhatsAppClient from './WhatsAppClient';

export default async function WhatsAppPage() {
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

  const [{ data: messages }, { data: groups }] = await Promise.all([
    supabase
      .from('wa_messages')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('received_at', { ascending: false })
      .limit(50),
    supabase
      .from('whatsapp_groups')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at'),
  ]);

  return (
    <WhatsAppClient
      workspace={workspace}
      initialMessages={messages || []}
      initialGroups={groups || []}
      canEdit={membership.role === 'owner' || membership.role === 'admin'}
    />
  );
}
