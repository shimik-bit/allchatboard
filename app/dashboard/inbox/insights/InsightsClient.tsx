// app/dashboard/inbox/insights/InsightsClient.tsx
// אנליטיקה מלאה ל-Inbox + המרת לקוחות לקווים ב-CRM
// תומך עברית/אנגלית
'use client';

import { useState } from 'react';
import { useT } from '@/lib/i18n/useT';
import Link from 'next/link';
import { 
  Inbox, ArrowRight, TrendingUp, Clock, AlertTriangle, 
  CheckCircle, Users, UserPlus, Sparkles, BarChart3 
} from 'lucide-react';

function fmtDuration(seconds: number | null | undefined, locale: string): string {
  if (!seconds || seconds <= 0) return '-';
  const minLabel = locale === 'he' ? 'דק׳' : 'min';
  const secLabel = locale === 'he' ? 'ש׳' : 's';
  const hourLabel = locale === 'he' ? 'שעות' : 'h';
  const dayLabel = locale === 'he' ? 'ימים' : 'days';
  if (seconds < 60) return `${Math.round(seconds)}${secLabel}`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} ${minLabel}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hourLabel}`;
  const days = Math.round(hours / 24);
  return `${days} ${dayLabel}`;
}

function fmtDate(d: string, locale: string): string {
  return new Date(d).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', { day: '2-digit', month: '2-digit' });
}

function timeAgo(d: string, t: any): string {
  if (!d) return '';
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return t('time_units.just_now');
  if (diff < 3600) return t('time_units.minutes_ago', { n: Math.floor(diff / 60) });
  if (diff < 86400) return t('time_units.hours_ago', { n: Math.floor(diff / 3600) });
  return t('time_units.days_ago', { n: Math.floor(diff / 86400) });
}

export default function InsightsClient({
  kpis,
  byReason,
  topCustomers,
  dailyStats,
}: {
  kpis: any;
  byReason: any[];
  topCustomers: any[];
  dailyStats: any[];
}) {
  const { t, locale, dir } = useT();
  const [convertingPhone, setConvertingPhone] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  async function handleConvertToLead(phone: string) {
    if (convertingPhone) return;
    setConvertingPhone(phone);
    setToast(null);

    try {
      const escRes = await fetch(`/api/inbox/find-escalation?phone=${encodeURIComponent(phone)}`);
      const escResult = await escRes.json();
      
      if (!escRes.ok || !escResult.escalation_id) {
        setToast({ msg: t('inbox_insights.not_found_escalation'), type: 'err' });
        return;
      }

      const res = await fetch('/api/inbox/convert-to-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escalation_id: escResult.escalation_id }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        setToast({ 
          msg: result.error || t('inbox_insights.convert_failed'), 
          type: 'err' 
        });
        return;
      }

      setToast({
        msg: result.already_exists ? '✅ ' + t('inbox_insights.lead_already_exists') : '🎉 ' + t('inbox_insights.lead_created'),
        type: 'ok',
      });

      setTimeout(() => {
        window.location.href = `/dashboard/hub/crm/leads/${result.lead_id}`;
      }, 1500);

    } catch (err) {
      setToast({ msg: t('inbox_insights.network_error'), type: 'err' });
    } finally {
      setTimeout(() => {
        setConvertingPhone(null);
        setToast(null);
      }, 3000);
    }
  }

  const maxDaily = Math.max(...dailyStats.map((d: any) => Number(d.new_escalations) || 0), 1);
  const dailyReversed = [...dailyStats].reverse().slice(-14);
  const totalByReason = byReason.reduce((s: number, r: any) => s + Number(r.count), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-6" dir={dir}>
      <div className="max-w-7xl mx-auto">
        
        {toast && (
          <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-white ${
            toast.type === 'ok' ? 'bg-green-500' : 'bg-red-500'
          }`}>
            {toast.msg}
          </div>
        )}

        <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl"
              style={{ background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)' }}
            >
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('inbox_insights.title')}</h1>
              <p className="text-sm text-gray-500">{t('inbox_insights.subtitle')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link 
              href="/dashboard/inbox"
              className="text-sm bg-white px-4 py-2 rounded-lg border hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Inbox className="w-4 h-4" />
              <span>{t('inbox_insights.back_to_inbox')}</span>
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KPICard 
            icon={<AlertTriangle className="w-5 h-5" />} 
            color="#EF4444" 
            value={kpis.urgent_active || 0} 
            label={t('inbox_insights.kpi_urgent_active')} 
          />
          <KPICard 
            icon={<Inbox className="w-5 h-5" />} 
            color="#3B82F6" 
            value={kpis.open_count || 0} 
            label={t('inbox_insights.kpi_open')} 
          />
          <KPICard 
            icon={<Clock className="w-5 h-5" />} 
            color="#F59E0B" 
            value={fmtDuration(kpis.avg_response_seconds, locale)} 
            label={t('inbox_insights.kpi_avg_response')} 
          />
          <KPICard 
            icon={<CheckCircle className="w-5 h-5" />} 
            color="#10B981" 
            value={`${kpis.resolution_rate_percent || 0}%`} 
            label={t('inbox_insights.kpi_resolution_rate')} 
            sub={`${kpis.resolved_count || 0} ${t('inbox_insights.kpi_resolution_sub')} ${kpis.total_escalations || 0}`}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 border shadow-sm">
            <div className="text-xs text-gray-500 mb-1">{t('inbox_insights.last_24h')}</div>
            <div className="text-2xl font-bold text-gray-900">{kpis.last_24h || 0}</div>
            <div className="text-xs text-gray-400 mt-1">{t('inbox_insights.new_escalations')}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border shadow-sm">
            <div className="text-xs text-gray-500 mb-1">{t('inbox_insights.last_7d')}</div>
            <div className="text-2xl font-bold text-gray-900">{kpis.last_7d || 0}</div>
            <div className="text-xs text-gray-400 mt-1">{t('inbox_insights.new_escalations')}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border shadow-sm">
            <div className="text-xs text-gray-500 mb-1">{t('inbox_insights.avg_resolution')}</div>
            <div className="text-2xl font-bold text-gray-900">{fmtDuration(kpis.avg_resolution_seconds, locale)}</div>
            <div className="text-xs text-gray-400 mt-1">{t('inbox_insights.open_to_resolved')}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          
          <div className="bg-white rounded-2xl p-5 shadow-sm border">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {t('inbox_insights.trend_title')}
            </h3>
            
            {dailyReversed.length === 0 ? (
              <div className="text-center text-gray-400 py-8">{t('inbox_insights.no_data')}</div>
            ) : (
              <div className="flex items-end gap-1 h-32" dir="ltr">
                {dailyReversed.map((d: any, idx: number) => {
                  const count = Number(d.new_escalations) || 0;
                  const urgent = Number(d.urgent_count) || 0;
                  const height = (count / maxDaily) * 100;
                  return (
                    <div 
                      key={idx} 
                      className="flex-1 flex flex-col items-center gap-1 group relative"
                      title={`${fmtDate(d.day, locale)}: ${count}${urgent > 0 ? ` (${urgent} urgent)` : ''}`}
                    >
                      <div className="w-full bg-blue-100 rounded-t flex flex-col-reverse" style={{ height: `${Math.max(height, 2)}%`, minHeight: '4px' }}>
                        {urgent > 0 && (
                          <div className="bg-red-500 rounded-t" style={{ height: `${(urgent / count) * 100}%`, minHeight: '2px' }} />
                        )}
                        <div className="bg-blue-500 rounded-t flex-1" />
                      </div>
                      <div className="text-[9px] text-gray-400">{fmtDate(d.day, locale)}</div>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="flex gap-3 mt-3 text-xs">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded" />
                <span className="text-gray-600">{t('inbox_insights.legend_normal')}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-500 rounded" />
                <span className="text-gray-600">{t('inbox_insights.legend_urgent')}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              {t('inbox_insights.by_reason_title')}
            </h3>
            
            {byReason.length === 0 ? (
              <div className="text-center text-gray-400 py-8">{t('inbox_insights.no_data')}</div>
            ) : (
              <div className="space-y-2">
                {byReason.slice(0, 6).map((r: any) => {
                  const pct = totalByReason > 0 ? (Number(r.count) / totalByReason) * 100 : 0;
                  // Try translated reason name
                  const reasonKey = `inbox_reports.reason_${r.reason}`;
                  const translatedReason = t(reasonKey);
                  const reasonLabel = translatedReason === reasonKey ? r.reason : translatedReason;
                  return (
                    <div key={r.reason}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-700">{reasonLabel}</span>
                        <span className="font-bold text-gray-900">{r.count} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full" 
                          style={{ 
                            width: `${pct}%`,
                            background: 'linear-gradient(90deg,#3B82F6,#8B5CF6)'
                          }} 
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            {t('inbox_insights.top_customers_title')}
          </h3>
          
          {topCustomers.length === 0 ? (
            <div className="text-center text-gray-400 py-8">{t('inbox_insights.no_data')}</div>
          ) : (
            <div className="space-y-2">
              {topCustomers.map((c: any) => (
                <div 
                  key={c.source_phone}
                  className="flex items-center gap-3 p-3 bg-gradient-to-l from-blue-50 to-white rounded-lg border border-blue-100"
                >
                  <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                    {c.source_phone?.slice(-2) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 text-sm">
                      {c.source_phone}
                      {c.is_lead && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded mx-2">
                          ✓ {t('inbox_insights.is_lead_badge')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {c.escalations_count} {t('inbox_insights.customer_escalations')}
                      {c.urgent_count > 0 && <span className="text-red-600 mx-2">· {c.urgent_count} {t('inbox_insights.customer_urgent')}</span>}
                      {c.active_count > 0 && <span className="text-amber-600 mx-2">· {c.active_count} {t('inbox_insights.customer_open')}</span>}
                      <span className="mx-2">· {timeAgo(c.last_escalation_at, t)}</span>
                    </div>
                  </div>
                  
                  {!c.is_lead ? (
                    <button
                      onClick={() => handleConvertToLead(c.source_phone)}
                      disabled={convertingPhone === c.source_phone}
                      className="text-xs px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 flex items-center gap-1 whitespace-nowrap"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      {convertingPhone === c.source_phone ? t('inbox_insights.converting') : t('inbox_insights.convert_button')}
                    </button>
                  ) : (
                    <Link
                      href={`/dashboard/hub/crm/kanban`}
                      className="text-xs px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1 whitespace-nowrap"
                    >
                      <ArrowRight className={`w-3.5 h-3.5 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
                      {t('inbox_insights.to_crm')}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function KPICard({ icon, color, value, label, sub }: { 
  icon: React.ReactNode; 
  color: string; 
  value: any; 
  label: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white mb-3"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}
