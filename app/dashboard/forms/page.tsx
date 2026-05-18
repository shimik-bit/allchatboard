import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { resolveActiveWorkspaceForUser } from '@/lib/permissions/active-workspace';
import FormsListClient from './FormsListClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'טפסים · TaskFlow AI',
};

export default async function FormsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const ws = await resolveActiveWorkspaceForUser();
  if (!ws) redirect('/dashboard');

  // Fetch the workspace's forms. RLS scopes by membership.
  const { data: forms } = await supabase
    .from('forms')
    .select(`
      id,
      table_id,
      slug,
      title,
      description,
      status,
      total_submissions,
      total_completed,
      last_submission_at,
      created_at,
      published_at
    `)
    .eq('workspace_id', ws.wsId)
    .order('created_at', { ascending: false });

  // Also fetch the workspace's tables so the "Create from table" button has options
  const { data: tables } = await supabase
    .from('tables')
    .select('id, name, icon')
    .eq('workspace_id', ws.wsId)
    .order('name');

  return (
    <FormsListClient
      forms={forms ?? []}
      tables={tables ?? []}
      workspaceId={ws.wsId}
    />
  );
}
