'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  Database,
  Search,
  Plus,
  Trash2,
  Check,
  X,
  AlertTriangle,
  TrendingUp,
  Users,
  CheckCircle2,
  Globe,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

type BlocklistEntry = {
  id: string;
  phone: string;
  first_reported_at: string;
  last_reported_at: string;
  report_count: number;
  unique_groups_count: number;
  unique_workspaces_count: number;
  reason_summary: string | null;
  is_confirmed: boolean;
  confirmed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  action_count: number;
};

type AdminStats = {
  blocklist: { total: number; confirmed: number; unconfirmed: number };
  actions_30d: {
    total: number;
    kicks: number;
    deletes: number;
    warns: number;
    by_source: Array<{ source: string; count: number }>;
  };
  workspaces: { using_groupguard: number };
  groups: { total: number; enabled: number };
  top_categories: Array<{ category: string; count: number }>;
  top_prefixes: Array<{ prefix: string; count: number }>;
};

type Tab = 'overview' | 'blocklist';


// ============================================================================
// Main
// ============================================================================

export default function AdminClient({ adminEmail }: { adminEmail: string }) {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-purple-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">GroupGuard Admin</h1>
              <p className="text-sm text-gray-500">
                ניהול מאגר ספאמרים גלובלי ומבט-על
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/groupguard"
            className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
          >
            ← חזרה ל-GroupGuard
          </Link>
        </div>

        {/* Admin badge */}
        <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <Shield className="w-3.5 h-3.5" />
          מחובר כ-Super Admin: <span className="font-medium" dir="ltr">{adminEmail}</span>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 flex overflow-x-auto">
            <TabButton
              active={tab === 'overview'}
              onClick={() => setTab('overview')}
              icon={<TrendingUp className="w-4 h-4" />}
              label="מבט-על גלובלי"
            />
            <TabButton
              active={tab === 'blocklist'}
              onClick={() => setTab('blocklist')}
              icon={<Database className="w-4 h-4" />}
              label="מאגר ספאמרים"
            />
          </div>

          <div className="p-4 sm:p-6">
            {tab === 'overview' && <OverviewTab />}
            {tab === 'blocklist' && <BlocklistTab />}
          </div>
        </div>
      </div>
    </div>
  );
}


function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
        active
          ? 'border-red-500 text-red-700 bg-red-50'
          : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}


// ============================================================================
// Tab: Overview
// ============================================================================

function OverviewTab() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/groupguard/admin/stats');
      const d = await res.json();
      if (!res.ok) setError(d.error);
      else setStats(d);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="text-center py-8 text-gray-500">טוען נתונים...</div>;
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {error}
      </div>
    );
  }
  if (!stats) return null;

  return (
    <div className="space-y-5">
      {/* Top stats - cross-workspace */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="במאגר"
          value={stats.blocklist.total}
          icon={<Database className="w-4 h-4" />}
          color="red"
        />
        <StatCard
          label="מאושרים"
          value={stats.blocklist.confirmed}
          icon={<CheckCircle2 className="w-4 h-4" />}
          color="purple"
        />
        <StatCard
          label="פעולות (30 ימים)"
          value={stats.actions_30d.total}
          icon={<TrendingUp className="w-4 h-4" />}
          color="blue"
        />
        <StatCard
          label="לקוחות פעילים"
          value={stats.workspaces.using_groupguard}
          icon={<Users className="w-4 h-4" />}
          color="green"
        />
      </div>

      {/* Action breakdown */}
      <Card title="פעולות ב-30 הימים האחרונים" icon={<TrendingUp className="w-4 h-4" />}>
        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="הוצאות" value={stats.actions_30d.kicks} color="bg-red-50 text-red-700" />
          <MiniStat label="מחיקות" value={stats.actions_30d.deletes} color="bg-orange-50 text-orange-700" />
          <MiniStat label="אזהרות" value={stats.actions_30d.warns} color="bg-amber-50 text-amber-700" />
        </div>
        {stats.actions_30d.by_source.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-xs font-medium text-gray-600 mb-1">לפי מקור:</div>
            {stats.actions_30d.by_source.map((s) => {
              const pct = stats.actions_30d.total === 0 ? 0 : (s.count / stats.actions_30d.total) * 100;
              return (
                <div key={s.source}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{sourceLabels[s.source] || s.source}</span>
                    <span className="text-gray-500">{s.count} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top AI categories */}
        <Card title="קטגוריות AI מובילות" icon={<Shield className="w-4 h-4" />}>
          {stats.top_categories.length === 0 ? (
            <div className="text-center py-4 text-xs text-gray-400">אין נתונים</div>
          ) : (
            <div className="space-y-1.5">
              {stats.top_categories.map((c) => (
                <div key={c.category} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{c.category}</span>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                    {c.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Top phone prefixes */}
        <Card title="קידומות נפוצות אצל ספאמרים" icon={<Globe className="w-4 h-4" />}>
          {stats.top_prefixes.length === 0 ? (
            <div className="text-center py-4 text-xs text-gray-400">אין נתונים</div>
          ) : (
            <div className="space-y-1.5">
              {stats.top_prefixes.map((p) => (
                <div key={p.prefix} className="flex items-center justify-between text-sm">
                  <span className="font-mono text-gray-700">+{p.prefix}</span>
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                    {p.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Groups stats */}
      <Card title="קבוצות" icon={<Users className="w-4 h-4" />}>
        <div className="grid grid-cols-2 gap-3">
          <MiniStat
            label="סה״כ קבוצות"
            value={stats.groups.total}
            color="bg-gray-100 text-gray-700"
          />
          <MiniStat
            label="עם GroupGuard פעיל"
            value={stats.groups.enabled}
            color="bg-purple-100 text-purple-700"
          />
        </div>
      </Card>
    </div>
  );
}


// ============================================================================
// Tab: Blocklist
// ============================================================================

function BlocklistTab() {
  const [entries, setEntries] = useState<BlocklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [confirmedFilter, setConfirmedFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newConfirmed, setNewConfirmed] = useState(true);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, confirmedFilter, page]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search.trim()) params.set('q', search.trim());
      if (confirmedFilter !== 'all') params.set('confirmed', confirmedFilter);

      const res = await fetch(`/api/groupguard/admin/blocklist?${params}`);
      const d = await res.json();
      if (!res.ok) {
        setError(d.error);
      } else {
        setEntries(d.entries || []);
        setTotalPages(d.total_pages || 0);
        setTotal(d.total || 0);
        setError(null);
      }
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function toggleConfirm(entry: BlocklistEntry) {
    const res = await fetch('/api/groupguard/admin/blocklist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: entry.id, is_confirmed: !entry.is_confirmed }),
    });
    if (res.ok) {
      setEntries((es) =>
        es.map((e) =>
          e.id === entry.id ? { ...e, is_confirmed: !e.is_confirmed } : e,
        ),
      );
    } else {
      const d = await res.json();
      alert(`שגיאה: ${d.error}`);
    }
  }

  async function deleteEntry(id: string) {
    if (!confirm('להסיר מספר זה מהמאגר? הוא יוכל לחזור לשלוח הודעות בקבוצות.')) return;
    const res = await fetch(`/api/groupguard/admin/blocklist?id=${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setEntries((es) => es.filter((e) => e.id !== id));
      setTotal((t) => t - 1);
    } else {
      const d = await res.json();
      alert(`שגיאה: ${d.error}`);
    }
  }

  async function addManual() {
    if (!newPhone.trim()) return;
    const res = await fetch('/api/groupguard/admin/blocklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: newPhone.trim(),
        reason: newReason.trim() || 'manual_admin_add',
        notes: newNotes.trim() || undefined,
        confirmed: newConfirmed,
      }),
    });
    const d = await res.json();
    if (!res.ok) {
      alert(`שגיאה: ${d.error}`);
    } else {
      setNewPhone('');
      setNewReason('');
      setNewNotes('');
      setNewConfirmed(true);
      setShowAddForm(false);
      load();
    }
  }

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="חפש לפי טלפון..."
            className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
            dir="ltr"
          />
        </div>

        <select
          value={confirmedFilter}
          onChange={(e) => {
            setConfirmedFilter(e.target.value as any);
            setPage(0);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-red-500"
        >
          <option value="all">כל המספרים</option>
          <option value="yes">מאושרים בלבד</option>
          <option value="no">ממתינים לאישור</option>
        </select>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          הוסף ידני
        </button>
      </div>

      {/* Add form */}
      {showAddForm && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">טלפון *</label>
              <input
                type="text"
                inputMode="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="972501234567"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">סיבה</label>
              <input
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="scam, phishing..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">הערות</label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="למשל: דווח על-ידי לקוח X"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div className="sm:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="newConfirmed"
                checked={newConfirmed}
                onChange={(e) => setNewConfirmed(e.target.checked)}
                className="w-4 h-4 accent-red-600"
              />
              <label htmlFor="newConfirmed" className="text-sm text-gray-700">
                לאשר מיד (יחסם בכל הקבוצות שיש להן global_blocklist פעיל)
              </label>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={addManual}
              disabled={!newPhone.trim()}
              className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
            >
              הוסף
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewPhone('');
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Results summary */}
      <div className="text-sm text-gray-600">
        {loading ? 'טוען...' : `${total} מספרים במאגר`}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Entries list */}
      {!loading && entries.length === 0 ? (
        <div className="text-center py-12">
          <Database className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">המאגר ריק</p>
          <p className="text-xs text-gray-400 mt-1">
            ספאמרים מתווספים אוטומטית כאשר GroupGuard מוציא אותם מקבוצות
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <BlocklistRow
              key={e.id}
              entry={e}
              onToggleConfirm={() => toggleConfirm(e)}
              onDelete={() => deleteEntry(e.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <button
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
            הקודם
          </button>
          <div className="text-sm text-gray-600">
            עמוד {page + 1} מתוך {totalPages}
          </div>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(page + 1)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            הבא
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}


function BlocklistRow({
  entry,
  onToggleConfirm,
  onDelete,
}: {
  entry: BlocklistEntry;
  onToggleConfirm: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`p-3 border rounded-lg ${
        entry.is_confirmed
          ? 'border-red-200 bg-red-50/30'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
            entry.is_confirmed ? 'bg-red-100' : 'bg-gray-100'
          }`}
        >
          {entry.is_confirmed ? (
            <ShieldCheck className="w-4 h-4 text-red-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-gray-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-medium text-gray-900" dir="ltr">
              +{entry.phone}
            </span>
            {entry.is_confirmed ? (
              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                מאושר
              </span>
            ) : (
              <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                ממתין
              </span>
            )}
          </div>

          <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            <span>{entry.report_count} דיווחים</span>
            <span>{entry.unique_groups_count} קבוצות</span>
            <span>{entry.unique_workspaces_count} לקוחות</span>
            {entry.action_count > 0 && (
              <span>{entry.action_count} פעולות בוט</span>
            )}
          </div>

          {entry.reason_summary && (
            <div className="text-xs text-gray-600 mt-1 truncate">
              סיבה: {entry.reason_summary}
            </div>
          )}
          {entry.notes && (
            <div className="text-xs text-gray-500 mt-1 italic truncate">
              {entry.notes}
            </div>
          )}

          <div className="text-[10px] text-gray-400 mt-1">
            דווח לראשונה: {new Date(entry.first_reported_at).toLocaleDateString('he-IL')}
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-shrink-0">
          <button
            onClick={onToggleConfirm}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              entry.is_confirmed
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {entry.is_confirmed ? 'בטל אישור' : 'אשר'}
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="מחק"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// Shared components
// ============================================================================

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'red' | 'purple' | 'blue' | 'green';
}) {
  const colorClasses = {
    red: 'bg-red-50 border-red-200 text-red-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
  };
  return (
    <div className={`p-3 border rounded-xl ${colorClasses[color]}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-80 mb-1">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold">{value.toLocaleString('he-IL')}</div>
    </div>
  );
}


function Card({
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


function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`p-3 rounded-lg ${color}`}>
      <div className="text-xs opacity-80 mb-0.5">{label}</div>
      <div className="text-xl font-bold">{value.toLocaleString('he-IL')}</div>
    </div>
  );
}


const sourceLabels: Record<string, string> = {
  ai: 'AI',
  manual_report: 'תיוג ידני',
  phone_prefix: 'קידומת',
  global_blocklist: 'מאגר',
  whitelist: 'whitelist',
};
