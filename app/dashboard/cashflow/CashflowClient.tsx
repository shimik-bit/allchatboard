'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Plus,
  Calendar, Sparkles, ChevronLeft, Check, Eye, Loader2,
  ArrowRight, Wallet, Receipt, DollarSign,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, Area, AreaChart,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

interface DashboardData {
  starting_balance: number;
  daily_buckets: Array<{
    date: string;
    income: number;
    expense: number;
    net: number;
    running_balance: number;
    items_count: number;
  }>;
  kpis: {
    total_income_forecast: number;
    total_expense_forecast: number;
    net_forecast: number;
    lowest_balance_day: { date: string; balance: number } | null;
    confirmation_pending: number;
  };
  items_to_review: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    confidence: number;
    kind: string;
    source: string;
  }>;
  not_installed?: boolean;
  message?: string;
}

const SOURCE_LABELS: Record<string, string> = {
  recurring: 'תנועה חוזרת',
  pending_invoice: 'חשבונית ממתינה',
  pipeline: 'הזדמנות מכירה',
  vat_obligation: 'חישוב מע״מ',
  manual: 'הוזן ידנית',
};

const KIND_LABELS: Record<string, string> = {
  income: 'תקבול',
  expense: 'תשלום',
  vat_payment: 'תשלום מע״מ',
  vat_refund: 'החזר מע״מ',
  salary: 'משכורות',
  tax: 'מסים',
  loan: 'הלוואה',
};

export default function CashflowClient({
  workspaceId,
  workspaceName,
  isInstalled,
  cashflowTableId,
  featureEnabled,
  forecastHorizonDays,
  userRole,
}: {
  workspaceId: string;
  workspaceName: string;
  isInstalled: boolean;
  cashflowTableId: string | null;
  featureEnabled: boolean;
  forecastHorizonDays: number;
  userRole: string;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Toggle: when true, exclude pending-approval invoices from the forecast
  // (only show committed/approved data). Default false = show everything.
  const [confirmedOnly, setConfirmedOnly] = useState(false);

  const canEdit = ['owner', 'admin', 'editor'].includes(userRole);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/cashflow/dashboard?workspace_id=${workspaceId}${confirmedOnly ? '&confirmed_only=true' : ''}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'שגיאה בטעינת הנתונים');
      } else {
        setData(json);
      }
    } catch (e: any) {
      setError(e?.message || 'שגיאה בטעינה');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, confirmedOnly]);

  useEffect(() => {
    if (isInstalled) loadDashboard();
    else setLoading(false);
  }, [isInstalled, loadDashboard]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/cashflow/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'שגיאה ביצירת התחזית');
      } else {
        await loadDashboard();
      }
    } catch (e: any) {
      setError(e?.message || 'שגיאה');
    } finally {
      setGenerating(false);
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    try {
      const res = await fetch('/api/workspaces/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          source: 'template',
          template_vertical: 'cashflow',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'שגיאה בהתקנה');
      } else {
        // Reload page to get the new table_id
        window.location.reload();
      }
    } catch (e: any) {
      setError(e?.message || 'שגיאה');
    } finally {
      setInstalling(false);
    }
  };

  // ===== Empty states =====

  if (!featureEnabled) {
    return (
      <div className="p-6 max-w-3xl mx-auto" dir="rtl">
        <EmptyState
          icon="📈"
          title="תזרים מזומנים - לא זמין במסלול הנוכחי"
          description="פיצ'ר זה זמין במסלול בסיסי ומעלה. שדרג את החשבון שלך כדי לקבל גישה לתחזית תזרים חכמה."
          action={
            <Link
              href="/dashboard/billing"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:opacity-90"
            >
              שדרג מסלול
              <ArrowRight className="w-4 h-4" />
            </Link>
          }
        />
      </div>
    );
  }

  if (!isInstalled) {
    return (
      <div className="p-6 max-w-3xl mx-auto" dir="rtl">
        <EmptyState
          icon="📈"
          title="התקן את תבנית התזרים כדי להתחיל"
          description="המערכת תיצור טבלת תחזית שמתמלאת אוטומטית מתנועות הבנק, החשבוניות, חיובי המע״מ והלידים שלך."
          action={
            <button
              onClick={handleInstall}
              disabled={installing || !canEdit}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
            >
              {installing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  מתקין...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  התקן תבנית תזרים
                </>
              )}
            </button>
          }
        />
        {!canEdit && (
          <p className="text-center text-sm text-gray-500 mt-4">
            רק owner/admin יכולים להתקין תבניות
          </p>
        )}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // ===== Empty: installed but no forecasts yet =====

  if (!data || data.daily_buckets.length === 0) {
    return (
      <div className="p-6 max-w-3xl mx-auto" dir="rtl">
        <EmptyState
          icon="✨"
          title="צור את התחזית הראשונה"
          description="המערכת תנתח את תנועות הבנק, החשבוניות והלידים שלך ותציע תחזית תזרים מפורטת."
          action={
            <button
              onClick={handleGenerate}
              disabled={generating || !canEdit}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  מנתח נתונים...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  הפק תחזית AI
                </>
              )}
            </button>
          }
        />
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    );
  }

  // ===== Main dashboard =====

  const kpis = data.kpis;
  const isNegativeForecast = kpis.lowest_balance_day && kpis.lowest_balance_day.balance < 0;

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-3xl">📈</span>
            תזרים מזומנים — {workspaceName}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            תחזית ל-{forecastHorizonDays} ימים קדימה • מתעדכנת אוטומטית
          </p>
        </div>
        <div className="flex items-center gap-2">
          {cashflowTableId && (
            <Link
              href={`/dashboard/${cashflowTableId}`}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              צפייה בטבלה המלאה
            </Link>
          )}
          {/* Filter toggle: hide pending-approval invoices (show only verified data).
              Useful when planning conservatively — pending invoices are 70% confidence
              and might still be rejected/edited by the finance approver. */}
          <button
            onClick={() => setConfirmedOnly((v) => !v)}
            className={`px-4 py-2 text-sm rounded-lg transition flex items-center gap-2 border ${
              confirmedOnly
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
            title={
              confirmedOnly
                ? 'מציג רק חשבוניות שאושרו על ידי מאשר מורשה'
                : 'לחץ כדי להציג רק חשבוניות שעברו אישור'
            }
          >
            {confirmedOnly ? '✅' : '⏳'}
            {confirmedOnly ? 'רק מאושרות' : 'הצג רק מאושרות'}
          </button>
          {canEdit && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-lg hover:opacity-90 transition flex items-center gap-2 disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {generating ? 'מנתח...' : 'הפק תחזית מחדש'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Wallet className="w-4 h-4" />}
          label="יתרה נוכחית"
          value={data.starting_balance}
          color="text-gray-700"
          bg="bg-gray-50"
        />
        <KpiCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="צפי תקבולים"
          value={kpis.total_income_forecast}
          color="text-emerald-700"
          bg="bg-emerald-50"
          showSign
        />
        <KpiCard
          icon={<TrendingDown className="w-4 h-4" />}
          label="צפי תשלומים"
          value={kpis.total_expense_forecast}
          color="text-red-700"
          bg="bg-red-50"
          showSign
        />
        <KpiCard
          icon={<DollarSign className="w-4 h-4" />}
          label="תזרים נטו צפוי"
          value={kpis.net_forecast}
          color={kpis.net_forecast >= 0 ? 'text-emerald-700' : 'text-red-700'}
          bg={kpis.net_forecast >= 0 ? 'bg-emerald-50' : 'bg-red-50'}
          showSign
        />
      </div>

      {/* Warning banner if balance goes negative */}
      {isNegativeForecast && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-red-900">⚠️ אזהרת תזרים שלילי</h3>
            <p className="text-sm text-red-700 mt-1">
              היתרה החזויה צפויה לרדת ל-
              <strong>{formatCurrency(kpis.lowest_balance_day!.balance)}</strong>
              {' '}בתאריך{' '}
              <strong>{formatDate(kpis.lowest_balance_day!.date)}</strong>
              . מומלץ לתכנן הזרמת מזומנים או דחיית הוצאות.
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-bold text-gray-900 mb-4">יתרה צפויה לאורך זמן</h2>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data.daily_buckets} margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
            <defs>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => format(parseISO(d), 'd/M', { locale: he })}
              tick={{ fontSize: 11, fill: '#6B7280' }}
              reversed
            />
            <YAxis
              tickFormatter={(v) => formatCurrencyShort(v)}
              tick={{ fontSize: 11, fill: '#6B7280' }}
              orientation="right"
            />
            <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="3 3" />
            <Tooltip
              contentStyle={{ direction: 'rtl', textAlign: 'right' }}
              labelFormatter={(d) => formatDate(d)}
              formatter={(value: any, name: any) => {
                const labels: Record<string, string> = {
                  running_balance: 'יתרה',
                  income: 'תקבולים',
                  expense: 'תשלומים',
                };
                return [formatCurrency(Number(value)), labels[String(name)] || String(name)];
              }}
            />
            <Area
              type="monotone"
              dataKey="running_balance"
              stroke="#10B981"
              strokeWidth={2.5}
              fill="url(#balanceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Items to review */}
      {kpis.confirmation_pending > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
          <div className="p-4 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-amber-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {kpis.confirmation_pending} פריטים לאימות
              </h2>
              <p className="text-xs text-amber-700 mt-1">
                ה-AI מציע - אשר או ערוך כדי לחדד את התחזית
              </p>
            </div>
            {cashflowTableId && (
              <Link
                href={`/dashboard/${cashflowTableId}`}
                className="text-sm text-amber-700 hover:text-amber-900 font-medium"
              >
                ראה הכל ←
              </Link>
            )}
          </div>
          <div className="divide-y divide-gray-100">
            {data.items_to_review.slice(0, 8).map((item) => (
              <ReviewItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* Daily breakdown table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            פירוט יומי
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-right font-medium text-gray-700">תאריך</th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">פריטים</th>
                <th className="px-4 py-2 text-right font-medium text-emerald-700">תקבולים</th>
                <th className="px-4 py-2 text-right font-medium text-red-700">תשלומים</th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">נטו</th>
                <th className="px-4 py-2 text-right font-medium text-gray-700">יתרה</th>
              </tr>
            </thead>
            <tbody>
              {data.daily_buckets.slice(0, 30).map((b) => (
                <tr key={b.date} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="px-4 py-2 font-medium text-gray-900">
                    {formatDate(b.date)}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{b.items_count}</td>
                  <td className="px-4 py-2 text-emerald-700">
                    {b.income > 0 ? `+${formatCurrency(b.income)}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-red-700">
                    {b.expense < 0 ? formatCurrency(b.expense) : '—'}
                  </td>
                  <td className={`px-4 py-2 font-medium ${b.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {b.net >= 0 ? '+' : ''}{formatCurrency(b.net)}
                  </td>
                  <td className={`px-4 py-2 font-bold ${b.running_balance >= 0 ? 'text-gray-900' : 'text-red-700'}`}>
                    {formatCurrency(b.running_balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function KpiCard({
  icon, label, value, color, bg, showSign,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  bg: string;
  showSign?: boolean;
}) {
  return (
    <div className={`${bg} rounded-xl p-4 border border-gray-100`}>
      <div className={`flex items-center gap-1.5 ${color} text-xs font-medium mb-1`}>
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>
        {showSign && value > 0 ? '+' : ''}
        {formatCurrency(value)}
      </div>
      <div className={`text-xs ${color} opacity-70 mt-0.5`}>₪</div>
    </div>
  );
}

function ReviewItem({ item }: { item: DashboardData['items_to_review'][0] }) {
  const isExpense = item.amount < 0;
  return (
    <Link
      href={`/r/${item.id}`}
      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition"
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">{item.description}</div>
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
          <span>{formatDate(item.date)}</span>
          <span>•</span>
          <span>{SOURCE_LABELS[item.source] || item.source}</span>
        </div>
      </div>
      <div className="text-left shrink-0">
        <div className={`font-bold ${isExpense ? 'text-red-700' : 'text-emerald-700'}`}>
          {isExpense ? '' : '+'}
          {formatCurrency(item.amount)} ₪
        </div>
        <div className="flex items-center gap-1 text-xs text-amber-600 mt-0.5 justify-end">
          <Sparkles className="w-3 h-3" />
          {item.confidence}% ביטחון
        </div>
      </div>
      <ChevronLeft className="w-4 h-4 text-gray-300 shrink-0" />
    </Link>
  );
}

function EmptyState({
  icon, title, description, action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-16 px-4">
      <div className="text-6xl mb-4">{icon}</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-500 max-w-md mx-auto mb-6">{description}</p>
      {action}
    </div>
  );
}

// ============================================================================
// Formatters
// ============================================================================

function formatCurrency(n: number): string {
  return Math.round(n).toLocaleString('he-IL');
}

function formatCurrencyShort(n: number): string {
  if (Math.abs(n) >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), 'EEE d/M/yy', { locale: he });
  } catch {
    return iso;
  }
}
