'use client';

/**
 * BlocklistLookupModal
 * ====================
 *
 * Search interface for "is this phone in the spammer database?". Pulled
 * out into its own file (vs. inline like ManualSpammerModal) because:
 *   - The form has more state (debounced search input, multiple result
 *     sections)
 *   - The display logic is more elaborate (3 different sections per result,
 *     each with its own empty state)
 *   - Likely to grow as the user asks for more lookup features (filter by
 *     date range, search across multiple workspaces, etc.)
 *
 * Architecture: input field with a 350ms debounce → calls
 * /api/groupguard/blocklist/lookup → renders results in three sections:
 *   1. Blocklist record (the main answer)
 *   2. Actions taken against this phone in this workspace
 *   3. Member profile if known
 *
 * Each section handles its own empty state — e.g. "not in blocklist but
 * we did kick them 3 times last week" is a meaningful answer worth
 * showing, not an error.
 */

import { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  AlertTriangle,
  Shield,
  ShieldCheck,
  Phone,
  User,
  Clock,
  XCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

type LookupResult = {
  ok: true;
  phone: string;
  found: boolean;
  hint?: string;
  entry: {
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
    added_manually: boolean;
    added_manually_by_email: string | null;
    added_manually_at: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  actions: {
    total_count: number;
    recent: Array<{
      id: string;
      group_id: string;
      group_name: string;
      action_type: string;
      trigger_source: string;
      was_successful: boolean;
      created_at: string;
    }>;
  };
  profile: {
    id: string;
    display_name: string | null;
    full_name: string | null;
    profession: string | null;
    business_name: string | null;
    groups_count: number | null;
    message_count: number | null;
    avatar_url: string | null;
    completeness_pct: number | null;
  } | null;
};

const actionTypeLabels: Record<string, string> = {
  kick: 'הוצא מהקבוצה',
  delete_message: 'הודעה נמחקה',
  warn: 'אזהרה',
  blocklist_add: 'נוסף למאגר',
  whitelist_skip: 'דלג (whitelist)',
};

const triggerSourceLabels: Record<string, string> = {
  ai: 'AI',
  manual_report: 'דיווח ידני',
  phone_prefix: 'קידומת',
  global_blocklist: 'מאגר',
  whitelist: 'whitelist',
};

export default function BlocklistLookupModal({
  workspaceId,
  onClose,
  onAddedSpammer,
}: {
  workspaceId: string;
  onClose: () => void;
  onAddedSpammer?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce the search so we don't hit the API on every keystroke.
  // 350ms = roughly the gap between deliberate typing strokes; feels
  // responsive but cuts request count by 5-10x for fast typers. The
  // backend itself is cheap (3 indexed queries) so this is mostly to
  // be polite to the DB and avoid race conditions in result rendering.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.replace(/\D/g, '');
    if (trimmed.length < 4) {
      // Below threshold — clear state, don't bother the API. Same
      // threshold as the API itself uses; consistent UX.
      setResult(null);
      setError(null);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void doSearch(trimmed);
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function doSearch(phone: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/groupguard/blocklist/lookup?workspace_id=${workspaceId}&phone=${phone}`,
      );
      // Robust error handling pattern — same as the avatar backfill /
      // manual-add endpoints. Check res.ok BEFORE res.json() so a 504
      // HTML page from Vercel doesn't trigger Safari's cryptic parse
      // error.
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        setError(`שגיאת שרת ${res.status}: ${t.slice(0, 200) || '(ריק)'}`);
        setResult(null);
        return;
      }
      const data: LookupResult = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(`${e?.name || 'Error'}: ${e?.message || String(e)}`);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  // "Add to blocklist" CTA when the phone isn't already there. Just calls
  // the existing manual-add endpoint with a default reason ("מחיפוש"),
  // then re-runs the lookup so the user sees the new entry immediately.
  async function handleQuickAdd() {
    if (!result || result.found) return;
    setLoading(true);
    try {
      const res = await fetch('/api/groupguard/blocklist/manual-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          phone: result.phone,
          reason: 'other',
          notes: 'הוסף דרך מסך החיפוש',
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        setError(`לא ניתן להוסיף: ${res.status} ${t.slice(0, 200)}`);
        return;
      }
      onAddedSpammer?.();
      // Re-run the lookup so the modal flips to the "found" state
      void doSearch(result.phone);
    } catch (e: any) {
      setError(`${e?.name || 'Error'}: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl z-10">
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-lg">חיפוש מספר במאגר</h3>
              <p className="text-xs text-gray-500">
                מאגר ספאמרים גלובלי + היסטוריה בסביבת העבודה
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
            aria-label="סגור"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Phone className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="tel"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="הזן מספר טלפון (לדוגמה: 972501234567)"
              dir="ltr"
              autoFocus
              className="w-full pr-10 pl-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {loading && (
              <RefreshCw className="w-4 h-4 text-blue-500 absolute left-3 top-1/2 -translate-y-1/2 animate-spin" />
            )}
          </div>
          <p className="text-[11px] text-gray-500 mt-1.5">
            הקלד לפחות 4 ספרות. ניתן להדביק עם +, רווחים או מקפים — הם
            יוסרו אוטומטית.
          </p>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 min-h-[200px]">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {!query.replace(/\D/g, '') && !error && (
            <div className="text-center py-12 text-gray-400 text-sm">
              <Search className="w-10 h-10 mx-auto mb-2 opacity-30" />
              הזן מספר כדי להתחיל
            </div>
          )}

          {result?.hint && !result.found && (
            <div className="text-center py-8 text-gray-500 text-sm">
              {result.hint}
            </div>
          )}

          {result && !result.hint && (
            <>
              {/* SECTION 1: Blocklist record */}
              <BlocklistEntryCard
                entry={result.entry}
                phone={result.phone}
                onQuickAdd={handleQuickAdd}
                quickAddDisabled={loading}
              />

              {/* SECTION 2: Profile (if known in this workspace) */}
              {result.profile && (
                <ProfileCard profile={result.profile} />
              )}

              {/* SECTION 3: Action history in this workspace */}
              <ActionsCard actions={result.actions} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// Section components
// ============================================================================
//
// Split into three small components so each section's logic is local. Empty
// states are handled inside each because each empty state means something
// different (no blocklist record vs. no profile vs. no actions taken).

function BlocklistEntryCard({
  entry,
  phone,
  onQuickAdd,
  quickAddDisabled,
}: {
  entry: LookupResult['entry'];
  phone: string;
  onQuickAdd: () => void;
  quickAddDisabled: boolean;
}) {
  if (!entry) {
    return (
      <div className="border border-green-200 bg-green-50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-green-900 mb-0.5">
              לא נמצא במאגר הספאמרים
            </div>
            <div className="text-xs text-green-800 mb-2.5">
              המספר{' '}
              <span dir="ltr" className="font-mono">
                +{phone}
              </span>{' '}
              אינו רשום במאגר. הבוט לא יבעט אותו אוטומטית.
            </div>
            <button
              onClick={onQuickAdd}
              disabled={quickAddDisabled}
              className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3 h-3" />
              הוסף למאגר עכשיו
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-red-200 bg-red-50 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Shield className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-bold text-sm text-red-900">
              נמצא במאגר הספאמרים
            </span>
            {entry.is_confirmed && (
              <span className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded font-medium">
                מאומת
              </span>
            )}
            {entry.added_manually && (
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-600 text-white rounded font-medium">
                ✋ הוכנס ידנית
              </span>
            )}
          </div>

          <div className="text-xs text-red-800 mb-3" dir="ltr">
            +{entry.phone}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <DetailRow label="דיווחים" value={entry.report_count.toLocaleString('he-IL')} />
            <DetailRow label="קבוצות" value={entry.unique_groups_count.toLocaleString('he-IL')} />
            <DetailRow
              label="סביבות עבודה"
              value={entry.unique_workspaces_count.toLocaleString('he-IL')}
            />
            <DetailRow
              label="דיווח ראשון"
              value={fmtDate(entry.first_reported_at)}
            />
            <DetailRow
              label="דיווח אחרון"
              value={fmtDate(entry.last_reported_at)}
            />
            {entry.reason_summary && (
              <DetailRow label="סיבה" value={entry.reason_summary} />
            )}
          </div>

          {entry.added_manually && entry.added_manually_by_email && (
            <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded p-2 mt-3">
              הוסף ידנית ע"י{' '}
              <span className="font-medium">{entry.added_manually_by_email}</span>
              {entry.added_manually_at && (
                <> ב-{fmtDate(entry.added_manually_at)}</>
              )}
            </div>
          )}

          {entry.notes && (
            <div className="text-[11px] text-gray-700 bg-white border border-gray-200 rounded p-2 mt-2 whitespace-pre-line max-h-32 overflow-y-auto">
              <div className="font-bold mb-0.5">הערות:</div>
              {entry.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileCard({ profile }: { profile: NonNullable<LookupResult['profile']> }) {
  const displayName = profile.display_name || profile.full_name;
  const hasInfo =
    displayName ||
    profile.profession ||
    profile.business_name ||
    profile.groups_count ||
    profile.message_count;

  if (!hasInfo) return null;

  return (
    <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-3">
      <div className="flex items-start gap-3">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatar_url}
            alt=""
            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-blue-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold text-blue-900 mb-1">
            פרופיל בסביבת העבודה
          </div>
          {displayName && (
            <div className="text-sm font-medium text-gray-800 truncate">
              {displayName}
            </div>
          )}
          {profile.profession && (
            <div className="text-xs text-gray-600 truncate">
              {profile.profession}
              {profile.business_name && <> · {profile.business_name}</>}
            </div>
          )}
          {(profile.groups_count || profile.message_count) && (
            <div className="text-[11px] text-gray-500 mt-1 flex items-center gap-3">
              {profile.groups_count !== null && (
                <span>{profile.groups_count} קבוצות</span>
              )}
              {profile.message_count !== null && (
                <span>{profile.message_count.toLocaleString('he-IL')} הודעות</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionsCard({ actions }: { actions: LookupResult['actions'] }) {
  if (actions.total_count === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-3 text-xs text-gray-500 flex items-center gap-2">
        <Clock className="w-4 h-4 flex-shrink-0" />
        הבוט לא ביצע פעולות נגד מספר זה בקבוצות שלך.
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          היסטוריה בסביבת העבודה
        </div>
        <div className="text-xs text-gray-500">
          {actions.total_count.toLocaleString('he-IL')} פעולות סה"כ
        </div>
      </div>
      <ul className="space-y-1.5">
        {actions.recent.map((a) => (
          <li
            key={a.id}
            className="flex items-start gap-2 text-xs border-t border-gray-100 pt-1.5 first:border-t-0 first:pt-0"
          >
            {a.was_successful ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-gray-800">
                <span className="font-medium">
                  {actionTypeLabels[a.action_type] || a.action_type}
                </span>{' '}
                · {a.group_name}
              </div>
              <div className="text-[10px] text-gray-500">
                {triggerSourceLabels[a.trigger_source] || a.trigger_source} ·{' '}
                {fmtDateTime(a.created_at)}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {actions.total_count > actions.recent.length && (
        <div className="text-[11px] text-gray-400 mt-2">
          מציג {actions.recent.length} מתוך {actions.total_count.toLocaleString('he-IL')}
        </div>
      )}
    </div>
  );
}


// ============================================================================
// Helpers
// ============================================================================

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500">{label}:</span>
      <span className="text-gray-900 font-medium truncate">{value}</span>
    </div>
  );
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('he-IL');
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('he-IL', {
      day: 'numeric',
      month: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
