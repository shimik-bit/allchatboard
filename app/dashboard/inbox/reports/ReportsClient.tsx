// app/dashboard/inbox/reports/ReportsClient.tsx
// דשבורד דוחות מקצועי לאינבוקס - SLA, percentiles, heatmap, top issues, trends
'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown, Minus, Clock, Target, Award,
  AlertTriangle, CheckCircle, Activity, BarChart3,
  Download, ArrowRight, Zap, Inbox,
} from 'lucide-react';

const REASON_LABELS: Record<string, string> = {
  customer_request: '🙋 בקשת לקוח',
  ai_uncertain: '🤖 AI לא בטוח',
  complaint: '😡 תלונה',
  payment: '💰 תשלום',
  technical: '🔧 טכני',
  human_handoff: '👤 העברה',
  bot_failed: '⚠️ בוט נכשל',
  other: '📋 אחר',
};

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function fmtDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '—';
  const s = Number(seconds);
  if (s < 60) return `${Math.round(s)} שניות`;
  if (s < 3600) return `${Math.round(s / 60)} דקות`;
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return m > 0 ? `${h}:${String(m).padStart(2, '0')} שעות` : `${h} שעות`;
  }
  return `${Math.round(s / 86400)} ימים`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
}

export default function ReportsClient({
  kpis,
  heatmap,
  topIssues,
  weekComparison,
  trend,
}: {
  kpis: any;
  heatmap: any[];
  topIssues: any[];
  weekComparison: any;
  trend: any[];
}) {
  const [exporting, setExporting] = useState(false);

  // Build heatmap matrix [day_of_week][hour_of_day]
  const heatmapMatrix: Record<number, Record<number, number>> = {};
  let maxHeatmapCount = 0;
  heatmap.forEach((h: any) => {
    if (!heatmapMatrix[h.day_of_week]) heatmapMatrix[h.day_of_week] = {};
    heatmapMatrix[h.day_of_week][h.hour_of_day] = Number(h.count);
    maxHeatmapCount = Math.max(maxHeatmapCount, Number(h.count));
  });

  // Find peak hour
  let peakHour = '';
  let peakCount = 0;
  heatmap.forEach((h: any) => {
    if (Number(h.count) > peakCount) {
      peakCount = Number(h.count);
      peakHour = `${DAYS_HE[h.day_of_week]} ${String(h.hour_of_day).padStart(2, '0')}:00`;
    }
  });

  // Trend chart - last 14 days, oldest first
  const trendReversed = [...trend].slice(0, 14).reverse();
  const maxTrendCount = Math.max(...trendReversed.map((t: any) => Number(t.new_count) || 0), 1);

  // Week comparison - delta calculations
  const volumeDelta = Number(weekComparison.volume_change_percent) || 0;
  const volumeDirection = volumeDelta > 0 ? 'up' : volumeDelta < 0 ? 'down' : 'flat';

  async function handleExportCSV() {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await fetch('/api/inbox/export');
      if (!res.ok) {
        alert('ייצוא נכשל');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inbox-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert('שגיאה: ' + (err as any)?.message);
    } finally {
      setExporting(false);
    }
  }

  // Color for heatmap cell
  function heatColor(count: number): string {
    if (count === 0) return '#F3F4F6';
    const ratio = count / maxHeatmapCount;
    if (ratio < 0.25) return '#DBEAFE';
    if (ratio < 0.5) return '#93C5FD';
    if (ratio < 0.75) return '#3B82F6';
    return '#1D4ED8';
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl"
              style={{ background: 'linear-gradient(135deg,#3B82F6,#1D4ED8)' }}
            >
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">דוחות Inbox</h1>
              <p className="text-sm text-gray-500">SLA, ביצועים, מגמות וטופ issues</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="text-sm bg-white px-4 py-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>{exporting ? 'מייצא...' : 'ייצוא CSV'}</span>
            </button>
            <Link
              href="/dashboard/inbox/insights"
              className="text-sm bg-white px-4 py-2 rounded-lg border hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Activity className="w-4 h-4" />
              <span>תובנות</span>
            </Link>
            <Link
              href="/dashboard/inbox"
              className="text-sm bg-white px-4 py-2 rounded-lg border hover:bg-gray-50 flex items-center gap-1.5"
            >
              <Inbox className="w-4 h-4" />
              <span>חזרה</span>
            </Link>
          </div>
        </header>

        {/* TOP ROW: SLA + Resolution Rate */}
        <section className="mb-6">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-3">📋 SLA וביצועים</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <BigKPI
              icon={<Zap className="w-5 h-5" />}
              color="#10B981"
              value={`${kpis.sla_4h_percent || 0}%`}
              label="SLA 4 שעות"
              sub={`נפתרו תוך 4 שעות`}
              isGood={Number(kpis.sla_4h_percent) >= 80}
            />
            <BigKPI
              icon={<Clock className="w-5 h-5" />}
              color="#3B82F6"
              value={`${kpis.sla_24h_percent || 0}%`}
              label="SLA 24 שעות"
              sub={`נפתרו תוך 24 שעות`}
              isGood={Number(kpis.sla_24h_percent) >= 95}
            />
            <BigKPI
              icon={<Target className="w-5 h-5" />}
              color="#7C3AED"
              value={`${kpis.resolution_rate || 0}%`}
              label="אחוז פתרון"
              sub={`${kpis.resolved || 0} מתוך ${kpis.total || 0}`}
              isGood={Number(kpis.resolution_rate) >= 70}
            />
            <BigKPI
              icon={<AlertTriangle className="w-5 h-5" />}
              color="#EF4444"
              value={kpis.urgent_active || 0}
              label="דחופות פתוחות"
              sub={`דורשים טיפול מיידי`}
              isGood={Number(kpis.urgent_active) === 0}
            />
          </div>
        </section>

        {/* SECOND ROW: Response & Resolution Times */}
        <section className="mb-6">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-3">⏱️ זמני תגובה ופתרון</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Response Times */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                זמן תגובה ראשונה (Pickup)
              </h3>
              <div className="space-y-2">
                <PercentileBar 
                  label="ממוצע" 
                  value={fmtDuration(kpis.avg_response_seconds)} 
                  color="#3B82F6"
                />
                <PercentileBar 
                  label="חציון (P50)" 
                  value={fmtDuration(kpis.p50_response_seconds)} 
                  color="#8B5CF6"
                  hint="50% מהפניות נענות תוך זמן זה"
                />
                <PercentileBar 
                  label="P90 (גרוע מהממוצע)" 
                  value={fmtDuration(kpis.p90_response_seconds)} 
                  color="#EF4444"
                  hint="רק 10% מהפניות מחכות יותר"
                />
              </div>
            </div>

            {/* Resolution Times */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                זמן פתרון מלא
              </h3>
              <div className="space-y-2">
                <PercentileBar 
                  label="ממוצע כללי" 
                  value={fmtDuration(kpis.avg_resolution_seconds)} 
                  color="#10B981"
                />
                <PercentileBar 
                  label="🚨 דחופות (urgent)" 
                  value={fmtDuration(kpis.avg_resolution_urgent_seconds)} 
                  color="#EF4444"
                />
                <PercentileBar 
                  label="📋 רגילות (normal)" 
                  value={fmtDuration(kpis.avg_resolution_normal_seconds)} 
                  color="#3B82F6"
                />
              </div>
            </div>
          </div>
        </section>

        {/* THIRD ROW: Week Comparison */}
        <section className="mb-6">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-3">📊 השוואת שבועות</div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              
              <CompareCell 
                label="כמות פניות" 
                thisWeek={weekComparison.this_count || 0}
                lastWeek={weekComparison.last_count || 0}
                change={volumeDelta}
                direction={volumeDirection}
              />
              <CompareCell 
                label="דחופות" 
                thisWeek={weekComparison.this_urgent || 0}
                lastWeek={weekComparison.last_urgent || 0}
                lowerIsBetter
              />
              <CompareCell 
                label="נפתרו" 
                thisWeek={weekComparison.this_resolved || 0}
                lastWeek={weekComparison.last_resolved || 0}
              />
              <CompareCell 
                label="זמן פתרון ממוצע" 
                thisWeek={fmtDuration(weekComparison.this_avg_resolution)}
                lastWeek={fmtDuration(weekComparison.last_avg_resolution)}
                isText
              />
            </div>
          </div>
        </section>

        {/* FOURTH ROW: Top Issues */}
        <section className="mb-6">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-3">🎯 טופ Issues</div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border">
            <h3 className="font-bold text-gray-900 mb-4">סיבות פנייה - לפי שכיחות וביצועי טיפול</h3>
            
            {topIssues.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">אין נתונים</p>
            ) : (
              <div className="space-y-3">
                {topIssues.slice(0, 8).map((issue: any) => {
                  const total = topIssues.reduce((s: number, i: any) => s + Number(i.total_count), 0);
                  const pct = total > 0 ? (Number(issue.total_count) / total) * 100 : 0;
                  const resolutionRate = Number(issue.resolution_rate_percent) || 0;
                  return (
                    <div key={issue.reason} className="border-b border-gray-100 last:border-b-0 pb-3 last:pb-0">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 text-sm">
                            {REASON_LABELS[issue.reason] || issue.reason}
                          </div>
                          <div className="flex gap-3 text-xs text-gray-500 mt-1">
                            <span><strong className="text-gray-700">{issue.total_count}</strong> סה"כ</span>
                            {issue.urgent_count > 0 && (
                              <span className="text-red-600">🚨 {issue.urgent_count} דחופות</span>
                            )}
                            <span className="text-emerald-600">✓ {issue.resolved_count} נפתרו</span>
                            <span>⏱️ {fmtDuration(issue.avg_resolution_seconds)}</span>
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="text-2xl font-bold text-gray-900">{pct.toFixed(0)}%</div>
                          <div className="text-xs text-gray-500">מהפניות</div>
                        </div>
                      </div>
                      
                      {/* Stacked bar: total + resolution rate */}
                      <div className="flex gap-1">
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                          <div 
                            className="h-full rounded-full"
                            style={{ 
                              width: `${pct}%`,
                              background: 'linear-gradient(90deg,#3B82F6,#8B5CF6)'
                            }}
                          />
                        </div>
                        <span className={`text-xs font-bold whitespace-nowrap ${
                          resolutionRate >= 70 ? 'text-emerald-600' : resolutionRate >= 40 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {resolutionRate}% פתרון
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* FIFTH ROW: Heatmap */}
        <section className="mb-6">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-3 flex items-center justify-between">
            <span>🔥 שעות שיא - מתי מקבלים פניות</span>
            {peakHour && (
              <span className="text-xs text-gray-400 normal-case">
                שיא: <strong className="text-blue-600">{peakHour}</strong> ({peakCount} פניות)
              </span>
            )}
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Hour labels */}
              <div className="flex gap-0.5 mb-1 mr-12">
                {Array.from({ length: 24 }, (_, h) => (
                  <div 
                    key={h} 
                    className="flex-1 text-center text-[9px] text-gray-400"
                    style={{ minWidth: '20px' }}
                  >
                    {h}
                  </div>
                ))}
              </div>

              {/* Heatmap rows */}
              {[0, 1, 2, 3, 4, 5, 6].map(dow => (
                <div key={dow} className="flex items-center gap-0.5 mb-0.5">
                  <div className="text-xs text-gray-600 w-12 ml-1 text-left">{DAYS_HE[dow]}</div>
                  {Array.from({ length: 24 }, (_, h) => {
                    const count = heatmapMatrix[dow]?.[h] || 0;
                    return (
                      <div
                        key={h}
                        className="flex-1 rounded-sm cursor-help transition-all hover:scale-110"
                        style={{ 
                          backgroundColor: heatColor(count),
                          minWidth: '20px',
                          height: '20px',
                        }}
                        title={`${DAYS_HE[dow]} ${String(h).padStart(2, '0')}:00 - ${count} פניות`}
                      />
                    );
                  })}
                </div>
              ))}

              {/* Legend */}
              <div className="flex items-center justify-end gap-2 mt-3 text-xs text-gray-500">
                <span>פחות</span>
                <div className="flex gap-0.5">
                  {['#F3F4F6', '#DBEAFE', '#93C5FD', '#3B82F6', '#1D4ED8'].map(c => (
                    <div key={c} className="w-4 h-4 rounded-sm" style={{ backgroundColor: c }} />
                  ))}
                </div>
                <span>יותר</span>
              </div>
            </div>
          </div>
        </section>

        {/* SIXTH ROW: Trend chart */}
        <section className="mb-6">
          <div className="text-xs font-semibold text-gray-500 uppercase mb-3">📈 מגמה - 14 ימים אחרונים</div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border">
            
            {trendReversed.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">אין נתונים</p>
            ) : (
              <>
                <div className="flex items-end gap-2 h-40" dir="ltr">
                  {trendReversed.map((d: any, idx: number) => {
                    const newCount = Number(d.new_count) || 0;
                    const resolved = Number(d.resolved_count) || 0;
                    const height = (newCount / maxTrendCount) * 100;
                    const resolvedHeight = newCount > 0 ? (resolved / newCount) * height : 0;
                    return (
                      <div 
                        key={idx} 
                        className="flex-1 flex flex-col items-center gap-1 group cursor-help"
                        title={`${fmtDate(d.day)}: ${newCount} חדשים, ${resolved} נפתרו, ⏱️ ${fmtDuration(d.avg_resolution_seconds)}`}
                      >
                        <div 
                          className="w-full bg-gray-100 rounded-t flex flex-col-reverse group-hover:opacity-80" 
                          style={{ height: `${Math.max(height, 4)}%`, minHeight: '8px' }}
                        >
                          {resolved > 0 && (
                            <div 
                              className="bg-emerald-500 rounded-t" 
                              style={{ height: `${(resolved / newCount) * 100}%`, minHeight: '2px' }} 
                            />
                          )}
                          <div className="bg-blue-500 rounded-t flex-1" />
                        </div>
                        <div className="text-[9px] text-gray-400">{fmtDate(d.day)}</div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="flex gap-3 mt-3 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-blue-500 rounded" />
                    <span>פניות חדשות</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-emerald-500 rounded" />
                    <span>נפתרו</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}

// ============ Sub-components ============

function BigKPI({ icon, color, value, label, sub, isGood }: { 
  icon: React.ReactNode; color: string; value: any; label: string; sub: string; isGood?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border ${isGood ? 'border-emerald-200' : 'border-gray-100'}`}>
      <div className="flex items-start justify-between mb-2">
        <div 
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
          style={{ backgroundColor: color }}
        >
          {icon}
        </div>
        {isGood !== undefined && (
          <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${
            isGood ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {isGood ? '✓ טוב' : '⚠ שיפור'}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
      <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}

function PercentileBar({ label, value, color, hint }: { 
  label: string; value: string; color: string; hint?: string;
}) {
  return (
    <div className="border-b border-gray-100 pb-2 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span 
            className="w-2 h-2 rounded-full" 
            style={{ backgroundColor: color }}
          />
          <span className="text-sm text-gray-700">{label}</span>
        </div>
        <span className="font-bold text-gray-900">{value}</span>
      </div>
      {hint && <p className="text-[10px] text-gray-400 mr-4 mt-0.5">{hint}</p>}
    </div>
  );
}

function CompareCell({ label, thisWeek, lastWeek, change, direction, lowerIsBetter, isText }: {
  label: string;
  thisWeek: any;
  lastWeek: any;
  change?: number;
  direction?: 'up' | 'down' | 'flat';
  lowerIsBetter?: boolean;
  isText?: boolean;
}) {
  // אם direction לא מסופק, חשב לפי השוואה
  let dir = direction;
  let pct = change;
  if (!isText && !dir) {
    const a = Number(thisWeek);
    const b = Number(lastWeek);
    if (b === 0) {
      pct = a > 0 ? 100 : 0;
    } else {
      pct = ((a - b) / b) * 100;
    }
    dir = a > b ? 'up' : a < b ? 'down' : 'flat';
  }

  const isImprovement = lowerIsBetter ? dir === 'down' : dir === 'up';
  const colorClass = dir === 'flat' ? 'text-gray-500' : isImprovement ? 'text-emerald-600' : 'text-red-600';
  const Icon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : Minus;

  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{thisWeek}</div>
      <div className="text-xs text-gray-500 mt-1">השבוע</div>
      <div className="border-t border-gray-100 mt-2 pt-2">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-gray-400">שבוע שעבר: <strong>{lastWeek}</strong></span>
        </div>
        {!isText && pct !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-bold mt-1 ${colorClass}`}>
            <Icon className="w-3 h-3" />
            <span>{Math.abs(pct).toFixed(1)}%</span>
            <span className="text-gray-400 font-normal">({isImprovement ? 'שיפור' : dir === 'flat' ? 'ללא שינוי' : 'הרעה'})</span>
          </div>
        )}
      </div>
    </div>
  );
}
