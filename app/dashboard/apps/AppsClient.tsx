'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Store, Check, Loader2, ExternalLink, Search, Filter, X } from 'lucide-react';
import { useApps, type AppCatalogEntry } from '@/lib/hooks/useApps';

const CATEGORY_LABELS_HE: Record<string, string> = {
  general: 'כללי',
  sales: 'מכירות',
  industry: 'תעשייתי',
  communication: 'תקשורת',
  tools: 'כלים',
  finance: 'פיננסי',
  security: 'אבטחה',
};

export default function AppsClient({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  const router = useRouter();
  const { data, loading, refresh } = useApps(workspaceId);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'installed' | 'available'>('all');
  const [q, setQ] = useState('');

  const apps = data?.apps || [];
  const canInstall = data?.can_install ?? false;

  const installedCount = apps.filter((a) => a.is_installed).length;

  // Filter + group
  const filtered = useMemo(() => {
    let list = apps;
    if (filter === 'installed') list = list.filter((a) => a.is_installed);
    if (filter === 'available') list = list.filter((a) => !a.is_installed);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((a) =>
        a.name_he.toLowerCase().includes(needle) ||
        (a.description_he || '').toLowerCase().includes(needle)
      );
    }
    return list;
  }, [apps, filter, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, AppCatalogEntry[]>();
    for (const app of filtered) {
      const cat = app.category || 'general';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(app);
    }
    return Array.from(map.entries());
  }, [filtered]);

  async function handleInstall(slug: string): Promise<void> {
    if (!canInstall || busy) return;
    setBusy(slug);
    try {
      const res = await fetch('/api/apps/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, app_slug: slug }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      await refresh();
      // Tiny success cue: refresh router so sidebar picks up the new entry.
      router.refresh();
    } catch (e) {
      alert(`התקנה נכשלה: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleUninstall(slug: string): Promise<void> {
    if (!canInstall || busy) return;
    if (!confirm('להסיר את האפליקציה? הנתונים יישמרו, רק הקישור יוסר מה-sidebar.')) return;
    setBusy(slug);
    try {
      const res = await fetch('/api/apps/install', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, app_slug: slug }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await refresh();
      router.refresh();
    } catch (e) {
      alert(`הסרה נכשלה: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 grid place-items-center text-white shadow-lg">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">חנות אפליקציות</h1>
            <p className="text-sm text-gray-500">
              התקן אפליקציות שיופיעו בתפריט הצדדי של <span className="font-medium">{workspaceName}</span>
            </p>
          </div>
        </div>
        <div className="text-sm text-gray-600 bg-gray-100 rounded-full px-3 py-1.5">
          {installedCount} מותקנות · {apps.length - installedCount} זמינות
        </div>
      </div>

      {/* Onboarding banner — only when nothing is installed */}
      {!loading && installedCount === 0 && (
        <div className="bg-gradient-to-l from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-4 sm:p-6">
          <h2 className="text-lg font-bold text-purple-900 mb-1">👋 ברוך הבא ל-TaskFlow!</h2>
          <p className="text-sm text-purple-800">
            ה-workspace שלך עדיין ריק. התקן את האפליקציות הראשונות כדי שיופיעו בתפריט הצדדי.
            כל אפליקציה ניתנת להתקנה והסרה בכל רגע — הנתונים נשמרים גם אם תסיר.
          </p>
        </div>
      )}

      {/* Permission notice for non-admins */}
      {!loading && !canInstall && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
          רק בעלי הרשאת Owner / Admin יכולים להתקין או להסיר אפליקציות.
        </div>
      )}

      {/* Search + filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חפש אפליקציה…"
            className="w-full pr-9 pl-3 py-2 text-sm border border-gray-300 rounded-xl focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
          />
          {q && (
            <button
              onClick={() => setQ('')}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {(['all', 'installed', 'available'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {f === 'all' ? 'הכל' : f === 'installed' ? 'מותקנות' : 'זמינות'}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
        </div>
      )}

      {/* Empty state for the filter */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-500">
          לא נמצאו אפליקציות התואמות את הסינון.
        </div>
      )}

      {/* App grid grouped by category */}
      {!loading && grouped.map(([category, items]) => (
        <div key={category}>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {CATEGORY_LABELS_HE[category] || category}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((app) => (
              <AppCard
                key={app.slug}
                app={app}
                canInstall={canInstall}
                busy={busy === app.slug}
                onInstall={() => handleInstall(app.slug)}
                onUninstall={() => handleUninstall(app.slug)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AppCard({
  app,
  canInstall,
  busy,
  onInstall,
  onUninstall,
}: {
  app: AppCatalogEntry;
  canInstall: boolean;
  busy: boolean;
  onInstall: () => void;
  onUninstall: () => void;
}) {
  return (
    <div className="bg-white border border-gray-200 hover:border-gray-300 rounded-2xl p-4 transition-all hover:shadow-md flex flex-col gap-3">
      {/* Icon + name */}
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-xl grid place-items-center text-2xl flex-shrink-0"
          style={{ backgroundColor: `${app.color}20` }}
        >
          {app.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="font-semibold text-gray-900 truncate">{app.name_he}</h4>
            {app.is_beta && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                BETA
              </span>
            )}
          </div>
          {app.is_installed && (
            <div className="flex items-center gap-1 text-xs text-green-700 mt-0.5">
              <Check className="w-3 h-3" />
              מותקן
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-600 leading-relaxed flex-1 min-h-[36px]">
        {app.description_he || '—'}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {app.is_installed ? (
          <>
            <Link
              href={app.primary_route}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              פתח
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            {canInstall && (
              <button
                onClick={onUninstall}
                disabled={busy}
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                title="הסר אפליקציה"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'הסר'}
              </button>
            )}
          </>
        ) : (
          <button
            onClick={onInstall}
            disabled={!canInstall || busy}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {busy ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                מתקין…
              </>
            ) : (
              <>+ התקן</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
