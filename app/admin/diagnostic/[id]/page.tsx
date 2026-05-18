import { notFound } from 'next/navigation';
import { requirePlatformAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/server';
import DiagnosticDetailClient from './DiagnosticDetailClient';

export const dynamic = 'force-dynamic';

export default async function DiagnosticDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from('diagnostic_submissions')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!data) notFound();

  return <DiagnosticDetailClient submission={data} />;
}
