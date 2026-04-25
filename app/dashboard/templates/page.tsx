import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TemplatesClient from './TemplatesClient';

export default async function TemplatesPage() {
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

  const [{ data: templates }, { data: packages }, { data: existingTables }] = await Promise.all([
    supabase.from('templates').select('*').eq('is_published', true).order('name'),
    supabase.from('table_packages').select('*').eq('is_published', true).order('category').order('position'),
    supabase.from('tables').select('slug').eq('workspace_id', membership.workspace_id),
  ]);

  const existingSlugs = new Set((existingTables || []).map((t: any) => t.slug));

  return (
    <TemplatesClient
      workspaceId={membership.workspace_id}
      templates={templates || []}
      packages={packages || []}
      existingTableSlugs={Array.from(existingSlugs)}
    />
  );
}
