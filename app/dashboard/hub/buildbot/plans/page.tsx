import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { resolveActiveWorkspaceForUser } from '@/lib/permissions/active-workspace';
import { getT } from '@/lib/i18n/server';
import { DEFAULT_LOCALE } from '@/lib/i18n/locales';
import PlansClient from './PlansClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ProjectRecord = {
  id: string;
  data: { project_name?: string; address?: string };
};

type PlanRow = {
  id: string;
  file_name: string;
  file_type: string | null;
  file_size_bytes: number | null;
  status: string;
  project_id: string | null;
  ai_confidence_score: number | null;
  detected_total_area_sqm: number | null;
  created_at: string;
};

async function loadData(workspaceId: string): Promise<{
  plans: PlanRow[];
  projects: ProjectRecord[];
}> {
  // SECURITY: user-scoped client. Caller has already verified membership.
  const sb = createClient();

  // Find the projects table (slug='projects' in BuildBot pack)
  const { data: tableRow } = await sb
    .from('tables')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('slug', 'projects')
    .maybeSingle();

  let projects: ProjectRecord[] = [];
  if (tableRow) {
    const { data: records } = await sb
      .from('records')
      .select('id, data')
      .eq('workspace_id', workspaceId)
      .eq('table_id', (tableRow as { id: string }).id)
      .order('created_at', { ascending: false });
    projects = (records || []) as ProjectRecord[];
  }

  const { data: plans } = await sb
    .from('construction_plans')
    .select('id, file_name, file_type, file_size_bytes, status, project_id, ai_confidence_score, detected_total_area_sqm, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50);

  return {
    plans: (plans || []) as PlanRow[],
    projects,
  };
}

export async function generateMetadata() {
  const ws = await resolveActiveWorkspaceForUser();
  const { t } = getT(ws?.locale ?? DEFAULT_LOCALE);
  return { title: `${t('buildbot.plans_page_title')} | TaskFlow` };
}

export default async function PlansPage() {
  const ws = await resolveActiveWorkspaceForUser();
  if (!ws) {
    const { t, dir } = getT(DEFAULT_LOCALE);
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-4 md:p-6 grid place-items-center" dir={dir}>
        <div className="text-center max-w-md">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('buildbot.plans_page_title')}</h1>
          <p className="text-sm text-gray-500">
            יש לבחור workspace תקף ולהיכנס כחבר בו כדי לגשת לתוכניות.
          </p>
        </div>
      </div>
    );
  }
  const { wsId, locale } = ws;
  const { t, dir } = getT(locale);
  const { plans, projects } = await loadData(wsId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-4 md:p-6" dir={dir}>
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#FB923C)' }}
            >
              📐
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t('buildbot.plans_page_title')}
              </h1>
              <p className="text-sm text-gray-500">{t('buildbot.plans_page_subtitle')}</p>
            </div>
          </div>
          <Link
            href="/dashboard/hub/buildbot"
            className="text-sm text-amber-600 hover:text-amber-700 font-medium"
          >
            {dir === 'rtl' ? '←' : '→'} {t('hub.back_to_hub')}
          </Link>
        </header>

        <PlansClient
          workspaceId={wsId}
          locale={locale}
          plans={plans}
          projects={projects}
        />
      </div>
    </div>
  );
}
