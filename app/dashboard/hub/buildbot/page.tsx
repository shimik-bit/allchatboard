// app/dashboard/hub/buildbot/page.tsx
// BuildBot Dashboard - פרויקטים, BOQ, ספקים

import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export const metadata = { title: 'BuildBot Dashboard | TaskFlow' };
export const dynamic = 'force-dynamic';
export const revalidate = 30;

const PROJ_STATUS: Record<string, { label: string; color: string }> = {
  planning: { label: 'תכנון', color: '#6B7280' },
  permits: { label: 'היתרים', color: '#3B82F6' },
  execution: { label: 'ביצוע', color: '#F59E0B' },
  finishing: { label: 'גמרים', color: '#FB923C' },
  completed: { label: 'הושלם', color: '#10B981' },
  on_hold: { label: 'מושהה', color: '#EF4444' },
};

const CHAPTERS: Record<string, string> = {
  earthworks: 'עבודות עפר', concrete: 'בטון', masonry: 'בנייה',
  plaster: 'טיח', flooring: 'ריצוף', painting: 'צבע',
  plumbing: 'אינסטלציה', electrical: 'חשמל', aluminum: 'אלומיניום',
  doors: 'דלתות', kitchen: 'מטבח', bathroom: 'מקלחת',
};

function fmt(n: any): string {
  if (!n) return '₪0';
  const num = Number(n);
  if (num >= 1_000_000) return '₪' + (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return '₪' + Math.round(num / 1_000) + 'K';
  return '₪' + num.toLocaleString('he-IL');
}

async function getBuildBotData(workspaceId: string) {
  const sb = createAdminClient();
  
  const [{ data: kpis }, { data: boq }, { data: vendors }, { data: projects }] = await Promise.all([
    sb.from('v_buildbot_kpis').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    sb.from('v_buildbot_boq_by_chapter').select('*').eq('workspace_id', workspaceId),
    sb.from('v_buildbot_top_vendors').select('*').eq('workspace_id', workspaceId).limit(8),
    sb.from('v_buildbot_project_finance').select('*').eq('workspace_id', workspaceId),
  ]);

  return { 
    kpis: kpis || {}, 
    boq: boq || [], 
    vendors: vendors || [],
    projects: projects || [],
  };
}

export default async function BuildBotDashboard() {
  const cookieStore = cookies();
  const activeWs = cookieStore.get('tf_active_workspace')?.value || '7f8c4af0-f8db-4eef-bb0d-4c41c6728573';

  const { kpis, boq, vendors, projects } = await getBuildBotData(activeWs);
  const k: any = kpis;

  const boqSorted = [...boq].sort((a: any, b: any) => Number(b.total_cost) - Number(a.total_cost));
  const maxCost = Math.max(...boqSorted.map((c: any) => Number(c.total_cost) || 0), 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        
        <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#FB923C)' }}
            >🏗️</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">BuildBot Dashboard</h1>
              <p className="text-sm text-gray-500">ניהול פרויקטי בנייה</p>
            </div>
          </div>
          <Link href="/dashboard/hub" className="text-sm text-orange-600 hover:text-orange-700 font-medium">
            ← חזרה ל-Hub
          </Link>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KPICard icon="🏗️" color="#F59E0B" value={k.active_projects || 0} label="פרויקטים פעילים" />
          <KPICard icon="💵" color="#10B981" value={fmt(k.active_budget)} label="תקציב כולל" />
          <KPICard icon="🏢" color="#7C3AED" value={k.total_units || 0} label="סה״כ יחידות" />
          <KPICard icon="📐" color="#3B82F6" value={Math.round(k.avg_project_size_sqm || 0)} label="גודל ממוצע (מ״ר)" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          
          {/* Projects */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">🏗️ פרויקטים פעילים</h3>
            <div className="space-y-3">
              {projects.length === 0 && <p className="text-gray-400 text-sm py-4">אין פרויקטים</p>}
              {projects.map((p: any) => {
                const status = PROJ_STATUS[p.status] || { label: p.status, color: '#6B7280' };
                const usedPct = Number(p.budget_used_percent) || 0;
                return (
                  <div key={p.project_id} className="p-4 bg-gradient-to-l from-amber-50 to-white rounded-xl border border-amber-100">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-gray-900">{p.project_name}</h4>
                      <span 
                        className="text-xs px-2 py-1 rounded text-white font-medium"
                        style={{ backgroundColor: status.color }}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-600 mt-2">
                      <span>📐 {p.area_sqm || 0} מ״ר</span>
                      <span>🏢 {p.units || 0} יח׳</span>
                      <span className="font-bold text-amber-700 mr-auto">{fmt(p.budget_total)}</span>
                    </div>
                    {usedPct > 0 && (
                      <div className="mt-2 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full rounded-full"
                          style={{ 
                            background: 'linear-gradient(90deg,#F59E0B,#FB923C)',
                            width: `${Math.min(usedPct, 100)}%` 
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* BOQ */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">📋 BOQ - עלות לפי פרק</h3>
            <div className="space-y-2">
              {boqSorted.length === 0 && <p className="text-gray-400 text-sm py-4">אין BOQ</p>}
              {boqSorted.map((c: any) => {
                const pct = (Number(c.total_cost) / maxCost) * 100;
                return (
                  <div key={c.chapter} className="flex items-center gap-3">
                    <span className="text-sm min-w-[100px] text-gray-700">
                      {CHAPTERS[c.chapter] || c.chapter}
                    </span>
                    <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                      <div 
                        className="absolute inset-y-0 right-0 rounded-full transition-all"
                        style={{ 
                          background: 'linear-gradient(135deg,#F59E0B,#FB923C)',
                          width: `${pct}%`,
                          opacity: 0.85 
                        }}
                      />
                      <div className={`relative h-full flex items-center justify-end px-3 text-xs font-bold z-10 ${pct > 50 ? 'text-white' : 'text-gray-700'}`}>
                        {fmt(c.total_cost)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
        </div>

        {/* Vendors */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">🔨 ספקים מובילים</h3>
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
                      {v.has_insurance ? '✅ ביטוח' : '⚠️ ללא'}
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
