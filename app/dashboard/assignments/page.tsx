import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AssignmentsClient from './AssignmentsClient';

export const dynamic = 'force-dynamic';

export default async function AssignmentsPage() {
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

  // Load everything we need for the rule editor:
  //   - tables (the rule belongs to a table)
  //   - fields (the rule matches against a field; only useful field types are shown)
  //   - authorized_phones (one of the assignee options)
  //   - existing rules (with joined assignee details for display)
  const [tablesRes, fieldsRes, phonesRes, rulesRes] = await Promise.all([
    supabase
      .from('tables')
      .select('id, name, slug')
      .eq('workspace_id', membership.workspace_id)
      .eq('is_archived', false)
      .order('position'),

    supabase
      .from('fields')
      .select('id, table_id, name, slug, type, config')
      .eq('workspace_id', membership.workspace_id)
      .order('position'),

    supabase
      .from('authorized_phones')
      .select('id, phone, display_name, job_title')
      .eq('workspace_id', membership.workspace_id)
      .eq('is_active', true)
      .order('display_name'),

    supabase
      .from('assignment_rules')
      .select(`
        id, table_id, field_id, match_value, priority, is_active,
        assignee_phone_id, raw_phone, raw_name,
        authorized_phones ( id, phone, display_name, job_title )
      `)
      .eq('workspace_id', membership.workspace_id)
      .order('priority', { ascending: true }),
  ]);

  return (
    <AssignmentsClient
      workspaceId={membership.workspace_id}
      initialTables={tablesRes.data || []}
      initialFields={fieldsRes.data || []}
      initialPhones={phonesRes.data || []}
      initialRules={rulesRes.data || []}
      canEdit={membership.role === 'owner' || membership.role === 'admin'}
    />
  );
}
