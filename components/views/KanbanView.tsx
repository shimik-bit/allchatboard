'use client';

import type { Field, RecordRow } from '@/lib/types/database';
import { useMemo, useState } from 'react';

/**
 * KanbanView - displays records grouped by a select/status field as columns.
 *
 * Drag-and-drop support:
 * - HTML5 drag API with mouse and touch fallback
 * - When a card is dropped in a different column, calls onRecordUpdate to
 *   persist the new value to the DB. Optimistic update happens instantly,
 *   so the card appears in the new column even if the API call is slow.
 */
export default function KanbanView({
  fields, records, groupByField, primaryField, onRecordClick, onRecordUpdate,
}: {
  fields: Field[];
  records: RecordRow[];
  groupByField: Field | null;
  primaryField: Field | null;
  onRecordClick: (r: RecordRow) => void;
  onRecordUpdate?: (recordId: string, patch: { data: Record<string, any> }) => Promise<void> | void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const columns = useMemo(() => {
    if (!groupByField) {
      return [{ value: 'all', label: 'הכל', color: '#9ca3af', records }];
    }

    const opts = groupByField.config?.options || [];
    const cols = opts.map((opt) => ({
      value: opt.value,
      label: opt.label,
      color: opt.color || '#9ca3af',
      records: records.filter((r) => r.data?.[groupByField.slug] === opt.value),
    }));

    const ungrouped = records.filter(
      (r) => !opts.some((o) => o.value === r.data?.[groupByField.slug])
    );
    if (ungrouped.length > 0) {
      cols.push({ value: '_ungrouped', label: 'ללא קטגוריה', color: '#d1d5db', records: ungrouped });
    }
    return cols;
  }, [records, groupByField]);

  if (!groupByField) {
    return (
      <div className="text-center py-16 text-gray-500">
        <div className="text-4xl mb-3">📊</div>
        <p className="font-medium">אין שדה לקיבוץ</p>
        <p className="text-sm mt-1">תצוגת קנבן דורשת שדה מסוג בחירה (Select / Status)</p>
      </div>
    );
  }

  const isDragSupported = !!onRecordUpdate;

  function handleDragStart(e: React.DragEvent, recordId: string) {
    if (!isDragSupported) return;
    setDraggingId(recordId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', recordId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverColumn(null);
  }

  function handleDragOver(e: React.DragEvent, columnValue: string) {
    if (!isDragSupported || !draggingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnValue) {
      setDragOverColumn(columnValue);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    if (e.currentTarget === e.target) {
      setDragOverColumn(null);
    }
  }

  async function handleDrop(e: React.DragEvent, targetColumnValue: string) {
    e.preventDefault();
    setDragOverColumn(null);

    if (!isDragSupported || !groupByField || !onRecordUpdate) return;

    const recordId = e.dataTransfer.getData('text/plain') || draggingId;
    if (!recordId) return;

    const record = records.find((r) => r.id === recordId);
    if (!record) return;

    const currentValue = record.data?.[groupByField.slug];

    // Don't update if dropped in the same column or in 'ungrouped'
    if (currentValue === targetColumnValue) return;
    if (targetColumnValue === '_ungrouped') return;

    setDraggingId(null);

    try {
      await onRecordUpdate(recordId, {
        data: { [groupByField.slug]: targetColumnValue },
      });
    } catch (err) {
      console.error('Failed to update record on drop:', err);
    }
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-fit p-2">
        {columns.map((col) => {
          const isDragOver = dragOverColumn === col.value;
          const canAcceptDrop = isDragSupported && col.value !== '_ungrouped';
          return (
            <div key={col.value} className="w-72 shrink-0">
              <div
                className="px-3 py-2 rounded-t-lg flex items-center justify-between"
                style={{ background: `${col.color}15`, borderTop: `3px solid ${col.color}` }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{col.label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/60 text-gray-700">
                    {col.records.length}
                  </span>
                </div>
              </div>
              <div
                onDragOver={canAcceptDrop ? (e) => handleDragOver(e, col.value) : undefined}
                onDragLeave={canAcceptDrop ? handleDragLeave : undefined}
                onDrop={canAcceptDrop ? (e) => handleDrop(e, col.value) : undefined}
                className={`
                  rounded-b-lg p-2 min-h-[200px] space-y-2 transition-all
                  ${isDragOver
                    ? 'bg-brand-50 ring-2 ring-brand-300 ring-inset'
                    : 'bg-gray-50'}
                `}
              >
                {col.records.map((r) => (
                  <KanbanCard
                    key={r.id}
                    record={r}
                    fields={fields}
                    primaryField={primaryField}
                    groupByField={groupByField}
                    isDragging={draggingId === r.id}
                    isDraggable={isDragSupported}
                    onClick={() => onRecordClick(r)}
                    onDragStart={(e) => handleDragStart(e, r.id)}
                    onDragEnd={handleDragEnd}
                  />
                ))}
                {col.records.length === 0 && (
                  <div className="text-center py-6 text-xs text-gray-400">
                    {isDragOver ? '🎯 שחרר כאן' : 'ריק'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {isDragSupported && (
        <div className="text-center mt-3 text-xs text-gray-400">
          💡 גרור כרטיסים בין עמודות כדי לשנות סטטוס
        </div>
      )}
    </div>
  );
}

function KanbanCard({
  record, fields, primaryField, groupByField, isDragging, isDraggable, onClick, onDragStart, onDragEnd,
}: {
  record: RecordRow;
  fields: Field[];
  primaryField: Field | null;
  groupByField: Field;
  isDragging: boolean;
  isDraggable: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const title = primaryField
    ? record.data?.[primaryField.slug] || 'ללא כותרת'
    : Object.values(record.data || {})[0] || 'ללא כותרת';

  const secondaryFields = fields
    .filter((f) => f.id !== primaryField?.id && f.id !== groupByField.id)
    .filter((f) => record.data?.[f.slug])
    .slice(0, 3);

  return (
    <div
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`
        bg-white rounded-lg p-3 shadow-sm border border-gray-100 transition-all
        ${isDragging
          ? 'opacity-30 scale-95 cursor-grabbing'
          : isDraggable
            ? 'cursor-grab hover:shadow-md hover:border-gray-200 active:cursor-grabbing'
            : 'cursor-pointer hover:shadow-md'}
      `}
    >
      <div className="font-medium text-sm mb-2 line-clamp-2">{String(title)}</div>
      {secondaryFields.length > 0 && (
        <div className="space-y-1">
          {secondaryFields.map((f) => (
            <div key={f.id} className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="text-gray-400">{f.name}:</span>
              <span className="text-gray-700 truncate">{String(record.data[f.slug])}</span>
            </div>
          ))}
        </div>
      )}
      {record.source === 'whatsapp' && (
        <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-gray-400">
          💬 וואטסאפ
        </div>
      )}
    </div>
  );
}
