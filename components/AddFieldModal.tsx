'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Database, Type, Hash, Calendar, ToggleLeft, Phone, Mail, Link, Star, Paperclip, AlignLeft, CheckSquare } from 'lucide-react';

const FIELD_TYPES = [
  { value: 'text', label: 'טקסט קצר', icon: Type },
  { value: 'longtext', label: 'טקסט ארוך', icon: AlignLeft },
  { value: 'number', label: 'מספר', icon: Hash },
  { value: 'currency', label: 'מטבע', icon: Hash },
  { value: 'date', label: 'תאריך', icon: Calendar },
  { value: 'datetime', label: 'תאריך ושעה', icon: Calendar },
  { value: 'select', label: 'בחירה', icon: ToggleLeft },
  { value: 'multiselect', label: 'בחירה מרובה', icon: CheckSquare },
  { value: 'status', label: 'סטטוס', icon: ToggleLeft },
  { value: 'checkbox', label: 'תיבת סימון', icon: CheckSquare },
  { value: 'phone', label: 'טלפון', icon: Phone },
  { value: 'email', label: 'אימייל', icon: Mail },
  { value: 'url', label: 'קישור URL', icon: Link },
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
      onClick={onClose}
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
