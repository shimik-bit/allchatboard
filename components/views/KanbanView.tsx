'use client';

import type { Field, RecordRow } from '@/lib/types/database';
import { useMemo } from 'react';

export default function KanbanView({
  fields, records, groupByField, primaryField, onRecordClick,
}: {
  fields: Field[];
  records: RecordRow[];
  groupByField: Field | null;
  primaryField: Field | null;
  onRecordClick: (r: RecordRow) => void;
}) {
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

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-fit p-2">
        {columns.map((col) => (
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
            <div className="bg-gray-50 rounded-b-lg p-2 min-h-[200px] space-y-2">
              {col.records.map((r) => (
                <KanbanCard
                  key={r.id}
                  record={r}
                  fields={fields}
                  primaryField={primaryField}
                  groupByField={groupByField}
                  onClick={() => onRecordClick(r)}
                />
              ))}
              {col.records.length === 0 && (
                <div className="text-center py-6 text-xs text-gray-400">ריק</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KanbanCard({
  record, fields, primaryField, groupByField, onClick,
}: {
  record: RecordRow;
  fields: Field[];
  primaryField: Field | null;
  groupByField: Field;
  onClick: () => void;
}) {
  const title = primaryField
    ? record.data?.[primaryField.slug] || 'ללא כותרת'
    : Object.values(record.data || {})[0] || 'ללא כותרת';

  // Show 2-3 secondary fields (excluding primary and groupBy)
  const secondaryFields = fields
    .filter((f) => f.id !== primaryField?.id && f.id !== groupByField.id)
    .filter((f) => record.data?.[f.slug])
    .slice(0, 3);

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-all cursor-pointer border border-gray-100"
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
