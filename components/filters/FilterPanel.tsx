'use client';

import { useState, useRef, useEffect } from 'react';
import { Filter, Plus, X, ChevronDown, Save } from 'lucide-react';
import type { Field } from '@/lib/types/database';
import {
  type FilterGroup, type FilterCondition, type FilterOperator,
  getOperatorsForType, OPERATOR_LABELS, NO_VALUE_OPERATORS, ARRAY_VALUE_OPERATORS,
} from '@/lib/filters';

interface FilterPanelProps {
  fields: Field[];
  filters: FilterGroup;
  onChange: (filters: FilterGroup) => void;
  /** Optional: when present, enables "save filter" button */
  tableId?: string;
  workspaceId?: string;
  /** Called after successful save - parent should reload SavedFiltersBar */
  onFilterSaved?: () => void;
}

export default function FilterPanel({ fields, filters, onChange, tableId, workspaceId, onFilterSaved }: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const conditionCount = filters.conditions?.length || 0;

  // Filter out fields that aren't filterable (attachment, etc. — could be expanded)
  const filterableFields = fields.filter(
    (f) => f.type !== 'attachment' || true // for now allow all
  );

  const addCondition = () => {
    const firstField = filterableFields[0];
    if (!firstField) return;
    const ops = getOperatorsForType(firstField.type);
    const newCondition: FilterCondition = {
      field_slug: firstField.slug,
      operator: ops[0],
      value: '',
    };
    onChange({
      ...filters,
      conditions: [...(filters.conditions || []), newCondition],
    });
  };

  const updateCondition = (idx: number, updates: Partial<FilterCondition>) => {
    const next = [...filters.conditions];
    next[idx] = { ...next[idx], ...updates };
    onChange({ ...filters, conditions: next });
  };

  const removeCondition = (idx: number) => {
    onChange({
      ...filters,
      conditions: filters.conditions.filter((_, i) => i !== idx),
    });
  };

  const clearAll = () => {
    onChange({ ...filters, conditions: [] });
    setOpen(false);
  };

  const [saving, setSaving] = useState(false);

  const handleSaveFilter = async () => {
    if (!tableId || !workspaceId) return;
    if (filters.conditions.length === 0) {
      alert('הוסף לפחות תנאי אחד לפני שמירה');
      return;
    }
    const name = window.prompt('שם הפילטר:', '');
    if (!name || !name.trim()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/saved-filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: tableId,
          workspace_id: workspaceId,
          name: name.trim(),
          filters,
        }),
      });
      if (res.ok) {
        // Trigger SavedFiltersBar reload
        (window as any).__refreshSavedFilters?.();
        onFilterSaved?.();
        setOpen(false);
      } else {
        const err = await res.json();
        alert(err.error || 'שגיאה בשמירה');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Filter trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition ${
          conditionCount > 0
            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Filter className="w-4 h-4" />
        <span>פילטר</span>
        {conditionCount > 0 && (
          <span className="bg-emerald-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
            {conditionCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="
            fixed inset-x-2 top-auto mt-2 z-50
            sm:absolute sm:top-full sm:inset-x-auto sm:right-0 sm:left-auto sm:w-[480px] sm:max-w-[calc(100vw-1rem)]
            bg-white rounded-xl shadow-2xl border border-gray-200 p-3 sm:p-4
          "
          dir="rtl"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-bold text-gray-900">סינון רשומות</div>
            <div className="flex items-center gap-2">
              {tableId && workspaceId && conditionCount > 0 && (
                <button
                  onClick={handleSaveFilter}
                  disabled={saving}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1 disabled:opacity-50"
                >
                  <Save className="w-3 h-3" />
                  {saving ? 'שומר...' : 'שמור פילטר'}
                </button>
              )}
              {conditionCount > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  נקה הכל
                </button>
              )}
            </div>
          </div>

          {conditionCount === 0 ? (
            <div className="text-sm text-gray-500 text-center py-6">
              אין סינונים פעילים. לחץ "הוסף תנאי" כדי להתחיל.
            </div>
          ) : (
            <div className="space-y-2 mb-3">
              {filters.conditions.map((cond, idx) => (
                <ConditionRow
                  key={idx}
                  condition={cond}
                  fields={filterableFields}
                  isFirst={idx === 0}
                  onUpdate={(updates) => updateCondition(idx, updates)}
                  onRemove={() => removeCondition(idx)}
                />
              ))}
            </div>
          )}

          <button
            onClick={addCondition}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition text-gray-700"
          >
            <Plus className="w-4 h-4" />
            הוסף תנאי
          </button>
        </div>
      )}
    </div>
  );
}

function ConditionRow({
  condition, fields, isFirst, onUpdate, onRemove,
}: {
  condition: FilterCondition;
  fields: Field[];
  isFirst: boolean;
  onUpdate: (updates: Partial<FilterCondition>) => void;
  onRemove: () => void;
}) {
  const field = fields.find((f) => f.slug === condition.field_slug) || fields[0];
  const operators = getOperatorsForType(field.type);
  const needsValue = !NO_VALUE_OPERATORS.has(condition.operator);
  const needsArray = ARRAY_VALUE_OPERATORS.has(condition.operator);

  return (
    <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg p-2 flex-wrap">
      <span className="text-xs font-bold text-gray-500 w-8 text-center shrink-0 hidden sm:inline">
        {isFirst ? 'איפה' : 'וגם'}
      </span>

      {/* Field selector */}
      <select
        value={condition.field_slug}
        onChange={(e) => {
          const newField = fields.find((f) => f.slug === e.target.value)!;
          const newOps = getOperatorsForType(newField.type);
          onUpdate({ field_slug: e.target.value, operator: newOps[0], value: '' });
        }}
        className="text-xs px-2 py-1 rounded border border-gray-200 bg-white max-w-[120px]"
      >
        {fields.map((f) => (
          <option key={f.slug} value={f.slug}>{f.name}</option>
        ))}
      </select>

      {/* Operator selector */}
      <select
        value={condition.operator}
        onChange={(e) => onUpdate({ operator: e.target.value as FilterOperator, value: '' })}
        className="text-xs px-2 py-1 rounded border border-gray-200 bg-white max-w-[110px]"
      >
        {operators.map((op) => (
          <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
        ))}
      </select>

      {/* Value input - varies by field type and operator */}
      {needsValue && (
        <ValueInput
          field={field}
          operator={condition.operator}
          value={condition.value}
          isArray={needsArray}
          onChange={(v) => onUpdate({ value: v })}
        />
      )}

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="text-gray-400 hover:text-red-600 transition shrink-0"
        title="הסר תנאי"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function ValueInput({
  field, operator, value, isArray, onChange,
}: {
  field: Field;
  operator: FilterOperator;
  value: any;
  isArray: boolean;
  onChange: (v: any) => void;
}) {
  // ===== Select / status / multiselect / relation: show options =====
  if (['select', 'status', 'multiselect'].includes(field.type)) {
    const options = field.config?.options || [];
    if (isArray) {
      return (
        <MultiSelectChips
          options={options}
          selected={Array.isArray(value) ? value : []}
          onChange={onChange}
        />
      );
    }
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs px-2 py-1 rounded border border-gray-200 bg-white flex-1 min-w-[100px]"
      >
        <option value="">בחר...</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }

  // ===== Date / datetime =====
  if (['date', 'datetime'].includes(field.type)) {
    if (operator === 'date_between') {
      const arr = Array.isArray(value) ? value : ['', ''];
      return (
        <div className="flex items-center gap-1 flex-1">
          <input
            type="date"
            value={arr[0] || ''}
            onChange={(e) => onChange([e.target.value, arr[1] || ''])}
            className="text-xs px-2 py-1 rounded border border-gray-200 bg-white flex-1 min-w-0"
          />
          <span className="text-xs text-gray-500">-</span>
          <input
            type="date"
            value={arr[1] || ''}
            onChange={(e) => onChange([arr[0] || '', e.target.value])}
            className="text-xs px-2 py-1 rounded border border-gray-200 bg-white flex-1 min-w-0"
          />
        </div>
      );
    }
    if (operator === 'is_in_next_days' || operator === 'is_in_last_days') {
      return (
        <input
          type="number"
          min="1"
          value={value || 7}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder="ימים"
          className="text-xs px-2 py-1 rounded border border-gray-200 bg-white w-20"
        />
      );
    }
    return (
      <input
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs px-2 py-1 rounded border border-gray-200 bg-white flex-1 min-w-0"
      />
    );
  }

  // ===== Number / currency =====
  if (['number', 'currency', 'rating'].includes(field.type)) {
    if (operator === 'between') {
      const arr = Array.isArray(value) ? value : ['', ''];
      return (
        <div className="flex items-center gap-1 flex-1">
          <input
            type="number"
            value={arr[0] || ''}
            onChange={(e) => onChange([e.target.value, arr[1] || ''])}
            placeholder="מ-"
            className="text-xs px-2 py-1 rounded border border-gray-200 bg-white w-20"
          />
          <input
            type="number"
            value={arr[1] || ''}
            onChange={(e) => onChange([arr[0] || '', e.target.value])}
            placeholder="עד-"
            className="text-xs px-2 py-1 rounded border border-gray-200 bg-white w-20"
          />
        </div>
      );
    }
    return (
      <input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ערך..."
        className="text-xs px-2 py-1 rounded border border-gray-200 bg-white flex-1 min-w-0"
      />
    );
  }

  // ===== Default: text input =====
  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="ערך..."
      className="text-xs px-2 py-1 rounded border border-gray-200 bg-white flex-1 min-w-0"
    />
  );
}

function MultiSelectChips({
  options, selected, onChange,
}: {
  options: { label: string; value: string; color?: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (v: string) => {
    if (selected.includes(v)) {
      onChange(selected.filter((s) => s !== v));
    } else {
      onChange([...selected, v]);
    }
  };

  const selectedLabels = options
    .filter((o) => selected.includes(o.value))
    .map((o) => o.label);

  return (
    <div className="relative flex-1 min-w-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-xs px-2 py-1 rounded border border-gray-200 bg-white text-right truncate flex items-center justify-between gap-1"
      >
        <span className="truncate">
          {selectedLabels.length === 0
            ? 'בחר...'
            : selectedLabels.length === 1
            ? selectedLabels[0]
            : `${selectedLabels.length} ערכים`}
        </span>
        <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 right-0 z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-1 min-w-[160px] max-h-48 overflow-y-auto">
          {options.map((o) => (
            <label
              key={o.value}
              className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer text-xs"
            >
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={() => toggle(o.value)}
                className="rounded"
              />
              {o.color && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: o.color }}
                />
              )}
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
