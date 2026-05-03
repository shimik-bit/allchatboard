'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Database, Type, Hash, Calendar, ToggleLeft, Phone, Mail, Link, Star, Paperclip, AlignLeft, CheckSquare, MapPin, Palette, ChevronDown, ChevronUp, Sigma } from 'lucide-react';
import { ColorRulesPanel } from './ColorRulesEditor';
import type { ColorRule } from '@/lib/grid/color-rules';
import { evalFormula, extractReferences, FORMULA_TEMPLATES } from '@/lib/grid/formula';

const FIELD_TYPES = [
  { value: 'text', label: 'טקסט קצר', icon: Type },
  { value: 'longtext', label: 'טקסט ארוך', icon: AlignLeft },
  { value: 'number', label: 'מספר', icon: Hash },
  { value: 'currency', label: 'מטבע', icon: Hash },
  { value: 'formula', label: 'ƒ שדה מחושב', icon: Sigma },
  { value: 'date', label: 'תאריך', icon: Calendar },
  { value: 'datetime', label: 'תאריך ושעה', icon: Calendar },
  { value: 'select', label: 'בחירה', icon: ToggleLeft },
  { value: 'multiselect', label: 'בחירה מרובה', icon: CheckSquare },
  { value: 'status', label: 'סטטוס', icon: ToggleLeft },
  { value: 'checkbox', label: 'תיבת סימון', icon: CheckSquare },
  { value: 'phone', label: 'טלפון', icon: Phone },
  { value: 'email', label: 'אימייל', icon: Mail },
  { value: 'url', label: 'קישור URL', icon: Link },
  { value: 'city', label: '🇮🇱 עיר בישראל', icon: MapPin },
  { value: 'rating', label: 'דירוג', icon: Star },
  { value: 'attachment', label: 'קובץ מצורף', icon: Paperclip },
  { value: 'relation', label: '🔗 קישור לטבלה אחרת', icon: Database },
];

type SelectOption = { value: string; label: string; color?: string };

type Table = { id: string; name: string; icon: string | null };

type Field = { id: string; name: string; slug: string; type: string; is_primary: boolean };

export default function AddFieldModal({
  tableId,
  workspaceId,
  onClose,
  onAdded,
}: {
  tableId: string;
  workspaceId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<string>('text');
  const [aiHint, setAiHint] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For select/status types
  const [options, setOptions] = useState<SelectOption[]>([
    { value: 'option1', label: 'אפשרות 1' },
  ]);

  // For relation types
  const [allTables, setAllTables] = useState<Table[]>([]);
  const [relationTableId, setRelationTableId] = useState<string>('');
  const [relationFields, setRelationFields] = useState<Field[]>([]);
  const [displayColumns, setDisplayColumns] = useState<string[]>([]);

  // Conditional formatting (color rules) — collapsed by default
  const [colorRules, setColorRules] = useState<ColorRule[]>([]);
  const [showColorRules, setShowColorRules] = useState<boolean>(false);

  // Formula field state — only used when type === 'formula'
  const [formula, setFormula] = useState<string>('');
  const [tableFields, setTableFields] = useState<Field[]>([]);

  // Load all fields in this table so the formula editor can show available
  // [field_slug] references.
  useEffect(() => {
    fetch(`/api/tables/${tableId}/fields`)
      .then((r) => r.json())
      .then((d) => setTableFields(d.fields || []))
      .catch(() => {});
  }, [tableId]);

  // Reset rules when field type changes — different operators apply
  useEffect(() => { setColorRules([]); }, [type]);

  // Field types where color rules don't make sense (chips/avatars/file links
  // already render their own visuals)
  const COLOR_RULE_TYPES = new Set([
    'text', 'longtext', 'number', 'currency', 'rating',
    'select', 'multiselect', 'status', 'checkbox',
    'date', 'datetime', 'phone', 'email', 'url',
    'formula', // computed values are very common targets for color rules
  ]);
  const supportsColorRules = COLOR_RULE_TYPES.has(type);

  // Load workspace tables for relation dropdown
  useEffect(() => {
    if (type === 'relation') {
      fetch(`/api/tables/list?workspace_id=${workspaceId}`)
        .then((r) => r.json())
        .then((d) => setAllTables((d.tables || []).filter((t: Table) => t.id !== tableId)))
        .catch(() => {});
    }
  }, [type, workspaceId, tableId]);

  // Load fields when relation target changes
  useEffect(() => {
    if (type === 'relation' && relationTableId) {
      fetch(`/api/tables/${relationTableId}/fields`)
        .then((r) => r.json())
        .then((d) => {
          const flds = d.fields || [];
          setRelationFields(flds);
          // Auto-select primary as first display column
          const primary = flds.find((f: Field) => f.is_primary);
          if (primary && displayColumns.length === 0) {
            setDisplayColumns([primary.slug]);
          }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationTableId, type]);

  function toggleDisplayColumn(slug: string) {
    if (displayColumns.includes(slug)) {
      setDisplayColumns(displayColumns.filter((s) => s !== slug));
    } else if (displayColumns.length < 3) {
      setDisplayColumns([...displayColumns, slug]);
    }
  }

  async function handleAdd() {
    setError(null);
    if (!name.trim()) {
      setError('שם השדה נדרש');
      return;
    }
    if (type === 'relation' && !relationTableId) {
      setError('יש לבחור טבלה לקישור');
      return;
    }
    if (type === 'relation' && displayColumns.length === 0) {
      setError('יש לבחור לפחות עמודה אחת לתצוגה');
      return;
    }

    setSaving(true);
    try {
      const config: any = {};
      if (['select', 'multiselect', 'status'].includes(type)) {
        config.options = options.filter((o) => o.label.trim());
      }
      if (type === 'relation') {
        config.relation_table_id = relationTableId;
        config.display_columns = displayColumns;
        // Backward compat
        config.display_field = displayColumns[0];
      }
      if (type === 'formula') {
        const trimmed = formula.trim();
        if (!trimmed) {
          setError('יש להזין נוסחה');
          setSaving(false);
          return;
        }
        // Quick parse-time validation — give the user the error before save
        const test = evalFormula(trimmed, {});
        if (test.error && test.error !== 'division_by_zero') {
          setError(`שגיאה בנוסחה: ${test.error}`);
          setSaving(false);
          return;
        }
        config.formula = trimmed;
      }
      // Persist any color rules the user defined while creating the field.
      if (supportsColorRules && colorRules.length > 0) {
        config.color_rules = colorRules;
      }

      const res = await fetch(`/api/tables/${tableId}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          config,
          ai_extraction_hint: aiHint.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'שגיאה בהוספת שדה');
        setSaving(false);
        return;
      }
      onAdded();
      onClose();
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  const needsOptions = ['select', 'multiselect', 'status'].includes(type);
  const isRelation = type === 'relation';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-black/50 animate-fade-in"
      onClick={(e) => {
        // Only close if the click landed on the backdrop itself, not bubbled
        // from a child. iOS Safari has been observed to bubble synthetic
        // clicks past stopPropagation for nested modal panels.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] md:max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center text-white">
              <Plus className="w-5 h-5" />
            </div>
            <h2 className="font-display font-bold text-lg">הוסף שדה חדש</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5">שם השדה *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="לדוגמה: מספר טלפון"
              className="input-field"
              autoFocus
            />
          </div>

          {/* Type picker */}
          <div>
            <label className="block text-sm font-medium mb-1.5">סוג שדה</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {FIELD_TYPES.map((ft) => {
                const Icon = ft.icon;
                return (
                  <button
                    key={ft.value}
                    onClick={() => setType(ft.value)}
                    className={`p-2.5 rounded-lg border-2 text-right text-xs flex items-center gap-2 transition-all ${
                      type === ft.value
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{ft.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Select/Status options */}
          {needsOptions && (
            <div>
              <label className="block text-sm font-medium mb-1.5">אפשרויות</label>
              <div className="space-y-1.5">
                {options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => {
                        const next = [...options];
                        next[i] = {
                          ...next[i],
                          label: e.target.value,
                          value: e.target.value.toLowerCase().replace(/\s+/g, '_'),
                        };
                        setOptions(next);
                      }}
                      className="input-field flex-1 text-sm"
                      placeholder="תווית"
                    />
                    <input
                      type="color"
                      value={opt.color || '#7C3AED'}
                      onChange={(e) => {
                        const next = [...options];
                        next[i] = { ...next[i], color: e.target.value };
                        setOptions(next);
                      }}
                      className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer"
                    />
                    <button
                      onClick={() => setOptions(options.filter((_, j) => j !== i))}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                      disabled={options.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setOptions([
                      ...options,
                      { value: `option${options.length + 1}`, label: '' },
                    ])
                  }
                  className="text-xs text-brand-600 hover:underline mt-1"
                >
                  + הוסף אפשרות
                </button>
              </div>
            </div>
          )}

          {/* Relation: target table + display columns */}
          {isRelation && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5">טבלת יעד *</label>
                <select
                  value={relationTableId}
                  onChange={(e) => {
                    setRelationTableId(e.target.value);
                    setDisplayColumns([]);
                  }}
                  className="input-field"
                >
                  <option value="">— בחר טבלה —</option>
                  {allTables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.icon || '📋'} {t.name}
                    </option>
                  ))}
                </select>
                {allTables.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    אין טבלאות נוספות בסביבת העבודה. צור קודם טבלת יעד.
                  </p>
                )}
              </div>

              {relationTableId && (
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    עמודות תצוגה (עד 3) *
                  </label>
                  <p className="text-xs text-gray-500 mb-2">
                    בחר אילו ערכים יוצגו בתא הזה (למשל: שם + טלפון + עיר)
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto p-2 rounded-lg border border-gray-200">
                    {relationFields
                      .filter((f) =>
                        ['text', 'longtext', 'phone', 'email', 'number', 'currency', 'select', 'status'].includes(f.type)
                      )
                      .map((f) => {
                        const isSelected = displayColumns.includes(f.slug);
                        const orderIdx = displayColumns.indexOf(f.slug);
                        const isMaxed = displayColumns.length >= 3 && !isSelected;
                        return (
                          <button
                            key={f.id}
                            onClick={() => toggleDisplayColumn(f.slug)}
                            disabled={isMaxed}
                            className={`w-full flex items-center justify-between p-2 rounded-md text-sm transition-colors ${
                              isSelected
                                ? 'bg-brand-100 text-brand-900'
                                : isMaxed
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              {isSelected && (
                                <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-[10px] grid place-items-center font-bold">
                                  {orderIdx + 1}
                                </span>
                              )}
                              {f.name}
                              {f.is_primary && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                  ראשי
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-gray-400">{f.type}</span>
                          </button>
                        );
                      })}
                  </div>
                  {displayColumns.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1.5">
                      תוצג בתא: {displayColumns.map((slug) => relationFields.find((f) => f.slug === slug)?.name).join(' · ')}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Formula field editor */}
          {type === 'formula' && (
            <FormulaEditor
              value={formula}
              onChange={setFormula}
              tableFields={tableFields}
            />
          )}

          {/* Conditional formatting (color rules) — collapsible */}
          {supportsColorRules && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowColorRules((v) => !v);
                }}
                className="w-full flex items-center justify-between px-4 py-3 bg-amber-50/50 hover:bg-amber-50 text-right"
              >
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-gray-900">
                    צבע מותנה
                  </span>
                  {colorRules.length > 0 && (
                    <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold">
                      {colorRules.length}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">(אופציונלי)</span>
                </div>
                {showColorRules
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {showColorRules && (
                <div className="p-4 border-t border-gray-100 bg-white">
                  <ColorRulesPanel
                    rules={colorRules}
                    fieldType={type}
                    fieldOptions={
                      ['select', 'multiselect', 'status'].includes(type)
                        ? options.filter((o) => o.label.trim())
                        : undefined
                    }
                    onChange={setColorRules}
                  />
                </div>
              )}
            </div>
          )}

          {/* AI extraction hint */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              רמז ל-AI <span className="text-xs text-gray-500 font-normal">(אופציונלי)</span>
            </label>
            <input
              type="text"
              value={aiHint}
              onChange={(e) => setAiHint(e.target.value)}
              placeholder="לדוגמה: מספר טלפון נייד 10 ספרות"
              className="input-field text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              עוזר ל-AI לזהות את הערך מהודעות WhatsApp באופן מדויק יותר
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="text-xs text-red-600">{error}</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-sm">ביטול</button>
            <button onClick={handleAdd} disabled={saving} className="btn-primary text-sm">
              {saving ? 'מוסיף...' : 'הוסף שדה'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// FormulaEditor — inline editor used inside AddFieldModal when type=formula
// =============================================================================

function FormulaEditor({
  value, onChange, tableFields,
}: {
  value: string;
  onChange: (v: string) => void;
  tableFields: Field[];
}) {
  const [showHelp, setShowHelp] = useState<boolean>(false);

  // Live evaluate against a synthetic row built from each available field's
  // slug → "1" so the user sees the formula compile (or its error) immediately.
  // This catches typos before they save.
  const sampleRow: Record<string, unknown> = {};
  for (const f of tableFields) sampleRow[f.slug] = f.type === 'number' || f.type === 'currency' ? 10 : 'X';
  const result = evalFormula(value, sampleRow);
  const refs = extractReferences(value);
  const unknownRefs = refs.filter((r) => !tableFields.some((f) => f.slug === r));

  function insertRef(slug: string): void {
    onChange(value + (value && !value.endsWith(' ') ? ' ' : '') + `[${slug}]`);
  }

  function applyTemplate(formula: string): void {
    // Replace placeholder slugs with the first available field of the right type
    let f = formula;
    const numericField = tableFields.find((tf) => tf.type === 'number' || tf.type === 'currency');
    const textField = tableFields.find((tf) => tf.type === 'text' || tf.type === 'longtext');
    const dateField = tableFields.find((tf) => tf.type === 'date' || tf.type === 'datetime');
    if (numericField) {
      f = f.replace(/\[field_a\]/g, `[${numericField.slug}]`);
      f = f.replace(/\[field_b\]/g, `[${numericField.slug}]`);
      f = f.replace(/\[quantity\]/g, `[${numericField.slug}]`);
      f = f.replace(/\[unit_price\]/g, `[${numericField.slug}]`);
      f = f.replace(/\[part\]/g, `[${numericField.slug}]`);
      f = f.replace(/\[total\]/g, `[${numericField.slug}]`);
      f = f.replace(/\[amount\]/g, `[${numericField.slug}]`);
      f = f.replace(/\[area_sqm\]/g, `[${numericField.slug}]`);
    }
    if (textField) {
      f = f.replace(/\[first_name\]/g, `[${textField.slug}]`);
      f = f.replace(/\[last_name\]/g, `[${textField.slug}]`);
    }
    if (dateField) {
      f = f.replace(/\[created_at\]/g, `[${dateField.slug}]`);
    }
    onChange(f);
  }

  return (
    <div className="border border-purple-200 rounded-xl p-4 bg-purple-50/30 space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium">
          <Sigma className="w-4 h-4 inline-block ml-1 text-purple-600" />
          נוסחה
        </label>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); setShowHelp((v) => !v); }}
          className="text-xs text-purple-700 hover:underline"
        >
          {showHelp ? 'הסתר עזרה' : 'מה אפשר לעשות?'}
        </button>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder='לדוגמה: ROUND([area_sqm] * [price_per_sqm], 2)'
        rows={3}
        className="input-field text-sm font-mono"
        dir="ltr"
        style={{ direction: 'ltr', textAlign: 'left' }}
      />

      {/* Live preview / error */}
      <div className="flex items-center gap-2 text-xs">
        {result.error ? (
          <span className="text-red-600">⚠ {result.error}</span>
        ) : value ? (
          <>
            <span className="text-gray-500">תוצאה לדוגמה:</span>
            <span className="font-mono font-semibold text-purple-700">
              {result.value === null || result.value === undefined ? '—' :
               typeof result.value === 'boolean' ? (result.value ? 'TRUE' : 'FALSE') :
               String(result.value)}
            </span>
          </>
        ) : (
          <span className="text-gray-400">הזן נוסחה כדי לראות תוצאה</span>
        )}
      </div>

      {unknownRefs.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          ⚠ שדות לא מזוהים: {unknownRefs.map((r) => `[${r}]`).join(', ')}
        </div>
      )}

      {/* Available fields to insert */}
      {tableFields.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-1.5">שדות זמינים (לחץ להוספה):</div>
          <div className="flex flex-wrap gap-1.5">
            {tableFields
              .filter((f) => f.type !== 'attachment' && (f.type as string) !== 'formula')
              .map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); insertRef(f.slug); }}
                  className="px-2 py-1 text-xs bg-white border border-gray-200 hover:border-purple-400 hover:bg-purple-50 rounded font-mono"
                  dir="ltr"
                >
                  [{f.slug}]
                </button>
              ))}
          </div>
        </div>
      )}

      {showHelp && (
        <div className="text-xs space-y-2 bg-white border border-gray-200 rounded-lg p-3">
          <div>
            <div className="font-semibold text-gray-700 mb-1">תבניות מהירות:</div>
            <div className="space-y-1">
              {FORMULA_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); applyTemplate(tpl.formula); }}
                  className="w-full text-right p-2 hover:bg-purple-50 rounded text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-purple-700">{tpl.label}</span>
                    <span className="text-gray-400 text-[10px]">{tpl.description}</span>
                  </div>
                  <div className="font-mono text-[11px] text-gray-500 mt-0.5" dir="ltr">{tpl.formula}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-gray-100 pt-2">
            <div className="font-semibold text-gray-700 mb-1">פונקציות זמינות:</div>
            <div className="text-[11px] text-gray-600 leading-relaxed">
              <code>IF</code>, <code>CONCAT</code>, <code>DATEDIFF</code>, <code>ROUND</code>,
              {' '}<code>SUM</code>, <code>AVG</code>, <code>MIN</code>, <code>MAX</code>,
              {' '}<code>LEN</code>, <code>UPPER</code>, <code>LOWER</code>,
              {' '}<code>ABS</code>, <code>FLOOR</code>, <code>CEIL</code>,
              {' '}<code>NOW</code>, <code>TODAY</code>, <code>AND</code>, <code>OR</code>, <code>NOT</code>
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              אופרטורים: <code>+ - * /</code>, השוואות: <code>{'>'} {'<'} {'>='} {'<='} = !=</code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
