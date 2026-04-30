import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import TableClient from './TableClient';
import { resolveFieldVisibility, filterFields, filterRecords } from '@/lib/permissions/field-filter';

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

  // Get table and verify access. Joining workspaces to also pull
  // workspace_code, which we need for the global record IDs (KBL-EXP-0042
  // is the workspace_code + record_number of each record).
  const { data: table, error: tableError } = await supabase
    .from('tables')
    .select('*, workspaces(workspace_code, vertical)')
    .eq('id', params.tableId)
    .single();

  if (tableError || !table) notFound();

  // Pull the joined workspace fields up to top-level so they're easy to pass.
  // Supabase returns the joined row as either an object or array depending on
  // foreign key config, so we normalize.
  const joinedWs = Array.isArray((table as any).workspaces)
    ? (table as any).workspaces[0]
    : (table as any).workspaces;
  const workspaceCode: string | null = joinedWs?.workspace_code ?? null;

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

  // Apply field-level permissions: strip values for hidden fields and
  // omit them from the fields[] array entirely. Owners/admins bypass.
  // Done server-side so the data never reaches the browser - even DevTools
  // can't see what they shouldn't.
  const visibility = await resolveFieldVisibility(
    supabase,
    user.id,
    params.tableId,
    table.workspace_id
  );
  const visibleFields = filterFields(fields || [], visibility);
  const visibleRecords = filterRecords(records, visibility);

  return (
    <TableClient
      table={table}
      fields={visibleFields}
      initialRecords={visibleRecords}
      views={views || []}
      phones={phones || []}
      userRole={membership.role}
      focusRecordId={searchParams.focus || null}
      workspaceCode={workspaceCode}
    />
  );
}
