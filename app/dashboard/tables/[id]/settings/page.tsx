import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TableSettingsClient from './TableSettingsClient';

export const metadata = { title: 'הגדרות טבלה · AllChatBoard' };

export default async function TableSettingsPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Load the table + verify membership in one query
  const { data: table } = await supabase
    .from('tables')
    .select('id, name, slug, icon, color, description, settings, workspace_id, ai_keywords')
    .eq('id', params.id)
    .maybeSingle();

  if (!table) notFound();

  // Verify the user has access to this workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', table.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) redirect('/dashboard');
  const isAdmin = ['owner', 'admin'].includes(membership.role);

  // Load fields (used for many tabs - field picker, datetime/phone detection, etc)
  const { data: fields } = await supabase
    .from('fields')
    .select('id, name, slug, type, position, options')
    .eq('table_id', params.id)
    .order('position', { ascending: true });

  return (
    <TableSettingsClient
      table={table}
      fields={fields || []}
      isAdmin={isAdmin}
    />
  );
}
