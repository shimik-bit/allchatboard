import { requirePlatformAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/server';
import DiagnosticListClient from './DiagnosticListClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'אבחון לידים · TaskFlow Admin',
};

export default async function DiagnosticAdminPage() {
  await requirePlatformAdmin();
  const admin = createAdminClient();

  // Quick stats for the header cards (cheap aggregate queries)
  const [{ count: totalCount }, { count: completeCount }, { count: unreviewedCount }, { count: thisWeekCount }] =
    await Promise.all([
      admin.from('diagnostic_submissions').select('id', { count: 'exact', head: true }),
      admin.from('diagnostic_submissions').select('id', { count: 'exact', head: true }).eq('is_complete', true),
      admin
        .from('diagnostic_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('is_complete', true)
        .is('reviewed_at', null),
      admin
        .from('diagnostic_submissions')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

  return (
    <DiagnosticListClient
      stats={{
        total: totalCount ?? 0,
        complete: completeCount ?? 0,
        unreviewed: unreviewedCount ?? 0,
        thisWeek: thisWeekCount ?? 0,
      }}
    />
  );
}
