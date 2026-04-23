import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PhonesClient from './PhonesClient';

export default async function PhonesPage() {
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

  const { data: phones } = await supabase
    .from('authorized_phones')
    .select('*')
    .eq('workspace_id', membership.workspace_id)
    .order('created_at', { ascending: false });

  return (
    <PhonesClient
      workspaceId={membership.workspace_id}
      initialPhones={phones || []}
      canEdit={membership.role === 'owner' || membership.role === 'admin'}
    />
  );
}
