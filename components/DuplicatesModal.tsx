'use client';

import { useState, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  Users,
  Check,
  Loader2,
  ChevronRight,
  Phone,
  Mail,
  Star,
  Trash2,
} from 'lucide-react';
import type { Field, RecordRow } from '@/lib/types/database';
import {
  type DuplicateGroup,
  previewMergedData,
} from '@/lib/duplicates/detect';

/**
 * DuplicatesModal — review & merge duplicate records.
 *
 * Workflow:
 *   1. List of duplicate groups (e.g. "3 records share the phone 0556691165").
 *   2. User clicks a group → drills into a side-by-side comparison.
 *   3. User picks which record stays as the primary (default: oldest).
 *   4. Preview shows the merged record with values colored by source.
 *   5. Confirm → POST /api/records/merge → primary updated, duplicates deleted,
 *      onMerged() callback updates parent state.
 *
 * Design choice: non-destructive merge — primary's existing values are NEVER
 * overwritten; only its empty fields are filled from duplicates. This matches
 * the user's intuition ("I picked this one for a reason") and avoids data loss.
 */
export default function DuplicatesModal({
  groups,
  fields,
  onClose,
  onMerged,
}: {
  groups: DuplicateGroup[];
  fields: Field[];
  onClose: () => void;
  /** Called after a successful merge with { keptId, deletedIds, mergedRecord } */
  onMerged: (result: {
    keptId: string;
    deletedIds: string[];
    mergedRecord: RecordRow;
  }) => void;
}) {
  // Which group is currently being reviewed. null = list view.
  const [activeGroup, setActiveGroup] = useState<DuplicateGroup | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-3xl max-h-[92vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===== Header ===== */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">
                {activeGroup ? 'מיזוג רשומות כפולות' : 'רשומות כפולות'}
              </h2>
              <p className="text-xs text-gray-500">
                {activeGroup
                  ? `${activeGroup.records.length} רשומות עם אותו ${labelForFieldType(activeGroup.field.type)}`
                  : `${groups.length} ${groups.length === 1 ? 'קבוצה' : 'קבוצות'} זוהו`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ===== Body ===== */}
        <div className="flex-1 overflow-y-auto">
          {activeGroup ? (
            <MergeView
              group={activeGroup}
              fields={fields}
              onBack={() => setActiveGroup(null)}
              onMerged={(result) => {
                onMerged(result);
                // After merging, this group is gone — go back to the list.
                // If it was the last group, close the modal entirely.
                const remaining = groups.filter((g) => g.key !== activeGroup.key);
                if (remaining.length === 0) onClose();
                else setActiveGroup(null);
              }}
            />
          ) : (
            <GroupsList groups={groups} onPick={setActiveGroup} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Groups list (the default screen)
// ─────────────────────────────────────────────────────────────────────────────

function GroupsList({
  groups,
  onPick,
}: {
  groups: DuplicateGroup[];
  onPick: (g: DuplicateGroup) => void;
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
        <div className="font-semibold mb-1">איך מיזוג עובד?</div>
        <ol className="list-decimal list-inside space-y-0.5 text-xs leading-relaxed">
          <li>בחר קבוצה כדי לראות את הרשומות הכפולות.</li>
          <li>בחר רשומה ראשית — היא תישאר, השאר ימוזגו לתוכה.</li>
          <li>הערכים של הראשית נשמרים. שדות ריקים מתמלאים מהאחרים.</li>
          <li>הרשומות האחרות יימחקו לצמיתות.</li>
        </ol>
      </div>

      {groups.map((g) => (
        <button
          key={g.key}
          onClick={() => onPick(g)}
          className="w-full text-right bg-white border border-gray-200 hover:border-amber-400 hover:bg-amber-50 rounded-xl p-4 transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                {g.field.type === 'phone' ? (
                  <Phone className="w-5 h-5 text-amber-600" />
                ) : (
                  <Mail className="w-5 h-5 text-amber-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-gray-900 truncate">
                  {g.displayValue}
                </div>
                <div className="text-xs text-gray-500">
                  {g.records.length} רשומות עם אותו {labelForFieldType(g.field.type)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-full">
                ×{g.records.length}
              </span>
              <ChevronRight className="w-4 h-4 text-gray-400 rotate-180" />
            </div>
          </div>

          {/* Preview of involved records (titles only) */}
          <div className="mt-3 flex flex-wrap gap-1">
            {g.records.slice(0, 4).map((r) => (
              <span
                key={r.id}
                className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded"
              >
                {recordTitle(r)}
              </span>
            ))}
            {g.records.length > 4 && (
              <span className="text-xs text-gray-500 px-2 py-0.5">
                ועוד {g.records.length - 4}…
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Merge view (per-group)
// ─────────────────────────────────────────────────────────────────────────────

function MergeView({
  group,
  fields,
  onBack,
  onMerged,
}: {
  group: DuplicateGroup;
  fields: Field[];
  onBack: () => void;
  onMerged: (result: {
    keptId: string;
    deletedIds: string[];
    mergedRecord: RecordRow;
  }) => void;
}) {
  // Default primary = oldest record (first in sorted order)
  const [primaryId, setPrimaryId] = useState<string>(group.records[0].id);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primary = useMemo(
    () => group.records.find((r) => r.id === primaryId)!,
    [group, primaryId]
  );
  const duplicates = useMemo(
    () => group.records.filter((r) => r.id !== primaryId),
    [group, primaryId]
  );

  const { data: mergedData, filledFromDuplicate } = useMemo(
    () => previewMergedData(primary, duplicates),
    [primary, duplicates]
  );

  // Only show fields that have a value somewhere — keeps the preview compact
  const visibleFields = useMemo(() => {
    return fields.filter((f) => {
      const allValues = group.records.map((r) => r.data?.[f.slug]);
      return allValues.some(
        (v) => v !== undefined && v !== null && v !== ''
      );
    });
  }, [fields, group.records]);

  async function handleMerge() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/records/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_id: primaryId,
          duplicate_ids: duplicates.map((d) => d.id),
          merged_data: mergedData,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'שגיאה במיזוג');
        setSubmitting(false);
        return;
      }
      onMerged({
        keptId: primaryId,
        deletedIds: duplicates.map((d) => d.id),
        mergedRecord: json.merged_record,
      });
    } catch (e: any) {
      setError(e?.message || 'שגיאת רשת');
      setSubmitting(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <button
        onClick={onBack}
        className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
      >
        <ChevronRight className="w-4 h-4" /> חזרה לרשימת הקבוצות
      </button>

      {/* ===== Step 1: Pick the primary ===== */}
      <div>
        <div className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" />
          בחר את הרשומה הראשית (זו שתישאר)
        </div>
        <div className="space-y-2">
          {group.records.map((r) => {
            const isPrimary = r.id === primaryId;
            return (
              <button
                key={r.id}
                onClick={() => setPrimaryId(r.id)}
                className={`w-full text-right border-2 rounded-lg p-3 transition-colors ${
                  isPrimary
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-900 truncate">
                      {recordTitle(r)}
                    </div>
                    <div className="text-xs text-gray-500">
                      נוצר {formatDate(r.created_at)}
                      {r.source && r.source !== 'manual' && ` • מקור: ${r.source}`}
                    </div>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isPrimary
                        ? 'border-amber-500 bg-amber-500'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {isPrimary && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== Step 2: Preview merged values ===== */}
      <div>
        <div className="font-semibold text-gray-900 mb-2">
          תצוגה מקדימה של הרשומה הממוזגת
        </div>
        <div className="border border-gray-200 rounded-lg divide-y">
          {visibleFields.map((f) => {
            const value = mergedData[f.slug];
            const filledFrom = filledFromDuplicate[f.slug];
            const isFromDuplicate = !!filledFrom;
            const display = formatFieldValue(value, f);
            return (
              <div
                key={f.slug}
                className="flex items-start gap-3 p-3 text-sm"
              >
                <div className="text-gray-500 w-28 shrink-0">{f.name}</div>
                <div className="flex-1 min-w-0">
                  {display ? (
                    <span className="text-gray-900 break-words">{display}</span>
                  ) : (
                    <span className="text-gray-400 italic">ריק</span>
                  )}
                  {isFromDuplicate && (
                    <span className="block text-xs text-blue-600 mt-0.5">
                      ← מולא מרשומה כפולה
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== Step 3: What gets deleted ===== */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
        <div className="flex items-center gap-2 text-red-800 font-semibold text-sm mb-1">
          <Trash2 className="w-4 h-4" />
          {duplicates.length} {duplicates.length === 1 ? 'רשומה תימחק' : 'רשומות יימחקו'} לצמיתות
        </div>
        <div className="text-xs text-red-700">
          {duplicates.map((d) => recordTitle(d)).join(', ')}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ===== Action buttons ===== */}
      <div className="flex gap-2 sticky bottom-0 bg-white pt-2">
        <button
          onClick={onBack}
          disabled={submitting}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          ביטול
        </button>
        <button
          onClick={handleMerge}
          disabled={submitting}
          className="flex-1 px-4 py-3 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> ממזג...
            </>
          ) : (
            <>אישור מיזוג</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function labelForFieldType(t: Field['type']): string {
  if (t === 'phone') return 'טלפון';
  if (t === 'email') return 'אימייל';
  return 'ערך';
}

function recordTitle(r: RecordRow): string {
  const data = r.data || {};
  return (
    data.full_name ||
    data.name ||
    data.title ||
    data.first_name ||
    `רשומה ${r.id.slice(0, 8)}`
  );
}

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString('he-IL', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  } catch {
    return s;
  }
}

function formatFieldValue(value: any, field: Field): string {
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  if (field.type === 'currency' && typeof value === 'number') {
    return value.toLocaleString('he-IL') + ' ₪';
  }
  if (field.type === 'date' || field.type === 'datetime') {
    try {
      return new Date(value).toLocaleDateString('he-IL');
    } catch {
      return String(value);
    }
  }
  return String(value);
}
