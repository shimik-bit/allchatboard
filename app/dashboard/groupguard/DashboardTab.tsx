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
  const [showAddSpammerModal, setShowAddSpammerModal] = useState(false);

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
      {/* Time range selector + manual spammer add */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          {t('groupguard.dashboard.time_range') || 'Time range:'}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Manual add to spammer list. Sits next to the time range so it
              feels like part of the dashboard's main controls. Opens a small
              modal — kept inline in this file rather than a separate
              component because the form is tiny (3 fields) and only used
              from this one place. */}
          <button
            onClick={() => setShowAddSpammerModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors"
            title="הוסף מספר ידנית למאגר הספאמרים"
          >
            <UserX className="w-4 h-4" />
            הוסף ספאמר ידנית
          </button>
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
      </div>

      {/* Manual spammer add modal */}
      {showAddSpammerModal && (
        <ManualSpammerModal
          workspaceId={workspaceId}
          onClose={() => setShowAddSpammerModal(false)}
          onSuccess={() => {
            // Refresh the dashboard so the new spammer (if they show up
            // in actions in the future) gets reflected. The blocklist
            // itself is queried at every incoming message — no refresh
            // needed for the bot to start using the new entry.
            load();
          }}
        />
      )}

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


// ============================================================================
// ManualSpammerModal — small inline form for adding a phone to the blocklist
// ============================================================================
//
// Lives inline here rather than its own file because it's only used from
// the DashboardTab and the form is just three fields. If a second consumer
// ever needs this, it should be promoted to /components.
//
// Validation strategy: do basic length checks here for instant feedback,
// but rely on the API for the final say on what's a valid phone — the API
// also has membership checks, normalization, and DB constraints we
// shouldn't duplicate.

function ManualSpammerModal({
  workspaceId,
  onClose,
  onSuccess,
}: {
  workspaceId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Reason dropdown options. Stored as the raw Hebrew string in
  // gg_global_blocklist.reason_summary — we don't need an enum because the
  // existing detection-pipeline's reason field is also free-text.
  const reasonOptions = [
    { value: '', label: 'ללא סיבה ספציפית' },
    { value: 'spam', label: 'ספאם' },
    { value: 'scam', label: 'הונאה / scam' },
    { value: 'harassment', label: 'הטרדה' },
    { value: 'inappropriate', label: 'תוכן לא הולם' },
    { value: 'other', label: 'אחר' },
  ];

  // Normalize what the user sees as they type. Doesn't change what gets
  // submitted (the API does its own normalization), just makes the input
  // less confusing — shows what will actually be stored.
  const phoneDigits = phone.replace(/\D/g, '');
  const phoneValid = phoneDigits.length >= 8 && phoneDigits.length <= 15;

  async function handleSubmit() {
    if (!phoneValid || submitting) return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/groupguard/blocklist/manual-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          phone: phoneDigits,
          reason: reason || undefined,
          notes: notes.trim() || undefined,
        }),
      });

      // Same robust error-handling pattern used by the avatar backfill
      // handler — check res.ok BEFORE parsing JSON, so a 504/500 with an
      // HTML body doesn't trigger Safari's opaque parse-error message.
      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        setResult({
          type: 'error',
          text: `שגיאת שרת ${res.status}: ${bodyText.slice(0, 200) || '(תגובה ריקה)'}`,
        });
        return;
      }

      const d: { ok?: boolean; message?: string; error?: string; action?: string } =
        await res.json();
      if (!d.ok) {
        setResult({ type: 'error', text: d.error || 'שגיאה לא ידועה' });
        return;
      }

      setResult({
        type: 'success',
        text: d.message || 'נוסף בהצלחה',
      });
      onSuccess();
      // Auto-close after the user has had a moment to read the success
      // message. 1.5s is short enough not to feel sluggish, long enough
      // to register.
      setTimeout(onClose, 1500);
    } catch (e: any) {
      const errName = e?.name ? `${e.name}: ` : '';
      setResult({
        type: 'error',
        text: `${errName}${e?.message || String(e)}`,
      });
      // eslint-disable-next-line no-console
      console.error('[manual-spammer] submit error:', e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <UserX className="w-5 h-5 text-red-600" />
            הוספת ספאמר ידנית
          </h3>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1 hover:bg-gray-100 rounded disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-xs text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            המספר ייכנס למאגר הספאמרים הגלובלי. כל הודעה שתגיע ממנו לקבוצות
            המנוטרות תזוהה אוטומטית והבוט יבעט אותו.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              מספר טלפון <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="972501234567 או +972501234567"
              dir="ltr"
              autoFocus
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
            />
            {phone && !phoneValid && (
              <p className="text-xs text-red-600 mt-1">
                מספר חייב להיות בין 8 ל-15 ספרות (כרגע: {phoneDigits.length})
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              סיבה
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
            >
              {reasonOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              הערות (אופציונלי)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="פרטים נוספים, הקשר, מה הוא עשה..."
              rows={3}
              maxLength={500}
              disabled={submitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
            />
            <p className="text-xs text-gray-400 text-left mt-0.5">
              {notes.length}/500
            </p>
          </div>

          {result && (
            <div
              className={`text-xs px-3 py-2 rounded-lg border ${
                result.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {result.text}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            onClick={handleSubmit}
            disabled={!phoneValid || submitting}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'מוסיף...' : 'הוסף למאגר'}
          </button>
        </div>
      </div>
    </div>
  );
}
