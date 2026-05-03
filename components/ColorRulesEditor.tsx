'use client';

import { useState } from 'react';
import { X, Plus, Trash2, Palette, GripVertical, ChevronDown } from 'lucide-react';
import {
  type ColorRule,
  type ColorRuleOperator,
  COLOR_SWATCHES,
  operatorNeedsSecondValue,
  operatorNeedsNoValue,
  operatorsForFieldType,
  evalColorRules,
} from '@/lib/grid/color-rules';

const OPERATOR_LABELS_HE: Record<ColorRuleOperator, string> = {
  gt: 'גדול מ',
  gte: 'גדול או שווה ל',
  lt: 'קטן מ',
  lte: 'קטן או שווה ל',
  eq: 'שווה ל',
  neq: 'לא שווה ל',
  between: 'בין',
  contains: 'מכיל',
  not_contains: 'לא מכיל',
  starts_with: 'מתחיל ב',
  ends_with: 'מסתיים ב',
  is_empty: 'ריק',
  is_not_empty: 'לא ריק',
  is_true: 'מסומן',
  is_false: 'לא מסומן',
};

interface FieldShape {
  id: string;
  name: string;
  slug: string;
  type: string;
  config: { color_rules?: ColorRule[]; options?: { value: string; label: string }[] } & Record<string, unknown>;
}

export default function ColorRulesEditor({
  field,
  tableId,
  onClose,
  onSaved,
}: {
  field: FieldShape;
  tableId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rules, setRules] = useState<ColorRule[]>(() => field.config?.color_rules || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const operators = operatorsForFieldType(field.type);

  function addRule(): void {
    const swatch = COLOR_SWATCHES[rules.length % COLOR_SWATCHES.length];
    const op: ColorRuleOperator = operators[0] || 'eq';
    setRules((prev: ColorRule[]) => [
      ...prev,
      {
        operator: op,
        value: operatorNeedsNoValue(op) ? null : '',
        bg: swatch.bg,
        text: swatch.text,
      },
    ]);
  }

  function updateRule(idx: number, patch: Partial<ColorRule>): void {
    setRules((prev: ColorRule[]) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function removeRule(idx: number): void {
    setRules((prev: ColorRule[]) => prev.filter((_, i) => i !== idx));
  }

  function moveRule(idx: number, dir: -1 | 1): void {
    setRules((prev: ColorRule[]) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tables/${tableId}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          field_id: field.id,
          // Merge existing config so we don't clobber options/min/max/etc.
          config: { ...(field.config || {}), color_rules: rules },
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl bg-white sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-amber-600" />
            <div>
              <div className="text-sm font-semibold text-gray-900">צבע מותנה</div>
              <div className="text-xs text-gray-500">שדה: {field.name}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg"
            aria-label="סגור"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {rules.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">
              אין כללי צבע. לחץ "הוסף כלל" כדי להתחיל.
              <div className="text-xs text-gray-400 mt-1">
                הכלל הראשון שמתאים לערך התא קובע את הצבע.
              </div>
            </div>
          ) : (
            rules.map((rule: ColorRule, idx: number) => (
              <RuleRow
                key={idx}
                rule={rule}
                idx={idx}
                fieldType={field.type}
                operators={operators}
                fieldOptions={field.config?.options}
                isFirst={idx === 0}
                isLast={idx === rules.length - 1}
                onChange={(patch: Partial<ColorRule>) => updateRule(idx, patch)}
                onRemove={() => removeRule(idx)}
                onMoveUp={() => moveRule(idx, -1)}
                onMoveDown={() => moveRule(idx, 1)}
              />
            ))
          )}

          <button
            type="button"
            onClick={addRule}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-dashed border-amber-300 rounded-xl"
          >
            <Plus className="w-4 h-4" />
            הוסף כלל
          </button>

          {/* Live preview */}
          {rules.length > 0 && <PreviewSection rules={rules} fieldType={field.type} />}

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="text-xs text-gray-500">
            הכללים נבדקים מלמעלה למטה — הראשון שמתאים מנצח.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              בטל
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="px-4 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50"
            >
              {saving ? 'שומר…' : 'שמור'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Single rule row ----------------------------------------------------

function RuleRow({
  rule, idx, fieldType, operators, fieldOptions, isFirst, isLast,
  onChange, onRemove, onMoveUp, onMoveDown,
}: {
  rule: ColorRule;
  idx: number;
  fieldType: string;
  operators: ColorRuleOperator[];
  fieldOptions?: { value: string; label: string }[];
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<ColorRule>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const showVal = !operatorNeedsNoValue(rule.operator);
  const showVal2 = operatorNeedsSecondValue(rule.operator);

  // For select/status fields, value input becomes a dropdown of the field options
  const isOptionField = fieldType === 'select' || fieldType === 'status' || fieldType === 'multiselect';

  return (
    <div className="border border-gray-200 rounded-xl p-3 space-y-2 bg-white">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-400 w-5">{idx + 1}.</span>
        <span className="text-xs text-gray-500">אם הערך</span>

        <select
          value={rule.operator}
          onChange={(e) => {
            const newOp = e.target.value as ColorRuleOperator;
            onChange({
              operator: newOp,
              value: operatorNeedsNoValue(newOp) ? null : (rule.value ?? ''),
              value2: operatorNeedsSecondValue(newOp) ? (rule.value2 ?? '') : undefined,
            });
          }}
          className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
        >
          {operators.map((op: ColorRuleOperator) => (
            <option key={op} value={op}>{OPERATOR_LABELS_HE[op]}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
          aria-label="מחק"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {showVal && (
        <div className="flex items-center gap-2">
          {isOptionField && fieldOptions && fieldOptions.length > 0 ? (
            <select
              value={(rule.value as string) ?? ''}
              onChange={(e) => onChange({ value: e.target.value })}
              className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1.5"
            >
              <option value="">בחר ערך…</option>
              {fieldOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <input
              type={fieldType === 'number' || fieldType === 'currency' || fieldType === 'rating' ? 'number' : 'text'}
              value={(rule.value as string | number) ?? ''}
              onChange={(e) => onChange({ value: e.target.value })}
              placeholder="ערך"
              className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1.5"
            />
          )}

          {showVal2 && (
            <>
              <span className="text-xs text-gray-400">עד</span>
              <input
                type="number"
                value={(rule.value2 as string | number) ?? ''}
                onChange={(e) => onChange({ value2: e.target.value })}
                placeholder="ערך"
                className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1.5"
              />
            </>
          )}
        </div>
      )}

      {/* Color picker row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">צבע:</span>
        {COLOR_SWATCHES.map((swatch) => {
          const selected = rule.bg === swatch.bg;
          return (
            <button
              key={swatch.name}
              type="button"
              onClick={() => onChange({ bg: swatch.bg, text: swatch.text })}
              className={`w-7 h-7 rounded-md border-2 transition-all ${
                selected ? 'border-gray-900 scale-110' : 'border-transparent hover:border-gray-300'
              }`}
              style={{ background: swatch.bg }}
              aria-label={swatch.name}
              title={swatch.name}
            />
          );
        })}

        {/* Reorder controls */}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="העלה"
          >
            <ChevronDown className="w-4 h-4 rotate-180" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="הורד"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Live preview --------------------------------------------------------

function PreviewSection({ rules, fieldType }: { rules: ColorRule[]; fieldType: string }) {
  // Generate a few sample values that exercise the rules
  const samples: (string | number | null | boolean)[] = (() => {
    if (fieldType === 'number' || fieldType === 'currency' || fieldType === 'rating') {
      return [0, 10, 25, 50, 100, null];
    }
    if (fieldType === 'checkbox') return [true, false];
    return ['ערך לדוגמה', '', 'ערך אחר'];
  })();

  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
      <div className="text-xs font-semibold text-gray-700 mb-2">תצוגה מקדימה</div>
      <div className="flex items-center gap-2 flex-wrap">
        {samples.map((sample, i) => {
          const style = evalColorRules(rules, sample);
          return (
            <div
              key={i}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200"
              style={{
                backgroundColor: style.backgroundColor || '#fff',
                color: style.color || '#374151',
              }}
            >
              {sample === null ? '—' : sample === true ? '✓' : sample === false ? '✗' : String(sample)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
