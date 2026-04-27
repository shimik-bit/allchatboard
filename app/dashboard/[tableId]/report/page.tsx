import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import ReportClient from './ReportClient';

export default async function ReportPage({
  params,
}: {
  params: { tableId: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Get table and verify access
  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select('*')
    .eq('id', params.tableId)
    .single();

  if (tableError || !table) notFound();

  // Check membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', table.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) redirect('/dashboard');

  // Fetch fields, records, custom widgets in parallel
  const [{ data: fields }, { data: records }, { data: widgets }] = await Promise.all([
    supabase
      .from('fields')
      .select('*')
      .eq('table_id', params.tableId)
      .order('position'),
    supabase
      .from('records')
      .select('*')
      .eq('table_id', params.tableId)
      .order('created_at', { ascending: false }),
    supabase
      .from('dashboard_widgets')
      .select('*')
      .eq('table_id', params.tableId)
      .order('position'),
  ]);

  const canEdit = ['owner', 'admin', 'editor'].includes(membership.role);

  return (
    <ReportClient
      table={table}
      fields={fields || []}
      records={records || []}
      customWidgets={widgets || []}
      canEdit={canEdit}
    />
  );
}
