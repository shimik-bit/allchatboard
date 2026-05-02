// app/dashboard/hub/buildbot/page.tsx
import Link from 'next/link';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { getT } from '@/lib/i18n/server';
import { isValidLocale, DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const PROJ_STATUS_COLORS: Record<string, string> = {
  planning: '#6B7280', permits: '#3B82F6', execution: '#F59E0B',
  finishing: '#FB923C', completed: '#10B981', on_hold: '#EF4444',
};

function fmt(n: any, locale: Locale): string {
  const symbol = locale === 'he' ? '₪' : '$';
  if (!n) return `${symbol}0`;
  const num = Number(n);
  if (num >= 1_000_000) return symbol + (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return symbol + Math.round(num / 1_000) + 'K';
  return symbol + num.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US');
}

async function getActiveWorkspace(): Promise<{ wsId: string; locale: Locale }> {
  const supabase = createClient();
  const wsId = cookies().get('tf_active_workspace')?.value || '7f8c4af0-f8db-4eef-bb0d-4c41c6728573';
  const { data: ws } = await supabase
    .from('workspaces').select('locale').eq('id', wsId).maybeSingle();
  const localeRaw = (ws as any)?.locale;
  return { wsId, locale: isValidLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE };
}

async function getBuildBotData(workspaceId: string) {
  const sb = createAdminClient();
  const [{ data: kpis }, { data: boq }, { data: vendors }, { data: projects }] = await Promise.all([
    sb.from('v_buildbot_kpis').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    sb.from('v_buildbot_boq_by_chapter').select('*').eq('workspace_id', workspaceId),
    sb.from('v_buildbot_top_vendors').select('*').eq('workspace_id', workspaceId).limit(8),
    sb.from('v_buildbot_project_finance').select('*').eq('workspace_id', workspaceId),
  ]);
  return { kpis: kpis || {}, boq: boq || [], vendors: vendors || [], projects: projects || [] };
}

export async function generateMetadata() {
  const { locale } = await getActiveWorkspace();
  const { t } = getT(locale);
  return { title: `${t('hub.buildbot_title')} | TaskFlow` };
}

export default async function BuildBotDashboard() {
  const { wsId, locale } = await getActiveWorkspace();
  const { t, dir } = getT(locale);
  const { kpis, boq, vendors, projects } = await getBuildBotData(wsId);
  const k: any = kpis;

  const boqSorted = [...boq].sort((a: any, b: any) => Number(b.total_cost) - Number(a.total_cost));
  const maxCost = Math.max(...boqSorted.map((c: any) => Number(c.total_cost) || 0), 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-4 md:p-6" dir={dir}>
      <div className="max-w-7xl mx-auto">
        
        <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#FB923C)' }}
            >🏗️</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('hub.buildbot_title')}</h1>
              <p className="text-sm text-gray-500">{t('hub.buildbot_subtitle')}</p>
            </div>
          </div>
          <Link href="/dashboard/hub" className="text-sm text-orange-600 hover:text-orange-700 font-medium">
            {dir === 'rtl' ? '←' : '→'} {t('hub.back_to_hub')}
          </Link>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KPICard icon="🏗️" color="#F59E0B" value={k.active_projects || 0} label={t('hub.buildbot_kpi_active_projects')} />
          <KPICard icon="💵" color="#10B981" value={fmt(k.active_budget, locale)} label={t('hub.buildbot_kpi_total_budget')} />
          <KPICard icon="🏢" color="#7C3AED" value={k.total_units || 0} label={t('hub.buildbot_kpi_total_units')} />
          <KPICard icon="📐" color="#3B82F6" value={Math.round(k.avg_project_size_sqm || 0)} label={t('hub.buildbot_kpi_avg_size')} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">🏗️ {t('hub.buildbot_active_projects')}</h3>
            <div className="space-y-3">
              {projects.length === 0 && <p className="text-gray-400 text-sm py-4">{t('hub.buildbot_no_projects')}</p>}
              {projects.map((p: any) => {
                const statusColor = PROJ_STATUS_COLORS[p.status] || '#6B7280';
                const statusLabel = t(`hub.proj_${p.status}`);
                const usedPct = Number(p.budget_used_percent) || 0;
                return (
                  <div key={p.project_id} className="p-4 bg-gradient-to-l from-amber-50 to-white rounded-xl border border-amber-100">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-gray-900">{p.project_name}</h4>
                      <span 
                        className="text-xs px-2 py-1 rounded text-white font-medium"
                        style={{ backgroundColor: statusColor }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-600 mt-2">
                      <span>📐 {p.area_sqm || 0} {t('hub.buildbot_sqm')}</span>
                      <span>🏢 {p.units || 0} {t('hub.buildbot_units')}</span>
                      <span className={`font-bold text-amber-700 ${dir === 'rtl' ? 'mr-auto' : 'ml-auto'}`}>{fmt(p.budget_total, locale)}</span>
                    </div>
                    {usedPct > 0 && (
                      <div className="mt-2 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full rounded-full"
                          style={{ background: 'linear-gradient(90deg,#F59E0B,#FB923C)', width: `${Math.min(usedPct, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">📋 {t('hub.buildbot_boq_title')}</h3>
            <div className="space-y-2">
              {boqSorted.length === 0 && <p className="text-gray-400 text-sm py-4">{t('hub.buildbot_no_boq')}</p>}
              {boqSorted.map((c: any) => {
                const pct = (Number(c.total_cost) / maxCost) * 100;
                const chapterKey = `hub.chapter_${c.chapter}`;
                const translated = t(chapterKey);
                const chapterLabel = translated === chapterKey ? c.chapter : translated;
                return (
                  <div key={c.chapter} className="flex items-center gap-3">
                    <span className="text-sm min-w-[100px] text-gray-700">
                      {chapterLabel}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                      <div 
                        className={`absolute inset-y-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} rounded-full transition-all`}
                        style={{ background: 'linear-gradient(135deg,#F59E0B,#FB923C)', width: `${pct}%`, opacity: 0.85 }}
                      />
                      <div className={`relative h-full flex items-center ${dir === 'rtl' ? 'justify-end' : 'justify-start'} px-3 text-xs font-bold z-10 ${pct > 50 ? 'text-white' : 'text-gray-700'}`}>
                        {fmt(c.total_cost, locale)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">🔨 {t('hub.buildbot_top_vendors')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {vendors.map((v: any) => {
              const stars = '⭐'.repeat(Number(v.rating) || 0);
              return (
                <div key={v.vendor_name} className="p-3 rounded-xl border bg-gradient-to-l from-green-50 to-white border-green-100">
                  <div className="font-bold text-gray-900 mb-1">{v.vendor_name}</div>
                  <div className="text-xs text-gray-500 mb-2">{v.contact_person || ''} · {v.phone || ''}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{stars}</span>
                    <span className={`text-xs ${v.has_insurance ? 'text-green-600' : 'text-amber-600'}`}>
                      {v.has_insurance ? '✅ ' + t('hub.buildbot_has_insurance') : '⚠️ ' + t('hub.buildbot_no_insurance')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

function KPICard({ icon, color, value, label }: { icon: string; color: string; value: any; label: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xl mb-3"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}
