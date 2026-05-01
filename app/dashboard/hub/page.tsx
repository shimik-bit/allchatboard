// app/dashboard/hub/page.tsx
// TaskFlow Hub - מרכז שליטה לכל ה-Packs
// משתמש ב-Layout הקיים של dashboard (Sidebar + auth)

import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';

export const metadata = {
  title: 'Hub - מרכז שליטה | TaskFlow',
};

export const dynamic = 'force-dynamic';
export const revalidate = 30;

async function getHubData() {
  const sb = createAdminClient();
  
  const [{ data: workspaces }, { data: packs }, { data: allPacks }] = await Promise.all([
    sb.from('v_workspace_overview').select('*').order('total_records', { ascending: false }),
    sb.from('v_workspace_packs').select('*'),
    sb.from('table_packages').select('*').eq('is_published', true).order('position'),
  ]);

  return { workspaces: workspaces || [], packs: packs || [], allPacks: allPacks || [] };
}

export default async function HubPage() {
  const { workspaces, packs, allPacks } = await getHubData();

  // Group packs by workspace
  const packsByWs: Record<string, any[]> = {};
  packs.forEach((p: any) => {
    if (!packsByWs[p.workspace_id]) packsByWs[p.workspace_id] = [];
    packsByWs[p.workspace_id].push(p);
  });

  // Stats
  const totalWorkspaces = workspaces.filter((w: any) => Number(w.total_records) > 0).length;
  const totalPacks = allPacks.length;
  const totalRecords = workspaces.reduce((s: number, w: any) => s + (Number(w.total_records) || 0), 0);
  const totalInstalls = packs.length;

  // Pack usage
  const packUsage: Record<string, number> = {};
  packs.forEach((p: any) => {
    packUsage[p.pack_slug] = (packUsage[p.pack_slug] || 0) + 1;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        
        <header className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 mb-4">
            <div 
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-3xl"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#A855F7,#EC4899)' }}
            >⚡</div>
            <div className="text-right">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900">TaskFlow Hub</h1>
              <p className="text-sm text-gray-500">מרכז שליטה - כל המודולים וה-Workspaces</p>
            </div>
          </div>
        </header>

        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard value={totalWorkspaces} label="Workspaces פעילים" color="text-purple-600" />
          <StatCard value={totalPacks} label="מודולים זמינים" color="text-blue-600" />
          <StatCard value={totalInstalls} label="התקנות" color="text-green-600" />
          <StatCard value={totalRecords} label="רשומות" color="text-orange-600" />
        </div>

        {/* Live Dashboards */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            📊 דשבורדים חיים
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link 
              href="/dashboard/hub/crm"
              className="block bg-gradient-to-br from-purple-500 to-purple-700 text-white rounded-2xl p-6 hover:shadow-xl transition-all"
            >
              <div className="text-4xl mb-3">🎯</div>
              <h3 className="text-xl font-bold mb-2">CRM Dashboard</h3>
              <p className="text-sm opacity-90">לידים, פייפליין, ציוני AI</p>
            </Link>
            
            <Link
              href="/dashboard/hub/buildbot"
              className="block bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-2xl p-6 hover:shadow-xl transition-all"
            >
              <div className="text-4xl mb-3">🏗️</div>
              <h3 className="text-xl font-bold mb-2">BuildBot</h3>
              <p className="text-sm opacity-90">פרויקטים, BOQ, ספקים</p>
            </Link>
            
            <Link
              href="/dashboard/hub/restobot"
              className="block bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-2xl p-6 hover:shadow-xl transition-all"
            >
              <div className="text-4xl mb-3">🍽️</div>
              <h3 className="text-xl font-bold mb-2">RestoBot</h3>
              <p className="text-sm opacity-90">תפריט, מלאי, הזמנות</p>
            </Link>
          </div>
        </section>

        {/* Workspaces */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            🏢 כל ה-Workspaces
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.filter((w: any) => Number(w.total_records) > 0).map((w: any) => {
              const wsPacks = packsByWs[w.workspace_id] || [];
              return (
                <div key={w.workspace_id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="text-2xl">{w.workspace_icon || '📊'}</div>
                    <div>
                      <h3 className="font-bold text-gray-900">{w.workspace_name}</h3>
                      <p className="text-xs text-gray-500 capitalize">{w.plan}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                    <MiniStat value={w.packs_installed} label="Packs" color="purple" />
                    <MiniStat value={w.total_tables} label="טבלאות" color="blue" />
                    <MiniStat value={w.total_records} label="רשומות" color="green" />
                  </div>

                  {wsPacks.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {wsPacks.map((p: any) => (
                        <span 
                          key={p.pack_slug}
                          className="text-xs px-2 py-1 rounded"
                          style={{ backgroundColor: `${p.pack_color}20`, color: p.pack_color }}
                        >
                          {p.pack_icon} {p.pack_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Available Packs */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            📦 מודולים זמינים
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allPacks.map((p: any) => {
              const usage = packUsage[p.slug] || 0;
              const tables = p.structure?.tables?.length || 0;
              const fields = (p.structure?.tables || []).reduce((s: number, t: any) => s + (t.fields?.length || 0), 0);
              return (
                <div key={p.slug} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className="flex items-start gap-3 mb-3">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${p.color}20` }}
                    >
                      {p.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{p.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{p.description || ''}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <PackStat value={tables} label="טבלאות" color={p.color} />
                    <PackStat value={fields} label="שדות" color={p.color} />
                    <PackStat value={usage} label="התקנות" color={p.color} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}

function StatCard({ value, label, color }: { value: any; label: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
      <div className={`text-4xl font-bold ${color}`}>{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function MiniStat({ value, label, color }: { value: any; label: string; color: string }) {
  const bg = color === 'purple' ? 'bg-purple-50 text-purple-700'
    : color === 'blue' ? 'bg-blue-50 text-blue-700'
    : 'bg-green-50 text-green-700';
  return (
    <div className={`${bg} rounded p-2`}>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

function PackStat({ value, label, color }: { value: any; label: string; color: string }) {
  return (
    <div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
