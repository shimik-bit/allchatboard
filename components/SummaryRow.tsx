'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import type { Field, RecordRow } from '@/lib/types/database';
import {
  computeAggregation,
  getEffectiveAggregation,
  getAvailableAggregations,
  AGGREGATION_LABELS,
  type AggregationType,
} from '@/lib/aggregations';
import { createClient } from '@/lib/supabase/client';

/**
 * SummaryRow - sticky bottom row of a table showing aggregations per column.
 *
 * - Auto-calculates default aggregation per field type (sum for numbers etc.)
 * - User can click any cell to change the aggregation
 * - Always shows record count on the left
 * - Sticky bottom so it stays visible while scrolling
 */

export default function SummaryRow({
  fields,
  records,
  canEdit = true,
}: {
  fields: Field[];
  records: RecordRow[];
  canEdit?: boolean;
}) {
  return (
    <tr
      className="sticky bottom-0 bg-gradient-to-b from-gray-50 to-gray-100/95 backdrop-blur border-t-2 border-gray-200 font-medium z-10 shadow-[0_-4px_8px_-4px_rgba(0,0,0,0.05)]"
    >
      {/* First column: total record count */}
      <td className="px-4 py-2 text-sm whitespace-nowrap">
        <span className="text-gray-700 font-bold">
          {records.length}
        </span>{' '}
        <span className="text-gray-500 text-xs">
          {records.length === 1 ? 'רשומה' : 'רשומות'}
        </span>
      </td>

      {/* One cell per field after the primary */}
      {fields.slice(1).map((field) => (
        <SummaryCell
          key={field.id}
          field={field}
          records={records}
          canEdit={canEdit}
        />
      ))}

      {/* Trailing fixed columns to match header (assignee, notes, opened, by, status, source) */}
      <td className="px-2 py-2"></td>
      <td className="px-2 py-2"></td>
      <td className="px-2 py-2"></td>
      <td className="px-2 py-2"></td>
      <td className="px-2 py-2"></td>
      <td className="px-2 py-2"></td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function SummaryCell({
  field,
  records,
  canEdit,
}: {
  field: Field;
  records: RecordRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  // Optimistic local override so UI updates instantly before refetch
  const [localAgg, setLocalAgg] = useState<AggregationType | null>(null);
  const supabase = createClient();

  const effectiveField = localAgg
    ? { ...field, summary_aggregation: localAgg === AGGREGATIONS_BY_TYPE_DEFAULT[field.type] ? null : localAgg }
    : field;
  const currentAgg = getEffectiveAggregation(effectiveField);
  const result = computeAggregation(effectiveField, records, currentAgg);
  const available = getAvailableAggregations(field.type);

  async function setAggregation(agg: AggregationType) {
    if (!canEdit) return;
    setBusy(true);
    setPicking(false);
    setLocalAgg(agg); // Optimistic update
    try {
      const valueToSave = agg === AGGREGATIONS_BY_TYPE_DEFAULT[field.type] ? null : agg;
      const { error } = await supabase
        .from('fields')
        .update({ summary_aggregation: valueToSave })
        .eq('id', field.id);
      if (error) {
        // Revert on error
        setLocalAgg(null);
        console.error('Failed to save aggregation:', error);
      } else {
        // Refresh server data so other clients see the change
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  // No aggregation chosen / available → empty cell
  if (!result && currentAgg === 'none') {
    return (
      <td className="px-4 py-2 text-xs text-gray-400 relative">
        {canEdit && (
          <button
            onClick={() => setPicking(true)}
            className="hover:text-gray-600 hover:underline text-[10px]"
          >
            + סיכום
          </button>
        )}
        {picking && <Picker available={available} current={currentAgg} onPick={setAggregation} onClose={() => setPicking(false)} />}
      </td>
    );
  }

  return (
    <td className="px-4 py-2 text-sm relative whitespace-nowrap">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => canEdit && setPicking(!picking)}
          disabled={!canEdit || busy}
          className={`text-right ${canEdit ? 'cursor-pointer hover:text-brand-600 transition-colors' : 'cursor-default'} ${busy ? 'opacity-50' : ''}`}
          title={result?.detail || AGGREGATION_LABELS[currentAgg]}
        >
          {result?.display && result.display !== '—' ? (
            <>
              <span className="text-[10px] text-gray-500 font-normal block leading-none mb-0.5">
                {AGGREGATION_LABELS[currentAgg]}
              </span>
              <span className="text-gray-900 font-bold">
                {result.display}
              </span>
            </>
          ) : (
            <span className="text-gray-300 text-xs">—</span>
          )}
        </button>
        {canEdit && (
          <ChevronDown className="w-3 h-3 text-gray-400 opacity-60" />
        )}
      </div>

      {picking && (
        <Picker
          available={available}
          current={currentAgg}
          onPick={setAggregation}
          onClose={() => setPicking(false)}
        />
      )}
    </td>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function Picker({
  available,
  current,
  onPick,
  onClose,
}: {
  available: AggregationType[];
  current: AggregationType;
  onPick: (agg: AggregationType) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute bottom-full mb-1 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-40 py-1 min-w-[140px] text-right">
        <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
          סיכום
        </div>
        {available.map((agg) => (
          <button
            key={agg}
            onClick={() => onPick(agg)}
            className={`w-full text-right px-3 py-1.5 text-xs hover:bg-brand-50 transition-colors ${
              agg === current ? 'bg-brand-50 text-brand-700 font-bold' : 'text-gray-700'
            }`}
          >
            {AGGREGATION_LABELS[agg]}
            {agg === current && <span className="float-left text-brand-600">✓</span>}
          </button>
        ))}
      </div>
    </>
  );
}

// Local copy of defaults map (avoid circular import)
const AGGREGATIONS_BY_TYPE_DEFAULT: Record<string, AggregationType> = {
  number: 'sum', currency: 'sum', rating: 'avg',
  date: 'range', datetime: 'range',
  text: 'count_filled', longtext: 'count_filled',
  email: 'count_filled', phone: 'count_filled', url: 'count_filled',
  city: 'most_common',
  select: 'distribution', multiselect: 'distribution', status: 'distribution',
  checkbox: 'count_filled',
  user: 'count_unique', attachment: 'count_filled', relation: 'count_filled',
};
