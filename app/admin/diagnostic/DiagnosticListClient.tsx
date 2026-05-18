'use client';

/**
 * Admin list view for diagnostic submissions.
 *
 * - Stats cards at top: total / completed / awaiting review / last 7 days
 * - Search bar (debounced) + status filter chips
 * - Sortable table with key columns
 * - Each row links to /admin/diagnostic/[id] for full detail
 * - Export button → CSV download
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Download,
  FileText,
  Loader2,
  Search,
  Stethoscope,
  TrendingUp,
  Users,
} from 'lucide-react';

type Stats = {
  total: number;
  complete: number;
  unreviewed: number;
  thisWeek: number;
};

type Submission = {
  id: string;
  created_at: string;
  submitted_at: string | null;
  is_complete: boolean;
  company_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  activity_type: string | null;
  annual_revenue: string | null;
  q_urgency: number | null;
  q_financial_health_score: number | null;
  utm_source: string | null;
  reviewed_at: string | null;
};

type StatusFilter = 'all' | 'complete' | 'draft';

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  residential: 'מגורים',
  commercial: 'מסחרי',
  infrastructure: 'תשתיות',
  renovation: 'שיפוצים',
  mixed: 'מגוון',
};

export default function DiagnosticListClient({ stats }: { stats: Stats }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');

  // Debounce the search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        status,
        ...(debouncedQ ? { q: debouncedQ } : {}),
      });
      const res = await fetch(`/api/admin/diagnostic/list?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [status, debouncedQ]);

  useEffect(() => {
    load();
  }, [load]);

  const exportHref = useMemo(() => {
    const params = new URLSearchParams({ status });
    return `/api/admin/diagnostic/export?${params}`;
  }, [status]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">אבחון לידים</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                שאלוני אבחון שמולאו דרך{' '}
                <a href="/diagnostic" target="_blank" rel="noreferrer" className="text-purple-600 hover:underline">
                  taskflow-ai.com/diagnostic
                </a>
              </p>
            </div>
          </div>
          <a
            href={exportHref}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition text-sm font-medium text-gray-700 shadow-sm"
          >
            <Download className="w-4 h-4" />
            ייצא ל-CSV
          </a>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard
            icon={<Users className="w-4 h-4" />}
            label="סה״כ הגשות"
            value={stats.total}
            color="gray"
          />
          <StatCard
            icon={<CheckCircle2 className="w-4 h-4" />}
            label="הושלמו"
            value={stats.complete}
            color="green"
          />
          <StatCard
            icon={<AlertCircle className="w-4 h-4" />}
            label="ממתינות לבדיקה"
            value={stats.unreviewed}
            color="amber"
            highlight={stats.unreviewed > 0}
          />
          <StatCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="ב-7 ימים אחרונים"
            value={stats.thisWeek}
            color="purple"
          />
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="חפש לפי חברה, איש קשר, מייל או טלפון..."
              className="w-full pr-10 pl-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
            />
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <FilterChip
              active={status === 'all'}
              onClick={() => setStatus('all')}
              label="הכל"
            />
            <FilterChip
              active={status === 'complete'}
              onClick={() => setStatus('complete')}
              label="הושלמו"
            />
            <FilterChip
              active={status === 'draft'}
              onClick={() => setStatus('draft')}
              label="טיוטות"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              טוען...
            </div>
          ) : submissions.length === 0 ? (
            <EmptyState debouncedQ={debouncedQ} status={status} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <Th>תאריך</Th>
                    <Th>חברה</Th>
                    <Th>איש קשר</Th>
                    <Th>סוג פעילות</Th>
                    <Th>בריאות / דחיפות</Th>
                    <Th>סטטוס</Th>
                    <Th>פעולה</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {submissions.map((s) => (
                    <SubmissionRow key={s.id} s={s} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && submissions.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500 bg-gray-50">
              מציג {submissions.length} מתוך {total}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
  color,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'gray' | 'green' | 'amber' | 'purple';
  highlight?: boolean;
}) {
  const colorMap = {
    gray: 'bg-gray-100 text-gray-600',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    purple: 'bg-purple-100 text-purple-700',
  };
  return (
    <div
      className={`bg-white border rounded-xl p-4 ${
        highlight ? 'border-amber-300 ring-1 ring-amber-100' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          {icon}
        </div>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value.toLocaleString('he-IL')}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
        active
          ? 'bg-gray-900 text-white border-gray-900'
          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-right font-semibold">{children}</th>;
}

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

function SubmissionRow({ s }: { s: Submission }) {
  const date = s.submitted_at ?? s.created_at;
  const isNew = !s.reviewed_at && s.is_complete;

  return (
    <tr className="hover:bg-gray-50 transition">
      <Td className="whitespace-nowrap text-gray-600 text-xs">
        <div className="font-medium text-gray-900">
          {new Date(date).toLocaleDateString('he-IL')}
        </div>
        <div className="text-gray-500">
          {new Date(date).toLocaleTimeString('he-IL', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </Td>
      <Td>
        <div className="font-medium text-gray-900">
          {s.company_name || <span className="text-gray-400">— ללא שם —</span>}
        </div>
        {s.annual_revenue && (
          <div className="text-xs text-gray-500 mt-0.5">{s.annual_revenue}</div>
        )}
      </Td>
      <Td>
        <div className="text-gray-900">{s.contact_name || '—'}</div>
        <div className="text-xs text-gray-500 mt-0.5 space-y-0.5">
          {s.contact_phone && <div dir="ltr">{s.contact_phone}</div>}
          {s.contact_email && (
            <div className="truncate max-w-[200px]">{s.contact_email}</div>
          )}
        </div>
      </Td>
      <Td className="text-xs text-gray-600">
        {s.activity_type ? ACTIVITY_TYPE_LABELS[s.activity_type] ?? s.activity_type : '—'}
      </Td>
      <Td>
        <div className="flex items-center gap-1.5 text-xs">
          <ScorePill score={s.q_financial_health_score} label="בריאות" />
          <ScorePill score={s.q_urgency} label="דחיפות" inverted />
        </div>
      </Td>
      <Td>
        {s.is_complete ? (
          isNew ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
              <AlertCircle className="w-3 h-3" />
              חדש
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
              <CheckCircle2 className="w-3 h-3" />
              נבדק
            </span>
          )
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
            <Clock className="w-3 h-3" />
            טיוטה
          </span>
        )}
      </Td>
      <Td>
        <Link
          href={`/admin/diagnostic/${s.id}`}
          className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium"
        >
          פתח
          <ChevronLeft className="w-3 h-3" />
        </Link>
      </Td>
    </tr>
  );
}

function ScorePill({
  score,
  label,
  inverted,
}: {
  score: number | null;
  label: string;
  inverted?: boolean;
}) {
  if (!score) return <span className="text-gray-300">—</span>;
  // For "health" — higher is better (green). For "urgency" — higher is worse (red).
  const isHigh = score >= 7;
  const color = inverted
    ? isHigh
      ? 'bg-red-100 text-red-700'
      : 'bg-gray-100 text-gray-600'
    : isHigh
      ? 'bg-green-100 text-green-700'
      : score >= 4
        ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-700';
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${color}`}
      title={label}
    >
      {score}
    </span>
  );
}

function EmptyState({
  debouncedQ,
  status,
}: {
  debouncedQ: string;
  status: StatusFilter;
}) {
  return (
    <div className="p-12 text-center">
      <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <p className="text-sm text-gray-500">
        {debouncedQ
          ? 'לא נמצאו תוצאות לחיפוש זה.'
          : status === 'complete'
            ? 'עדיין לא הושלמו הגשות.'
            : status === 'draft'
              ? 'אין טיוטות.'
              : 'עדיין לא הוגשו שאלונים.'}
      </p>
      {!debouncedQ && status === 'all' && (
        <a
          href="/diagnostic"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-purple-600 hover:underline mt-2"
        >
          פתח את דף השאלון
          <ChevronLeft className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}
