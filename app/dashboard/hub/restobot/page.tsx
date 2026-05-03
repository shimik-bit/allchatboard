// app/dashboard/hub/restobot/page.tsx
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { resolveActiveWorkspaceForUser } from '@/lib/permissions/active-workspace';
import { getT } from '@/lib/i18n/server';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales';

export const dynamic = 'force-dynamic';
export const revalidate = 30;

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#10B981', pending: '#F59E0B', seated: '#3B82F6',
  completed: '#22C55E', cancelled: '#EF4444',
};

function fmt(n: any, locale: Locale): string {
  const symbol = locale === 'he' ? '₪' : '$';
  if (!n) return `${symbol}0`;
  const num = Number(n);
  if (num >= 1_000_000) return symbol + (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return symbol + Math.round(num / 1_000) + 'K';
  return symbol + num.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US');
}

function fmtTime(ts: string, locale: Locale): string {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString(locale === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit' });
}

async function getRestoData(workspaceId: string) {
  // SECURITY: user-scoped client. Views are security_invoker so RLS scopes
  // them; we still pass workspace_id explicitly as defence in depth.
  const sb = createClient();
  const [{ data: kpis }, { data: dishes }, { data: alerts }, { data: today }] = await Promise.all([
    sb.from('v_restobot_kpis').select('*').eq('workspace_id', workspaceId).maybeSingle(),
    sb.from('v_restobot_top_dishes').select('*').eq('workspace_id', workspaceId).limit(8),
    sb.from('v_restobot_inventory_alerts').select('*').eq('workspace_id', workspaceId).in('status', ['low', 'out']),
    sb.from('v_restobot_today').select('*').eq('workspace_id', workspaceId),
  ]);
  const today_str = new Date().toISOString().split('T')[0];
  const { data: shiftsTable } = await sb.from('tables').select('id').eq('workspace_id', workspaceId).like('slug', 'shifts%').maybeSingle();
  let shiftsToday: any[] = [];
  if (shiftsTable) {
    const { data: shifts } = await sb.from('records').select('id, data').eq('table_id', shiftsTable.id);
    shiftsToday = (shifts || []).filter((s: any) => (s.data?.shift_date || '').startsWith(today_str));
  }
  return {
    kpis: kpis || {}, dishes: dishes || [], alerts: alerts || [],
    today: today || [], shiftsToday,
  };
}

export async function generateMetadata() {
  const ws = await resolveActiveWorkspaceForUser();
  const { t } = getT(ws?.locale ?? DEFAULT_LOCALE);
  return { title: `${t('hub.restobot_title')} | TaskFlow` };
}

export default async function RestoBotDashboard() {
  const ws = await resolveActiveWorkspaceForUser();
  if (!ws) {
    const { t, dir } = getT(DEFAULT_LOCALE);
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-orange-50 p-4 md:p-6 grid place-items-center" dir={dir}>
        <div className="text-center max-w-md">
          <div className="text-5xl mb-3">🔒</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">{t('hub.restobot_title')}</h1>
          <p className="text-sm text-gray-500">
            יש לבחור workspace תקף ולהיכנס כחבר בו כדי לראות את ה-RestoBot.
          </p>
        </div>
      </div>
    );
  }
  const { wsId, locale } = ws;
  const { t, dir } = getT(locale);
  const { kpis, dishes, alerts, today, shiftsToday } = await getRestoData(wsId);
  const k: any = kpis;
  const totalRevenuePotential = today.reduce((s: number, r: any) => s + (Number(r.guests) || 0) * 150, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 p-4 md:p-6" dir={dir}>
      <div className="max-w-7xl mx-auto">
        
        <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl"
              style={{ background: 'linear-gradient(135deg,#EF4444,#F59E0B)' }}
            >🍽️</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('hub.restobot_title')}</h1>
              <p className="text-sm text-gray-500">{t('hub.restobot_subtitle')}</p>
            </div>
          </div>
          <Link href="/dashboard/hub" className="text-sm text-red-600 hover:text-red-700 font-medium">
            {dir === 'rtl' ? '←' : '→'} {t('hub.back_to_hub')}
          </Link>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <KPICard icon="📜" color="#EF4444" value={k.active_menu_items || 0} label={t('hub.restobot_kpi_active_dishes')} />
          <KPICard icon="⚠️" color="#F59E0B" value={k.items_to_reorder || 0} label={t('hub.restobot_kpi_to_reorder')} />
          <KPICard icon="👨‍🍳" color="#7C3AED" value={k.shifts_today || 0} label={t('hub.restobot_kpi_shifts_today')} />
          <KPICard icon="📅" color="#10B981" value={k.reservations_today || 0} label={t('hub.restobot_kpi_reservations_today')} />
          <KPICard 
            icon="👥" color="#06B6D4" 
            value={k.total_guests_today || 0} 
            label={t('hub.restobot_kpi_guests_today')} 
            sub={`${t('hub.restobot_revenue_potential')}: ${fmt(totalRevenuePotential, locale)}`} 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">📅 {t('hub.restobot_reservations_today')}</h3>
            <div className="space-y-3">
              {today.length === 0 && <p className="text-gray-400 text-sm py-8 text-center">{t('hub.restobot_no_reservations')}</p>}
              {today.map((r: any) => {
                const statusColor = STATUS_COLORS[r.status] || '#6B7280';
                const statusLabel = t(`hub.res_${r.status}`);
                return (
                  <div key={r.id} className="p-4 bg-gradient-to-l from-green-50 to-white rounded-xl border border-green-100">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-bold text-gray-900">{r.title}</h4>
                        <p className="text-xs text-gray-500">{r.phone}</p>
                      </div>
                      <span 
                        className="text-xs px-2 py-1 rounded text-white font-medium"
                        style={{ backgroundColor: statusColor }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-600 mt-2">
                      <span className="font-bold text-base text-green-700">⏰ {fmtTime(r.event_time, locale)}</span>
                      <span>👥 {r.guests} {t('hub.restobot_guests')}</span>
                      {r.table_number && <span>🪑 {t('hub.restobot_table')} {r.table_number}</span>}
                    </div>
                    {r.notes && (
                      <p className="text-xs text-amber-700 bg-amber-50 rounded p-2 mt-2 italic">
                        📌 {r.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4">👥 {t('hub.restobot_staff_today')}</h3>
              <div className="space-y-2">
                {shiftsToday.length === 0 && <p className="text-gray-400 text-sm py-4 text-center">{t('hub.restobot_no_shifts')}</p>}
                {shiftsToday.map((s: any) => {
                  const d = s.data || {};
                  const roleKey = `hub.role_${d.role}`;
                  const translated = t(roleKey);
                  const roleLabel = translated === roleKey ? d.role : translated;
                  return (
                    <div key={s.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm">{roleLabel}</h4>
                          <p className="text-xs text-gray-600">{d.employee_name}</p>
                        </div>
                        <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
                          <div className="text-sm font-bold text-gray-900">{fmt(d.total_pay, locale)}</div>
                          <div className="text-xs text-gray-500">{d.hours_worked || 0}h</div>
                        </div>
                      </div>
                      {d.tips && (
                        <div className="text-xs text-green-600 mt-1">💰 {t('hub.restobot_tips')}: {fmt(d.tips, locale)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-900 mb-4">⚠️ {t('hub.restobot_inventory_alerts')}</h3>
              <div className="space-y-2">
                {alerts.length === 0 && <p className="text-gray-400 text-sm py-4 text-center">✅ {t('hub.restobot_no_alerts')}</p>}
                {alerts.map((a: any) => {
                  const isOut = a.status === 'out';
                  return (
                    <div key={a.id} className={`p-3 rounded-lg border ${isOut ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900 text-sm">
                            {isOut ? '❌' : '⚠️'} {a.item_name}
                          </h4>
                          <p className="text-xs text-gray-500">{t('hub.restobot_supplier')}: {a.supplier || t('hub.restobot_unknown')}</p>
                        </div>
                        <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
                          <div className={`text-sm font-bold ${isOut ? 'text-red-700' : 'text-amber-700'}`}>
                            {a.current_stock} / {a.min_stock}
                          </div>
                          <div className="text-xs text-gray-500">{a.unit}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">🔥 {t('hub.restobot_top_dishes')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {dishes.map((d: any) => {
              const pct = Number(d.popularity) || 0;
              const fcp = Number(d.food_cost_percent) || 0;
              const profitColor = fcp < 30 ? '#10B981' : fcp < 35 ? '#F59E0B' : '#EF4444';
              const catKey = `hub.cat_${d.category}`;
              const catTranslated = t(catKey);
              const catLabel = catTranslated === catKey ? d.category : catTranslated;
              return (
                <div key={d.id} className="p-3 bg-gradient-to-l from-orange-50 to-white rounded-xl border border-orange-100">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-900 text-sm">{d.dish_name}</h4>
                      <p className="text-xs text-gray-500">{catLabel}</p>
                    </div>
                    <div className={dir === 'rtl' ? 'text-left' : 'text-right'}>
                      <div className="text-lg font-bold text-gray-900">{fmt(d.price, locale)}</div>
                      <div className="text-xs" style={{ color: profitColor }}>{t('hub.restobot_cost_label')}: {fcp}%</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg,#F59E0B,#EF4444)', width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-gray-600">{pct}/100</span>
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

function KPICard({ icon, color, value, label, sub }: { icon: string; color: string; value: any; label: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xl mb-3"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}
