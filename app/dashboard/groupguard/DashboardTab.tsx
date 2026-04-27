'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  AlertCircle,
  Users,
  UserX,
  X,
  Calendar,
  PieChart,
  BarChart3,
} from 'lucide-react';
import { useT } from '@/lib/i18n/useT';

// ============================================================================
// Types
// ============================================================================

type DashboardData = {
  days: number;
  daily_timeseries: Array<{
    date: string;
    total: number;
    kicks: number;
    deletes: number;
    warns: number;
  }>;
  by_source: Array<{ source: string; count: number }>;
  by_action: Array<{ action: string; count: number }>;
  top_spammers: Array<{
    phone: string;
    name: string | null;
    count: number;
    sources: string[];
  }>;
  top_groups: Array<{ group_id: string; group_name: string; count: number }>;
  ai_categories: Array<{ category: string; count: number }>;
  summary: { total: number; successful: number; failed: number };
};


// ============================================================================
// Main component
// ============================================================================

export default function DashboardTab({ workspaceId }: { workspaceId: string }) {
  const { t, locale } = useT();
  const [days, setDays] = useState<7 | 30 | 90>(7);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Translation maps - need to be inside component to use t()
  const sourceLabels: Record<string, string> = {
    ai: t('groupguard.log.trigger_ai'),
    manual_report: t('groupguard.log.trigger_manual_report'),
    phone_prefix: t('groupguard.log.trigger_phone_prefix'),
    global_blocklist: t('groupguard.log.trigger_global_blocklist'),
    whitelist: t('groupguard.log.trigger_whitelist'),
  };

  const actionLabels: Record<string, string> = {
    kick: t('groupguard.log.action_kick'),
    delete_message: t('groupguard.log.action_delete_message'),
    warn: t('groupguard.log.action_warn'),
    blocklist_add: t('groupguard.log.action_blocklist_add'),
    whitelist_skip: t('groupguard.log.action_whitelist_skip'),
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, days]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/groupguard/dashboard?workspace_id=${workspaceId}&days=${days}`,
      );
      const d = await res.json();
      if (!res.ok) setError(d.error);
      else {
        setData(d);
        setError(null);
      }
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  if (loading && !data) {
    return <div className="text-center py-8 text-gray-500">{t('groupguard.dashboard.loading') || t('groupguard.common.loading')}</div>;
  }
  if (error && !data) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {error}
      </div>
    );
  }
  if (!data) return null;

  const hasData = data.summary.total > 0;

  return (
    <div className="space-y-5">
      {/* Time range selector */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          {t('groupguard.dashboard.time_range') || 'Time range:'}
        </div>
        <div className="flex bg-gray-100 rounded-lg p-1">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                days === d
                  ? 'bg-white text-purple-700 shadow-sm font-medium'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {d} {t('groupguard.dashboard.days') || 'days'}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-12">
          <BarChart3 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">{t('groupguard.dashboard.no_data_range')}</p>
          <p className="text-xs text-gray-400 mt-1">
            {t('groupguard.dashboard.no_data_hint') || 'Actions will appear here when GroupGuard detects spammers'}
          </p>
        </div>
      ) : (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label={t('groupguard.dashboard.total_actions') || 'Total actions'}
              value={data.summary.total}
              icon={<TrendingUp className="w-4 h-4" />}
              color="purple"
              locale={locale}
            />
            <StatCard
              label={t('groupguard.dashboard.successful') || 'Successful'}
              value={data.summary.successful}
              icon={<UserX className="w-4 h-4" />}
              color="green"
              locale={locale}
            />
            <StatCard
              label={t('groupguard.log.failures')}
              value={data.summary.failed}
              icon={<AlertCircle className="w-4 h-4" />}
              color="red"
              locale={locale}
            />
            <StatCard
              label={t('groupguard.dashboard.daily_avg') || 'Daily avg'}
              value={Math.round(data.summary.total / data.days)}
              icon={<Calendar className="w-4 h-4" />}
              color="blue"
              locale={locale}
            />
          </div>

          {/* Daily timeseries chart */}
          <ChartCard title={t('groupguard.dashboard.actions_per_day') || 'Actions per day'} icon={<TrendingUp className="w-4 h-4" />}>
            <DailyChart data={data.daily_timeseries} />
          </ChartCard>

          {/* Two-column: source + action breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ChartCard title={t('groupguard.dashboard.by_source') || 'By detection source'} icon={<PieChart className="w-4 h-4" />}>
              <BreakdownList
                items={data.by_source.map((s) => ({
                  label: sourceLabels[s.source] || s.source,
                  value: s.count,
                  color: sourceColors[s.source] || '#6b7280',
                }))}
                emptyText={t('groupguard.common.no_data')}
              />
            </ChartCard>

            <ChartCard title={t('groupguard.dashboard.by_action') || 'By action type'} icon={<BarChart3 className="w-4 h-4" />}>
              <BreakdownList
                items={data.by_action.map((s) => ({
                  label: actionLabels[s.action] || s.action,
                  value: s.count,
                  color: actionColors[s.action] || '#6b7280',
                }))}
                emptyText={t('groupguard.common.no_data')}
              />
            </ChartCard>
          </div>

          {/* AI categories - only if AI was active */}
          {data.ai_categories.length > 0 && (
            <ChartCard title={t('groupguard.dashboard.ai_categories') || 'AI categories'} icon={<PieChart className="w-4 h-4" />}>
              <BreakdownList
                items={data.ai_categories.map((c) => ({
                  label: c.category,
                  value: c.count,
                  color: '#a855f7',
                }))}
                emptyText={t('groupguard.common.no_data')}
              />
            </ChartCard>
          )}

          {/* Two-column: top groups + top spammers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ChartCard title={t('groupguard.dashboard.top_groups') || 'Most active groups'} icon={<Users className="w-4 h-4" />}>
              {data.top_groups.length === 0 ? (
                <EmptyMini text={t('groupguard.common.no_data')} />
              ) : (
                <div className="space-y-2">
                  {data.top_groups.map((g) => (
                    <div key={g.group_id} className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1 text-gray-700">{g.group_name}</span>
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-medium text-xs">
                        {g.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>

            <ChartCard title={t('groupguard.dashboard.top_spammers') || 'Top spammers'} icon={<UserX className="w-4 h-4" />}>
              {data.top_spammers.length === 0 ? (
                <EmptyMini text={t('groupguard.common.no_data')} />
              ) : (
                <div className="space-y-2">
                  {data.top_spammers.slice(0, 5).map((s) => (
                    <div
                      key={s.phone}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-700 truncate">
                          {s.name || (
                            <span dir="ltr" className="font-mono text-xs">
                              +{s.phone}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 flex gap-1 mt-0.5">
                          {s.sources.map((src) => (
                            <span key={src} className="text-[10px]">
                              {sourceLabels[src] || src}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded font-medium text-xs flex-shrink-0">
                        {s.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}


// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  label,
  value,
  icon,
  color,
  locale,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'purple' | 'green' | 'red' | 'blue';
  locale?: string;
}) {
  const colorClasses = {
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
  };
  return (
    <div className={`p-3 border rounded-xl ${colorClasses[color]}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-80 mb-1">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold">{value.toLocaleString(locale === 'he' ? 'he-IL' : 'en-US')}</div>
    </div>
  );
}


function ChartCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      {children}
    </div>
  );
}


function EmptyMini({ text }: { text: string }) {
  return <div className="text-center text-xs text-gray-400 py-6">{text}</div>;
}


// ============================================================================
// Chart: Daily timeseries (SVG bar chart)
// ============================================================================

function DailyChart({
  data,
}: {
  data: Array<{
    date: string;
    total: number;
    kicks: number;
    deletes: number;
    warns: number;
  }>;
}) {
  const { t } = useT();
  const maxValue = Math.max(...data.map((d) => d.total), 1);
  const width = 100;
  const barWidth = 100 / data.length;

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs mb-3 justify-end">
        <LegendItem color="#dc2626" label={t('groupguard.dashboard.legend_kicks')} />
        <LegendItem color="#ea580c" label={t('groupguard.dashboard.legend_deletes')} />
        <LegendItem color="#d97706" label={t('groupguard.dashboard.legend_warns')} />
      </div>

      {/* Chart - using percentage-based viewBox so it's responsive */}
      <div className="relative" style={{ height: '160px' }}>
        <svg
          viewBox={`0 0 ${width} 100`}
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {/* Grid lines */}
          {[25, 50, 75].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2={width}
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="0.2"
              strokeDasharray="0.5 0.5"
            />
          ))}

          {/* Bars - stacked */}
          {data.map((d, i) => {
            const x = i * barWidth + barWidth * 0.15;
            const w = barWidth * 0.7;
            const total = d.total;
            const kicksH = total === 0 ? 0 : (d.kicks / maxValue) * 95;
            const deletesH = total === 0 ? 0 : (d.deletes / maxValue) * 95;
            const warnsH = total === 0 ? 0 : (d.warns / maxValue) * 95;
            let yCursor = 100;

            return (
              <g key={d.date}>
                {d.kicks > 0 && (
                  <rect
                    x={x}
                    y={yCursor - kicksH}
                    width={w}
                    height={kicksH}
                    fill="#dc2626"
                    rx="0.3"
                  />
                )}
                {(() => {
                  yCursor -= kicksH;
                  return null;
                })()}
                {d.deletes > 0 && (
                  <rect
                    x={x}
                    y={yCursor - deletesH}
                    width={w}
                    height={deletesH}
                    fill="#ea580c"
                    rx="0.3"
                  />
                )}
                {(() => {
                  yCursor -= deletesH;
                  return null;
                })()}
                {d.warns > 0 && (
                  <rect
                    x={x}
                    y={yCursor - warnsH}
                    width={w}
                    height={warnsH}
                    fill="#d97706"
                    rx="0.3"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Y axis label - max value */}
        <div className="absolute top-0 right-0 text-[10px] text-gray-400 -mt-1">
          {maxValue}
        </div>
        <div className="absolute bottom-0 right-0 text-[10px] text-gray-400">0</div>
      </div>

      {/* X axis - dates */}
      <div className="flex mt-2 px-1">
        {data.map((d, i) => {
          const date = new Date(d.date);
          const showLabel =
            data.length <= 14 ||
            i === 0 ||
            i === data.length - 1 ||
            i % Math.ceil(data.length / 7) === 0;
          return (
            <div
              key={d.date}
              className="flex-1 text-[10px] text-gray-500 text-center"
              dir="ltr"
            >
              {showLabel
                ? `${date.getDate()}/${date.getMonth() + 1}`
                : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-gray-600">{label}</span>
    </div>
  );
}


// ============================================================================
// Chart: Horizontal breakdown bars
// ============================================================================

function BreakdownList({
  items,
  emptyText,
}: {
  items: Array<{ label: string; value: number; color: string }>;
  emptyText?: string;
}) {
  const total = items.reduce((sum, i) => sum + i.value, 0);
  if (total === 0) return <EmptyMini text={emptyText || 'No data'} />;

  // Sort descending by value
  const sorted = [...items].sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-2">
      {sorted.map((item) => {
        const percent = (item.value / total) * 100;
        return (
          <div key={item.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-700 font-medium">{item.label}</span>
              <span className="text-gray-500">
                {item.value} ({percent.toFixed(0)}%)
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${percent}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ============================================================================
// Color maps (labels are now internal to the component for i18n)
// ============================================================================

const sourceColors: Record<string, string> = {
  ai: '#a855f7',
  manual_report: '#3b82f6',
  phone_prefix: '#10b981',
  global_blocklist: '#f59e0b',
  whitelist: '#6b7280',
};

const actionColors: Record<string, string> = {
  kick: '#dc2626',
  delete_message: '#ea580c',
  warn: '#d97706',
  blocklist_add: '#a855f7',
  whitelist_skip: '#6b7280',
};
