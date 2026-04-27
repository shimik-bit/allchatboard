import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import ReportClient from './ReportClient';

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: { tableId: string };
  searchParams: { saved?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select('*')
    .eq('id', params.tableId)
    .single();

  if (tableError || !table) notFound();

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', table.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) redirect('/dashboard');

  // Fetch fields, records, custom widgets, and saved reports in parallel
  const [
    { data: fields },
    { data: records },
    { data: widgets },
    { data: savedReports },
  ] = await Promise.all([
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
    supabase
      .from('saved_reports')
      .select('*')
      .eq('table_id', params.tableId)
      .order('created_at', { ascending: false }),
  ]);

  const canEdit = ['owner', 'admin', 'editor'].includes(membership.role);

  // If a specific saved report is requested, find it
  let initialReport = null;
  if (searchParams.saved && savedReports) {
    initialReport = savedReports.find(r => r.id === searchParams.saved) || null;
  }

  return (
    <ReportClient
      table={table}
      fields={fields || []}
      records={records || []}
      customWidgets={widgets || []}
      savedReports={savedReports || []}
      initialReport={initialReport}
      canEdit={canEdit}
      currentUserId={user.id}
    />
  );
}
