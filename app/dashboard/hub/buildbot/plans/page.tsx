import { cookies } from 'next/headers';
import Link from 'next/link';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n/server';
import { isValidLocale, DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales';
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

async function getActiveWorkspace(): Promise<{ wsId: string; locale: Locale }> {
  const supabase = createClient();
  const wsId = cookies().get('tf_active_workspace')?.value || '7f8c4af0-f8db-4eef-bb0d-4c41c6728573';
  const { data: ws } = await supabase
    .from('workspaces')
    .select('locale')
    .eq('id', wsId)
    .maybeSingle();
  const localeRaw = (ws as { locale?: string } | null)?.locale;
  return { wsId, locale: isValidLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE };
}

async function loadData(workspaceId: string): Promise<{
  plans: PlanRow[];
  projects: ProjectRecord[];
}> {
  const admin = createAdminClient();

  // Find the projects table (slug='projects' in BuildBot pack)
  const { data: tableRow } = await admin
    .from('tables')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('slug', 'projects')
    .maybeSingle();

  let projects: ProjectRecord[] = [];
  if (tableRow) {
    const { data: records } = await admin
      .from('records')
      .select('id, data')
      .eq('workspace_id', workspaceId)
      .eq('table_id', (tableRow as { id: string }).id)
      .order('created_at', { ascending: false });
    projects = (records || []) as ProjectRecord[];
  }

  const { data: plans } = await admin
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
  const { locale } = await getActiveWorkspace();
  const { t } = getT(locale);
  return { title: `${t('buildbot.plans_page_title')} | TaskFlow` };
}

export default async function PlansPage() {
  const { wsId, locale } = await getActiveWorkspace();
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
