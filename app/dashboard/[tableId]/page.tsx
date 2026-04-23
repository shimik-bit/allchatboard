import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import TableClient from './TableClient';

export default async function TablePage({
  params,
  searchParams,
}: {
  params: { tableId: string };
  searchParams: { focus?: string };
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

  // Check user is member of this workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', table.workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) redirect('/dashboard');

  // Fetch fields, records (enriched), views in parallel
  const [{ data: fields }, { data: rawRecords }, { data: views }, { data: phones }] = await Promise.all([
    supabase
      .from('fields')
      .select('*')
      .eq('table_id', params.tableId)
      .order('position'),
    supabase
      .from('records')
      .select(`
        *,
        authorized_phones:authorized_phone_id(display_name, job_title),
        assignee:assignee_phone_id(display_name, job_title)
      `)
      .eq('table_id', params.tableId)
      .order('created_at', { ascending: false }),
    supabase
      .from('views')
      .select('*')
      .eq('table_id', params.tableId)
      .order('created_at'),
    supabase
      .from('authorized_phones')
      .select('id, display_name, job_title, permission, is_active')
      .eq('workspace_id', table.workspace_id)
      .eq('is_active', true)
      .order('display_name'),
  ]);

  // Enrich records with display names
  const records = (rawRecords || []).map((r: any) => ({
    ...r,
    _phone_name: r.authorized_phones?.display_name || null,
    _assignee_name: r.assignee?.display_name
      ? (r.assignee.job_title
          ? `${r.assignee.display_name} (${r.assignee.job_title})`
          : r.assignee.display_name)
      : null,
  }));

  return (
    <TableClient
      table={table}
      fields={fields || []}
      initialRecords={records || []}
      views={views || []}
      phones={phones || []}
      userRole={membership.role}
      focusRecordId={searchParams.focus || null}
    />
  );
}
