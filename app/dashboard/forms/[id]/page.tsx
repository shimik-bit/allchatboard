import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { resolveActiveWorkspaceForUser } from '@/lib/permissions/active-workspace';
import type { FormRow } from '@/lib/forms/types';
import FormBuilderClient from './FormBuilderClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from('forms')
    .select('title')
    .eq('id', params.id)
    .maybeSingle();
  return { title: `${data?.title ?? 'Form'} · TaskFlow` };
}

export default async function FormBuilderPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const ws = await resolveActiveWorkspaceForUser();
  if (!ws) redirect('/dashboard');

  const { data: form } = await supabase
    .from('forms')
    .select('*')
    .eq('id', params.id)
    .eq('workspace_id', ws.wsId)
    .maybeSingle();

  if (!form) notFound();
  const typedForm = form as FormRow;

  const { data: fields } = await supabase
    .from('fields')
    .select('id, name, slug, type, is_required, is_primary, position, config')
    .eq('table_id', typedForm.table_id)
    .order('position', { ascending: true });

  return <FormBuilderClient initialForm={typedForm} availableFields={fields ?? []} />;
}
