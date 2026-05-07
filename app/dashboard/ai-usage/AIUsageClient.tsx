'use client';

import { useRouter } from 'next/navigation';
import {
  Brain,
  Activity,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  MessageCircle,
  Bot,
  Zap,
  FileText,
  Shield,
  UserCheck,
  Inbox,
  Sheet,
  PenLine,
} from 'lucide-react';
import {
  FEATURE_LABELS_HE,
  FEATURE_DESCRIPTIONS_HE,
  type AIFeature,
} from '@/lib/ai/log-usage';

/**
 * Per-feature presentation metadata.
 *
 * The AI_FEATURES enum (in lib/ai/log-usage.ts) defines the canonical set
 * of feature keys that get written to ai_usage_log.feature. This map
 * adds visual styling (icon + color) on top, separately from the labels
 * (those live in the helper alongside the enum so the helper is the
 * single source of truth for string representation).
 *
 * 'other' is a fallback for any unrecognized feature value — could happen
 * if an old log row uses a deprecated feature name or if a new feature
 * was added but this map wasn't updated yet.
 */
const FEATURE_VISUALS: Record<
  AIFeature | 'other',
  { icon: any; color: string }
> = {
  spam_classification: { icon: Shield, color: 'text-red-600 bg-red-50' },
  group_summary: { icon: FileText, color: 'text-purple-600 bg-purple-50' },
  profile_extraction: { icon: UserCheck, color: 'text-blue-600 bg-blue-50' },
  lead_routing: { icon: Inbox, color: 'text-emerald-600 bg-emerald-50' },
  excel_analysis: { icon: Sheet, color: 'text-green-600 bg-green-50' },
  message_compose: { icon: PenLine, color: 'text-indigo-600 bg-indigo-50' },
  focus_briefing: { icon: Zap, color: 'text-amber-600 bg-amber-50' },
  knowledge_bot: { icon: Brain, color: 'text-pink-600 bg-pink-50' },
  other: { icon: Activity, color: 'text-gray-500 bg-gray-50' },
};

function getFeatureMeta(key: string) {
  const visual = (FEATURE_VISUALS as any)[key] || FEATURE_VISUALS.other;
  const label =
    (FEATURE_LABELS_HE as any)[key] ||
    // Fallback for unrecognized keys: humanize the snake_case
    key.replace(/_/g, ' ');
  const description = (FEATURE_DESCRIPTIONS_HE as any)[key] || null;
  return { ...visual, label, description };
}

export default function AIUsageClient({
  workspace,
  allWorkspaces,
  summary,
  byFeature,
  daily,
  recent,
}: any) {
  const router = useRouter();

  const quotaPct = summary 
    ? Math.min(100, (Number(summary.messages_this_month) / Math.max(Number(summary.plan_quota), 1)) * 100)
    : 0;

  // Aggregate features. We sum tokens too so the per-feature card can
  // show "X calls · Y tokens · ₪Z" — gives users a sense of which
  // features are token-heavy (long prompts) vs call-heavy (many small
  // prompts).
  const featureMap: Record<
    string,
    { count: number; cost: number; charged: number; tokens: number }
  > = {};
  for (const r of byFeature) {
    if (!featureMap[r.feature]) {
      featureMap[r.feature] = { count: 0, cost: 0, charged: 0, tokens: 0 };
    }
    featureMap[r.feature].count++;
    featureMap[r.feature].cost += Number(r.cost_ils || 0);
    featureMap[r.feature].charged += Number(r.charged_ils || 0);
    featureMap[r.feature].tokens +=
      Number(r.tokens_input || 0) + Number(r.tokens_output || 0);
  }
  // Sort by call count descending — most-used features at the top, which
  // is usually what people want to see first when figuring out where
  // their quota is going.
  const features = Object.entries(featureMap).sort(
    (a, b) => b[1].count - a[1].count,
  );
  const totalCalls = features.reduce((acc, [, v]) => acc + v.count, 0);

  const maxDaily = Math.max(...daily.map((d: any) => Number(d.message_count)), 1);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-3xl mb-1 flex items-center gap-2">
            <Brain className="w-7 h-7 text-purple-600" />
            ניתוח שימוש ב-AI
          </h1>
          <p className="text-gray-500 text-sm">סטטיסטיקה וחיוב על שימוש ב-AI</p>
        </div>
        {allWorkspaces.length > 1 && (
          <select
            value={workspace.id}
            onChange={(e) => router.push(`/dashboard/ai-usage?ws=${e.target.value}`)}
            className="text-sm bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm"
          >
            {allWorkspaces.map((ws: any) => (
              <option key={ws.id} value={ws.id}>{ws.icon || '📊'} {ws.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Quota status banner */}
      {summary && (
        <div className={`mb-6 rounded-2xl p-5 ${
          summary.quota_status === 'overage' ? 'bg-gradient-to-br from-red-500 to-orange-600 text-white' :
          summary.quota_status === 'warning' ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-white' :
          'bg-gradient-to-br from-purple-600 to-pink-600 text-white'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs opacity-90 mb-1">החודש (תוכנית {summary.plan})</div>
              <div className="text-3xl font-bold">{summary.messages_this_month} <span className="text-base opacity-80">/ {summary.plan_quota}</span></div>
              <div className="text-xs opacity-80 mt-1">הודעות AI</div>
            </div>
            <Sparkles className="w-12 h-12 opacity-30" />
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white/80" style={{ width: `${quotaPct}%` }} />
          </div>
          {summary.overage_msgs_this_month > 0 && (
            <div className="mt-3 text-sm flex items-center gap-2 bg-white/10 rounded-lg p-2">
              <AlertTriangle className="w-4 h-4" />
              <span>חרגת ב-{summary.overage_msgs_this_month} הודעות · עלות נוספת: <b>₪{Number(summary.charged_this_month_ils).toFixed(2)}</b></span>
            </div>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="הודעות החודש" value={summary?.messages_this_month || 0} icon={Activity} />
        <StatCard label="טוקנים" value={(summary?.tokens_this_month || 0).toLocaleString()} icon={Brain} />
        <StatCard label="חויב החודש" value={`₪${Number(summary?.charged_this_month_ils || 0).toFixed(2)}`} icon={TrendingUp} colored />
        <StatCard label="מחיר overage" value={`₪${Number(summary?.overage_price || 0).toFixed(2)}/הודעה`} icon={Sparkles} />
      </div>

      {/* Daily chart */}
      {daily.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
          <h2 className="font-bold text-sm mb-4">שימוש יומי (30 ימים אחרונים)</h2>
          <div className="flex items-end gap-1 h-24" dir="ltr">
            {daily.map((d: any, i: number) => {
              const h = (Number(d.message_count) / maxDaily) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.day}: ${d.message_count} הודעות`}>
                  <div className="w-full bg-purple-500 rounded-t" style={{ height: `${h}%`, minHeight: d.message_count > 0 ? '2px' : '0' }} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-feature breakdown */}
      {features.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm">איפה ה-AI נוצל (7 ימים אחרונים)</h2>
            <span className="text-xs text-gray-400">
              {totalCalls.toLocaleString('he-IL')} קריאות סה"כ
            </span>
          </div>
          <div className="space-y-2">
            {features.map(([key, stats]) => {
              const meta = getFeatureMeta(key);
              const Icon = meta.icon;
              const pct = totalCalls > 0 ? (stats.count / totalCalls) * 100 : 0;
              return (
                <div
                  key={key}
                  className="border border-gray-100 rounded-xl p-3 hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg ${meta.color} grid place-items-center flex-shrink-0`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <div className="font-medium text-sm">{meta.label}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 flex-shrink-0">
                          <span>{stats.count.toLocaleString('he-IL')} קריאות</span>
                          <span className="text-gray-300">·</span>
                          <span>{(stats.tokens / 1000).toFixed(1)}K טוקנים</span>
                          {stats.charged > 0 && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="text-emerald-600 font-medium">
                                ₪{stats.charged.toFixed(2)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      {meta.description && (
                        <div className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                          {meta.description}
                        </div>
                      )}
                      {/* Visual share indicator — same color family as the
                          icon, so visually anchors the row to the feature. */}
                      <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${meta.color
                            .split(' ')
                            .find((c: string) => c.startsWith('bg-')) || 'bg-purple-500'}`}
                          style={{ width: `${pct}%`, opacity: 0.8 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent calls */}
      {recent.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-bold text-sm">פעילות אחרונה</h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {recent.map((r: any, i: number) => {
              const meta = getFeatureMeta(r.feature);
              return (
                <li key={i} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  <div className={`w-1.5 h-1.5 rounded-full ${r.is_overage ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span className="text-xs font-medium">{meta.label}</span>
                  <span className="text-xs text-gray-400 flex-1">in:{r.tokens_input} out:{r.tokens_output}</span>
                  <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  {Number(r.charged_ils) > 0 && (
                    <span className="text-emerald-600 font-bold">₪{Number(r.charged_ils).toFixed(2)}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!summary || summary.messages_this_month === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Brain className="w-16 h-16 mx-auto mb-3 opacity-30" />
          <p className="font-medium">עדיין אין שימוש ב-AI החודש</p>
          <p className="text-xs">הסטטיסטיקה תופיע כשהבוט יענה ללקוחות</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, colored }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <div className="text-xs text-gray-500 flex items-center gap-1 mb-1">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className={`text-xl font-bold ${colored ? 'text-emerald-600' : ''}`}>{value}</div>
    </div>
  );
}
