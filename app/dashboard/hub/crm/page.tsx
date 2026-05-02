// app/dashboard/hub/crm/page.tsx
// CRM Dashboard - לידים, פייפליין, ציוני AI

import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const metadata = { title: 'CRM Dashboard | TaskFlow' };
export const dynamic = 'force-dynamic';
export const revalidate = 30;

const STAGES: Record<string, { label: string; color: string }> = {
  new: { label: 'חדש', color: '#3B82F6' },
  contacted: { label: 'יצרנו קשר', color: '#8B5CF6' },
  qualified: { label: 'מוסמך', color: '#F59E0B' },
  proposal: { label: 'הצעה נשלחה', color: '#FB923C' },
  negotiation: { label: 'משא ומתן', color: '#EC4899' },
  won: { label: 'נסגר בהצלחה', color: '#10B981' },
  lost: { label: 'אבוד', color: '#EF4444' },
};

function fmtCurrency(n: any): string {
  if (!n) return '₪0';
  const num = Number(n);
  if (num >= 1_000_000) return '₪' + (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return '₪' + Math.round(num / 1_000) + 'K';
  return '₪' + num.toLocaleString('he-IL');
}

async function getCRMData(workspaceId: string) {
  const sb = createAdminClient();
  
  const [{ data: kpis }, { data: pipeline }, { data: lead360 }, { data: sources }] = await Promise.all([
    sb.from('v_crm_kpis').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    sb.from('v_crm_pipeline_by_stage').select('*').eq('workspace_id', workspaceId),
    sb.from('v_lead_360').select('*').eq('workspace_id', workspaceId).order('calls_count', { ascending: false }).limit(10),
    sb.from('v_crm_lead_sources').select('*').eq('workspace_id', workspaceId),
  ]);

  return { 
    kpis: kpis || {}, 
    pipeline: pipeline || [], 
    lead360: lead360 || [],
    sources: sources || [],
  };
}

export default async function CRMDashboard() {
  // Get active workspace from cookie
  const cookieStore = cookies();
  const activeWs = cookieStore.get('tf_active_workspace')?.value || '7f8c4af0-f8db-4eef-bb0d-4c41c6728573';

  const { kpis, pipeline, lead360, sources } = await getCRMData(activeWs);
  
  const k: any = kpis;
  const stages = ['new', 'contacted', 'qualified', 'proposal', 'negotiation'];
  const totalCount = pipeline.reduce((s: number, p: any) => stages.includes(p.stage) ? s + Number(p.count) : s, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        
        <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7)' }}
            >🎯</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CRM Dashboard</h1>
              <p className="text-sm text-gray-500">לידים, פייפליין, ציוני AI</p>
            </div>
          </div>
          <Link href="/dashboard/hub" className="text-sm text-purple-600 hover:text-purple-700 font-medium">
            ← חזרה ל-Hub
          </Link>
        </header>

        {/* View Switcher */}
        <div className="mb-4 flex gap-2">
          <Link
            href="/dashboard/hub/crm"
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium"
          >
            📊 דשבורד
          </Link>
          <Link
            href="/dashboard/hub/crm/kanban"
            className="px-4 py-2 rounded-lg bg-white text-purple-700 border border-purple-200 hover:bg-purple-50 text-sm font-medium"
          >
            🎯 קנבן (גרירה)
          </Link>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KPICard icon="📊" color="#7C3AED" value={k.active_leads || 0} label="לידים פעילים" />
          <KPICard icon="💰" color="#10B981" value={fmtCurrency(k.pipeline_value)} label="ערך פייפליין" />
          <KPICard icon="✅" color="#3B82F6" value={`${k.conversion_rate || 0}%`} label="אחוז סגירה" />
          <KPICard icon="🔥" color="#F59E0B" value={Math.round(k.avg_ai_score || 0)} label="ציון AI ממוצע" />
        </div>

        {/* Pipeline */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-4">
          <h3 className="font-bold text-gray-900 mb-4">📈 מצב פייפליין</h3>
          <div className="space-y-3">
            {stages.map(s => {
              const data: any = pipeline.find((p: any) => p.stage === s) || { count: 0, total_value: 0 };
              const info = STAGES[s];
              const pct = totalCount > 0 ? (Number(data.count) / totalCount) * 100 : 0;
              return (
                <div key={s} className="flex items-center gap-3">
                  <span 
                    className="text-xs px-3 py-1.5 rounded-lg font-medium min-w-[110px] text-center text-white"
                    style={{ backgroundColor: info.color }}
                  >
                    {info.label}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-9 relative overflow-hidden">
                    <div 
                      className="absolute inset-y-0 right-0 rounded-full transition-all"
                      style={{ backgroundColor: info.color, width: `${pct}%`, opacity: 0.85 }}
                    />
                    <div className="relative h-full flex items-center justify-between px-3 text-xs font-medium z-10">
                      <span className="text-gray-700">{fmtCurrency(data.total_value)}</span>
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
          <h3 className="font-bold text-gray-900 mb-4">🔥 לידים עם הכי הרבה אינטראקציות</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {lead360.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-8 col-span-2">אין לידים עם נתונים</p>
            )}
            {lead360.map((l: any) => {
              const stage = STAGES[l.stage] || { label: l.stage, color: '#6B7280' };
              const score = Number(l.ai_score) || 0;
              const scoreColor = score >= 80 ? 'text-red-600' : score >= 60 ? 'text-orange-600' : 'text-gray-500';
              return (
                <div key={l.lead_id} className="p-4 bg-gradient-to-l from-purple-50 to-white rounded-xl border border-purple-100">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900">{l.lead_title}</h4>
                      <p className="text-xs text-gray-500">{l.contact_name} · {l.phone}</p>
                    </div>
                    <span 
                      className="text-xs px-2 py-1 rounded text-white font-medium"
                      style={{ backgroundColor: stage.color }}
                    >
                      {stage.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600 mt-2">
                    <span>📞 {l.calls_count} שיחות</span>
                    <span className={`font-bold ${scoreColor}`}>{score}/100</span>
                    <span className="text-purple-700 font-bold mr-auto">{fmtCurrency(l.value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sources */}
        {sources.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">📍 מקורות לידים</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {sources.map((s: any) => (
                <div key={s.source} className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900">{s.leads_count}</div>
                  <div className="text-sm text-gray-500">{s.source}</div>
                  <div className="text-xs text-purple-600 mt-1">ציון ממוצע: {Math.round(Number(s.avg_score) || 0)}</div>
                </div>
              ))}
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
