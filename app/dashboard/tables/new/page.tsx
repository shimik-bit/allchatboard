import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import NewTableClient from './NewTableClient';

export default async function NewTablePage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) redirect('/onboarding');
  if (membership.role !== 'owner' && membership.role !== 'admin') {
    redirect('/dashboard');
  }

  return <NewTableClient workspaceId={membership.workspace_id} />;
}
