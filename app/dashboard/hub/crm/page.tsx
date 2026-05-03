// app/dashboard/hub/crm/page.tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { resolveActiveWorkspaceForUser } from '@/lib/permissions/active-workspace';
import { getT } from '@/lib/i18n/server';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const STAGES_KEYS = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const;
const STAGE_COLORS: Record<string, string> = {
  new: '#3B82F6', contacted: '#8B5CF6', qualified: '#F59E0B',
  proposal: '#FB923C', negotiation: '#EC4899', won: '#10B981', lost: '#EF4444',
};

function fmtCurrency(n: any, locale: Locale): string {
  if (!n) return locale === 'he' ? '₪0' : '$0';
  const num = Number(n);
  const symbol = locale === 'he' ? '₪' : '$';
  if (num >= 1_000_000) return symbol + (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return symbol + Math.round(num / 1_000) + 'K';
  return symbol + num.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US');
}

async function getCRMData(workspaceId: string) {
  // SECURITY: user-scoped client. The views are now security_invoker so
  // RLS scopes them to the caller. We also pass workspace_id explicitly.
  const sb = createClient();
  const [{ data: kpis }, { data: pipeline }, { data: lead360 }, { data: sources }] = await Promise.all([
    sb.from('v_crm_kpis').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    sb.from('v_crm_pipeline_by_stage').select('*').eq('workspace_id', workspaceId),
    sb.from('v_lead_360').select('*').eq('workspace_id', workspaceId).order('calls_count', { ascending: false }).limit(10),
    sb.from('v_crm_lead_sources').select('*').eq('workspace_id', workspaceId),
  ]);
  return {
    kpis: kpis || {}, pipeline: pipeline || [],
    lead360: lead360 || [], sources: sources || [],
  };
}

export async function generateMetadata() {
  const ws = await resolveActiveWorkspaceForUser();
  const { t } = getT(ws?.locale ?? DEFAULT_LOCALE);
  return { title: `${t('hub.crm_title')} | TaskFlow` };
}

export default async function CRMDashboard() {
  const ws = await resolveActiveWorkspaceForUser();
  if (!ws) {
    // Not signed in or no workspaces: render an empty state instead of
    // leaking another user's CRM.
    const { t, dir } = getT(DEFAULT_LOCALE);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-4 md:p-6 grid place-items-center" dir={dir}>
        <div className="text-center max-w-md">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('hub.crm_title')}</h1>
          <p className="text-sm text-gray-500">
            יש לבחור workspace תקף ולהיכנס כחבר בו כדי לראות את ה-CRM.
          </p>
        </div>
      </div>
    );
  }
  const { wsId, locale } = ws;
  const { t, dir } = getT(locale);
  const { kpis, pipeline, lead360, sources } = await getCRMData(wsId);
  
  const k: any = kpis;
  const stages = ['new', 'contacted', 'qualified', 'proposal', 'negotiation'];
  const totalCount = pipeline.reduce((s: number, p: any) => stages.includes(p.stage) ? s + Number(p.count) : s, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-4 md:p-6" dir={dir}>
      <div className="max-w-7xl mx-auto">
        
        <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)' }}
            >🎯</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('hub.crm_title')}</h1>
              <p className="text-sm text-gray-500">{t('hub.crm_subtitle')}</p>
            </div>
          </div>
          <Link href="/dashboard/hub" className="text-sm text-purple-600 hover:text-purple-700 font-medium">
            {dir === 'rtl' ? '←' : '→'} {t('hub.back_to_hub')}
          </Link>
        </header>

        {/* View Switcher */}
        <div className="mb-4 flex gap-2 flex-wrap">
          <Link
            href="/dashboard/hub/crm"
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium"
          >
            📊 {t('hub.crm_view_dashboard')}
          </Link>
          <Link
            href="/dashboard/hub/crm/leads"
            className="px-4 py-2 rounded-lg bg-white text-purple-700 border border-purple-200 hover:bg-purple-50 text-sm font-medium"
          >
            📋 {t('hub.crm_view_leads')}
          </Link>
          <Link
            href="/dashboard/hub/crm/kanban"
            className="px-4 py-2 rounded-lg bg-white text-purple-700 border border-purple-200 hover:bg-purple-50 text-sm font-medium"
          >
            🎯 {t('hub.crm_view_kanban')}
          </Link>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KPICard icon="📊" color="#7C3AED" value={k.active_leads || 0} label={t('hub.crm_kpi_active_leads')} />
          <KPICard icon="💰" color="#10B981" value={fmtCurrency(k.pipeline_value, locale)} label={t('hub.crm_kpi_pipeline_value')} />
          <KPICard icon="✅" color="#3B82F6" value={`${k.conversion_rate || 0}%`} label={t('hub.crm_kpi_conversion_rate')} />
          <KPICard icon="🔥" color="#F59E0B" value={Math.round(k.avg_ai_score || 0)} label={t('hub.crm_kpi_avg_ai_score')} />
        </div>

        {/* Pipeline */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
          <h3 className="font-bold text-gray-900 mb-4">📈 {t('hub.crm_pipeline_status')}</h3>
          <div className="space-y-3">
            {stages.map(s => {
              const data: any = pipeline.find((p: any) => p.stage === s) || { count: 0, total_value: 0 };
              const color = STAGE_COLORS[s];
              const label = t(`hub.stage_${s}`);
              const pct = totalCount > 0 ? (Number(data.count) / totalCount) * 100 : 0;
              return (
                <div key={s} className="flex items-center gap-3">
                  <span 
                    className="text-xs px-3 py-1.5 rounded-lg font-medium min-w-[110px] text-center text-white"
                    style={{ backgroundColor: color }}
                  >
                    {label}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-9 relative overflow-hidden">
                    <div 
                      className={`absolute inset-y-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} rounded-full transition-all`}
                      style={{ backgroundColor: color, width: `${pct}%`, opacity: 0.85 }}
                    />
                    <div className="relative h-full flex items-center justify-between px-3 text-xs font-medium z-10">
                      <span className="text-gray-700">{fmtCurrency(data.total_value, locale)}</span>
                      <span className={`${pct > 30 ? 'text-white' : 'text-gray-700'} font-bold`}>{data.count}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lead 360 list */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">🔥 {t('hub.crm_top_interactions')}</h3>
            <Link
              href="/dashboard/hub/crm/leads"
              className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
            >
              {t('hub.crm_see_all_leads')}
              <span>{dir === 'rtl' ? '←' : '→'}</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {lead360.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8 col-span-2">{t('hub.crm_no_leads')}</p>
            )}
            {lead360.map((l: any) => {
              const stageColor = STAGE_COLORS[l.stage] || '#6B7280';
              const stageLabel = t(`hub.stage_${l.stage}`);
              const score = Number(l.ai_score) || 0;
              const scoreColor = score >= 80 ? 'text-red-600' : score >= 60 ? 'text-orange-600' : 'text-gray-500';
              return (
                <Link
                  key={l.lead_id}
                  href={`/dashboard/hub/crm/leads/${l.lead_id}`}
                  className="block p-4 bg-gradient-to-l from-purple-50 to-white rounded-xl border border-purple-100 hover:border-purple-300 hover:shadow-sm transition"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 truncate">{l.lead_title}</h4>
                      <p className="text-xs text-gray-500">{l.contact_name} · {l.phone}</p>
                    </div>
                    <span 
                      className="text-xs px-2 py-1 rounded text-white font-medium"
                      style={{ backgroundColor: stageColor }}
                    >
                      {stageLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600 mt-2">
                    <span>📞 {l.calls_count} {t('hub.crm_calls_count')}</span>
                    <span className={`font-bold ${scoreColor}`}>{score}/100</span>
                    <span className={`text-purple-700 font-bold ${dir === 'rtl' ? 'mr-auto' : 'ml-auto'}`}>{fmtCurrency(l.value, locale)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Sources */}
        {sources.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">📍 {t('hub.crm_lead_sources')}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {sources.map((s: any) => {
                // Try translated source label, fall back to raw
                const sourceKey = `hub.source_${s.source}`;
                const translatedSource = t(sourceKey);
                const sourceLabel = translatedSource === sourceKey ? s.source : translatedSource;
                return (
                  <div key={s.source} className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-gray-900">{s.leads_count}</div>
                    <div className="text-sm text-gray-500">{sourceLabel}</div>
                    <div className="text-xs text-purple-600 mt-1">{t('hub.crm_avg_score')}: {Math.round(Number(s.avg_score) || 0)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
