'use client';

/**
 * DailyDigest
 * ===========
 *
 * A scannable view of "what happened in all my groups today" — fetches
 * the new /api/groupguard/summaries/digest endpoint and renders each
 * group as a card with: group name, headline, 1-paragraph context, and
 * the top 3-4 bullet points. Click a card to expand to the full bullet
 * list + key decisions.
 *
 * Design rationale: the existing per-group SummarySection lives inside
 * each group's settings panel, requiring the user to click into each
 * group to read its summary. This component is the cross-group view —
 * one screen, all groups, scan-friendly.
 *
 * Empty / not-yet-summarized groups still render so the user can tell
 * the difference between "no activity worth summarizing" and "this
 * group doesn't exist".
 */

import { useState, useEffect } from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Sparkles,
  MessageCircle,
  Users,
  X,
  RefreshCw,
} from 'lucide-react';

type DigestGroup = {
  group_id: string;
  group_name: string;
  gg_enabled: boolean;
  summary_enabled: boolean;
  participants_count: number;
  last_summary_at: string | null;
  status: 'has_summary' | 'disabled' | 'not_run_yet';
  summary: {
    id: string;
    headline: string;
    context: string | null;
    bullets: string[];
    key_decisions: string[] | null;
    message_count: number;
    participant_count: number;
    created_at: string;
  } | null;
};

type DigestData = {
  date: string;
  stats: {
    total_groups: number;
    with_summary: number;
    total_messages: number;
  };
  groups: DigestGroup[];
};

export default function DailyDigest({
  workspaceId,
  onClose,
}: {
  workspaceId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [date, setDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, date]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/groupguard/summaries/digest?workspace_id=${workspaceId}&date=${date}`,
      );
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        setError(`שגיאת שרת ${res.status}: ${t.slice(0, 200) || '(ריק)'}`);
        return;
      }
      const d = await res.json();
      if (!d.ok) {
        setError(d.error || 'שגיאה לא ידועה');
        return;
      }
      setData(d);
    } catch (e: any) {
      setError(`${e?.name || 'Error'}: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Date navigation: yesterday/today buttons. Days further back are still
  // accessible via the date input (mobile-friendly native picker).
  function shiftDate(delta: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = date === todayStr;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <div>
              <h3 className="font-bold text-lg">סיכום יומי - מה פספתי</h3>
              <p className="text-xs text-gray-500">
                כל הקבוצות במבט אחד
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

        {/* Date controls + stats */}
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => shiftDate(-1)}
              className="p-1.5 hover:bg-gray-100 rounded text-sm"
              title="יום קודם"
            >
              ←
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={todayStr}
              className="px-2 py-1 text-sm border border-gray-300 rounded"
            />
            {!isToday && (
              <button
                onClick={() => setDate(todayStr)}
                className="text-xs text-purple-600 hover:underline"
              >
                היום
              </button>
            )}
            <button
              onClick={() => shiftDate(1)}
              disabled={isToday}
              className="p-1.5 hover:bg-gray-100 rounded text-sm disabled:opacity-30 disabled:cursor-not-allowed"
              title="יום הבא"
            >
              →
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="p-1.5 hover:bg-gray-100 rounded text-sm disabled:opacity-50 mr-2"
              title="רענן"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {data && (
            <div className="text-xs text-gray-600 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {data.stats.with_summary}/{data.stats.total_groups} קבוצות
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                {data.stats.total_messages.toLocaleString('he-IL')} הודעות
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {loading && (
            <div className="text-center py-8 text-gray-500 text-sm">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-purple-500" />
              טוען סיכומים...
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && data && data.groups.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              אין קבוצות בסביבה הזו עדיין.
            </div>
          )}

          {!loading && !error && data && data.groups.length > 0 && (
            <>
              {data.groups.filter((g) => g.status === 'has_summary').length === 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                  עדיין לא נוצרו סיכומים לתאריך הזה. הסיכום האוטומטי רץ בכל
                  ערב; אפשר גם לרוץ ידנית מהגדרות הקבוצה.
                </div>
              )}

              {data.groups.map((g) => (
                <DigestGroupCard
                  key={g.group_id}
                  group={g}
                  expanded={expandedIds.has(g.group_id)}
                  onToggle={() => toggleExpanded(g.group_id)}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// DigestGroupCard - one group's row in the digest
// ============================================================================
//
// Three states:
//   1. has_summary    - show headline, context, top bullets, expand for full
//   2. not_run_yet    - placeholder card with a 'summary not yet generated'
//                       hint — useful so the user sees the group exists
//                       even if no AI summary ran
//   3. disabled       - dimmed placeholder + 'summaries disabled for this
//                       group' hint, so the user knows why it's empty

function DigestGroupCard({
  group,
  expanded,
  onToggle,
}: {
  group: DigestGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (group.status !== 'has_summary' || !group.summary) {
    return (
      <div
        className={`border rounded-lg p-3 ${
          group.status === 'disabled'
            ? 'border-gray-200 bg-gray-50 opacity-60'
            : 'border-amber-200 bg-amber-50/50'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="font-medium text-sm text-gray-700 truncate">
            {group.group_name}
          </div>
          <span className="text-xs text-gray-500 flex items-center gap-1 flex-shrink-0">
            <Users className="w-3 h-3" />
            {group.participants_count}
          </span>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {group.status === 'disabled'
            ? 'סיכום אוטומטי כבוי לקבוצה זו'
            : 'עדיין לא נוצר סיכום ליום הזה'}
        </div>
      </div>
    );
  }

  const s = group.summary;
  // Show first 3 bullets when collapsed — enough to give a feel without
  // overwhelming. Full list shows on expand.
  const previewBullets = s.bullets.slice(0, 3);
  const hiddenCount = s.bullets.length - previewBullets.length;

  return (
    <div className="border border-purple-200 rounded-lg bg-gradient-to-br from-purple-50/30 to-white overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-right p-3 hover:bg-purple-50/50 transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="font-bold text-sm text-gray-800 truncate">
                {group.group_name}
              </div>
              <span className="text-[10px] text-gray-500 flex items-center gap-0.5 flex-shrink-0">
                <MessageCircle className="w-2.5 h-2.5" />
                {s.message_count}
              </span>
              <span className="text-[10px] text-gray-500 flex items-center gap-0.5 flex-shrink-0">
                <Users className="w-2.5 h-2.5" />
                {s.participant_count}
              </span>
            </div>
            {s.headline && (
              <div className="text-xs text-purple-700 font-medium mt-0.5 line-clamp-2">
                {s.headline}
              </div>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          )}
        </div>

        {/* Always-visible preview: context paragraph + first 3 bullets so
            the user can scan multiple groups without expanding each. */}
        {!expanded && (
          <div className="mt-2 space-y-1.5">
            {s.context && (
              <div className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                {s.context}
              </div>
            )}
            {previewBullets.length > 0 && (
              <ul className="space-y-1 text-right">
                {previewBullets.map((b, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-1.5 text-xs text-gray-700"
                  >
                    <span className="text-purple-400 flex-shrink-0">•</span>
                    <span className="line-clamp-1">{b}</span>
                  </li>
                ))}
                {hiddenCount > 0 && (
                  <li className="text-[11px] text-purple-500 mr-3">
                    + עוד {hiddenCount} נקודות
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </button>

      {/* Expanded view: full context + all bullets + key decisions */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-3 border-t border-purple-100 bg-white">
          {s.context && (
            <div className="text-xs text-gray-700 leading-relaxed bg-purple-50/50 rounded p-2 border border-purple-100 mt-3">
              {s.context}
            </div>
          )}
          <ul className="space-y-1.5">
            {s.bullets.map((b, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-xs text-gray-700"
              >
                <span className="text-purple-500 flex-shrink-0">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {s.key_decisions && s.key_decisions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2">
              <div className="text-[11px] font-bold text-amber-900 mb-1">
                ✓ החלטות / משימות
              </div>
              <ul className="space-y-1">
                {s.key_decisions.map((d, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-amber-900"
                  >
                    <span className="flex-shrink-0">→</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
