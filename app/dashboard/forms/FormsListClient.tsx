'use client';

/**
 * Forms list page — the workspace's forms with status, stats, and quick links.
 *
 * This is the minimal v1: list + empty state + "create" button. The actual
 * creation flow + builder UI lives in PR #2. For now, the "create" button
 * opens a basic dialog where the user picks a table + types a title and we
 * insert a draft form with no fields exposed yet.
 *
 * Once PR #2 ships, this page becomes the entry point for the full builder.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowUpRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Inbox,
  Loader2,
  Plus,
  Search,
  Table,
  X,
} from 'lucide-react';

type FormRowLite = {
  id: string;
  table_id: string;
  slug: string;
  title: string;
  description: string | null;
  status: 'draft' | 'published' | 'archived';
  total_submissions: number;
  total_completed: number;
  last_submission_at: string | null;
  created_at: string;
  published_at: string | null;
};

type TableLite = {
  id: string;
  name: string;
  icon: string | null;
};

const STATUS_META: Record<
  string,
  { label: string; classes: string }
> = {
  draft: {
    label: 'טיוטה',
    classes: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  published: {
    label: 'פעיל',
    classes: 'bg-green-50 text-green-700 border-green-200',
  },
  archived: {
    label: 'בארכיון',
    classes: 'bg-gray-100 text-gray-600 border-gray-200',
  },
};

export default function FormsListClient({
  forms,
  tables,
  workspaceId,
}: {
  forms: FormRowLite[];
  tables: TableLite[];
  workspaceId: string;
}) {
  const router = useRouter();
  const [searchQ, setSearchQ] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [copiedFormId, setCopiedFormId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = searchQ.toLowerCase().trim();
    if (!q) return forms;
    return forms.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        f.slug.toLowerCase().includes(q) ||
        (f.description?.toLowerCase().includes(q) ?? false),
    );
  }, [forms, searchQ]);

  const handleCopy = async (slug: string, formId: string) => {
    const url = `${window.location.origin}/f/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedFormId(formId);
      setTimeout(() => setCopiedFormId(null), 2000);
    } catch {
      // Fallback: open the URL in a new tab so the user can copy manually
      window.open(url, '_blank');
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-6 h-6 text-purple-600" />
              טפסים
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              שאלונים ציבוריים לאיסוף נתונים. כל הגשה הופכת לרשומה בטבלה.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            טופס חדש
          </button>
        </div>

        {forms.length === 0 ? (
          <EmptyState onCreate={() => setShowCreate(true)} />
        ) : (
          <>
            {/* Search */}
            <div className="mb-4 relative max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="חיפוש בטפסים..."
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                className="w-full pr-10 pl-3 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
              />
            </div>

            {/* List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((form) => (
                <FormCard
                  key={form.id}
                  form={form}
                  onCopy={() => handleCopy(form.slug, form.id)}
                  isCopied={copiedFormId === form.id}
                />
              ))}
            </div>

            {filtered.length === 0 && searchQ && (
              <div className="text-center py-12 text-sm text-gray-500">
                לא נמצאו טפסים התואמים לחיפוש &ldquo;{searchQ}&rdquo;
              </div>
            )}
          </>
        )}
      </div>

      {showCreate && (
        <CreateFormDialog
          tables={tables}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            // Refresh the page (also navigates to the newly-created form
            // editor once PR #2 lands; for now just reload the list)
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
function FormCard({
  form,
  onCopy,
  isCopied,
}: {
  form: FormRowLite;
  onCopy: () => void;
  isCopied: boolean;
}) {
  const meta = STATUS_META[form.status] ?? STATUS_META.draft;
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-md hover:border-purple-200 transition flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-bold text-gray-900 leading-tight">
          {form.title}
        </h3>
        <span
          className={`inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold rounded-full border shrink-0 ${meta.classes}`}
        >
          {meta.label}
        </span>
      </div>

      {form.description && (
        <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-4">
          {form.description}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
        <div className="bg-gray-50 rounded-lg p-2.5">
          <div className="text-gray-500 mb-0.5">הגשות</div>
          <div className="font-bold text-gray-900 text-base">
            {form.total_submissions}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2.5">
          <div className="text-gray-500 mb-0.5">הושלמו</div>
          <div className="font-bold text-gray-900 text-base">
            {form.total_completed}
          </div>
        </div>
      </div>

      {form.last_submission_at && (
        <div className="text-[11px] text-gray-400 mb-4">
          הגשה אחרונה{' '}
          {new Date(form.last_submission_at).toLocaleDateString('he-IL', {
            day: 'numeric',
            month: 'short',
          })}
        </div>
      )}

      <div className="mt-auto pt-3 border-t border-gray-100 flex items-center gap-2">
        {form.status === 'published' ? (
          <>
            <a
              href={`/f/${form.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <ExternalLink className="w-3 h-3" />
              פתיחה
            </a>
            <button
              onClick={onCopy}
              className={`flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 text-xs rounded-lg transition ${
                isCopied
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-100'
              }`}
            >
              {isCopied ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  הועתק
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  העתק קישור
                </>
              )}
            </button>
          </>
        ) : (
          <div className="flex-1 text-xs text-gray-400 italic text-center py-1">
            לא פורסם
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-white border border-gray-100 border-dashed rounded-2xl p-12 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-50 mb-4">
        <Inbox className="w-8 h-8 text-purple-600" />
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">
        אין עדיין טפסים
      </h2>
      <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed mb-6">
        טפסים ב-TaskFlow מאפשרים לאסוף נתונים ציבוריים — לידים, הזמנות, משוב.
        כל הגשה נכנסת אוטומטית לטבלה שתבחר.
      </p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition shadow-sm"
      >
        <Plus className="w-4 h-4" />
        צור טופס ראשון
      </button>
    </div>
  );
}

// ----------------------------------------------------------------------------
function CreateFormDialog({
  tables,
  onClose,
  onCreated,
}: {
  tables: TableLite[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [tableId, setTableId] = useState(tables[0]?.id ?? '');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!title.trim() || !tableId) return;
    setIsCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          table_id: tableId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? 'יצירה נכשלה');
        return;
      }
      onCreated(data.form.id);
    } catch {
      setError('שגיאת רשת. נסה שוב.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">טופס חדש</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <label className="block">
            <span className="block text-sm font-semibold text-gray-700 mb-1.5">
              שם הטופס
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="לדוגמה: הרשמה לוובינר"
              className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="block text-sm font-semibold text-gray-700 mb-1.5">
              איפה לשמור את ההגשות?
            </span>
            {tables.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                אין טבלאות בסביבת העבודה. צור טבלה ראשית כדי שתוכל לחבר אליה טופס.
              </div>
            ) : (
              <select
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.icon ? `${t.icon} ` : ''}
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-500 mt-1.5">
              כל הגשה תיצור רשומה חדשה בטבלה הזו.
            </p>
          </label>

          <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 leading-relaxed">
            💡 לאחר היצירה תקבל טיוטה. בגרסה הבאה תוכל לערוך אילו שדות
            לחשוף ולהתאים עיצוב. בינתיים פנה אלינו בצ&apos;אט להתאמות.
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            ביטול
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || !tableId || isCreating}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                יוצר...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                צור
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
