'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Table, Field, RecordRow } from '@/lib/types/database';
import { X, Trash2, MessageSquare, Link2, ChevronDown, ChevronLeft, FileText, Download, Paperclip, ArrowRightLeft } from 'lucide-react';
import RelationCell from '@/components/RelationCell';
import CityAutocomplete from '@/components/CityAutocomplete';

export default function RecordModal({
  table,
  fields,
  record,
  canEdit,
  onClose,
  onSave,
  onDelete,
  onMove,
}: {
  table: Table;
  fields: Field[];
  record: RecordRow | null;
  canEdit: boolean;
  onClose: () => void;
  onSave: (data: Record<string, any>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onMove?: (record: RecordRow) => void;
}) {
  const [formData, setFormData] = useState<Record<string, any>>(record?.data || {});
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setFormData(record?.data || {});
    setErrors({});
  }, [record]);

  // Close on ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const updateField = (slug: string, value: any) => {
    setFormData((prev) => ({ ...prev, [slug]: value }));
    if (errors[slug]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    for (const f of fields) {
      if (f.is_required) {
        const v = formData[f.slug];
        if (v === null || v === undefined || v === '' ||
            (Array.isArray(v) && v.length === 0)) {
          newErrors[f.slug] = 'שדה חובה';
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!record || !onDelete) return;
    setSaving(true);
    try {
      await onDelete(record.id);
    } finally {
      setSaving(false);
    }
  };

  const isNew = !record;
  const sourceLabel = record?.source === 'whatsapp'
    ? 'נוצר מוואטסאפ'
    : record?.source === 'manual'
    ? 'נוצר ידנית'
    : record?.source === 'import'
    ? 'יובא'
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/40 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] md:max-h-[90vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-gray-200">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <div
              className="w-8 h-8 md:w-9 md:h-9 rounded-lg grid place-items-center text-lg md:text-xl shrink-0"
              style={{ background: `${table.color}20` }}
            >
              {table.icon}
            </div>
            <div>
              <h2 className="font-display font-bold text-lg">
                {isNew ? `רשומה חדשה ב-${table.name}` : 'עריכת רשומה'}
              </h2>
              {sourceLabel && !isNew && (
                <div className="text-xs text-gray-500 flex items-center gap-1.5">
                  {record?.source === 'whatsapp' && <MessageSquare className="w-3 h-3" />}
                  {sourceLabel}
                  {record?.ai_confidence != null && (
                    <span className="text-brand-600">
                      · AI {Math.round(record.ai_confidence * 100)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 md:py-5 space-y-4">
          {/* Attachment preview — shown when the record was created from a
              WhatsApp image/document. Gives the user instant visual context
              and a link to the original file. */}
          {!isNew && record?.attachment_url && (
            <AttachmentPreview
              url={record.attachment_url}
              type={record.attachment_type || null}
            />
          )}

          {fields.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              לא הוגדרו שדות עבור הטבלה הזו
            </div>
          ) : (
            <FieldsArea
              fields={fields}
              formData={formData}
              errors={errors}
              canEdit={canEdit}
              saving={saving}
              updateField={updateField}
              isNew={isNew}
            />
          )}

          {/* Related records - only for existing records */}
          {!isNew && record && (
            <RelatedRecordsSection recordId={record.id} />
          )}
        </div>

        {/* Footer - sticky bottom action bar with mobile-friendly shadow */}
        <div className="flex items-center justify-between gap-2 px-4 md:px-6 py-3 md:py-4 border-t border-gray-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.06)] md:shadow-none md:bg-gray-50/50">
          <div className="flex items-center gap-1">
            {!isNew && onDelete && canEdit && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden md:inline">מחיקה</span>
              </button>
            )}
            {!isNew && onMove && canEdit && record && (
              <button
                onClick={() => onMove(record)}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-50"
                title="העבר לטבלה אחרת"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span className="hidden md:inline">העבר ל...</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-1 md:flex-initial justify-end">
            <button
              onClick={onClose}
              className="btn-secondary text-sm px-4 py-2.5 md:py-2"
              disabled={saving}
            >
              ביטול
            </button>
            {canEdit && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary text-sm px-5 py-2.5 md:py-2 flex-1 md:flex-initial font-semibold"
              >
                {saving ? 'שומר...' : isNew ? 'צור רשומה' : 'שמירה'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldsArea({
  fields, formData, errors, canEdit, saving, updateField, isNew,
}: {
  fields: Field[];
  formData: Record<string, any>;
  errors: Record<string, string>;
  canEdit: boolean;
  saving: boolean;
  updateField: (slug: string, value: any) => void;
  isNew: boolean;
}) {
  // Sort fields: primary first → required → has-value → empty
  const sorted = [...fields].sort((a, b) => {
    const score = (f: Field) => {
      if (f.is_primary) return 0;
      if (f.is_required) return 1;
      const v = formData[f.slug];
      if (v !== null && v !== undefined && v !== '') return 2;
      return 3;
    };
    return score(a) - score(b);
  });

  // Determine which fields are "primary" (always visible) vs "additional" (collapsible)
  // For NEW records: only show required + primary visible by default; rest collapsed.
  // For EXISTING records: show everything (people are usually editing one specific thing).
  const primaryFields = sorted.filter(
    (f) => f.is_primary || f.is_required
  );
  const additionalFields = sorted.filter(
    (f) => !f.is_primary && !f.is_required
  );

  // Show all if no required/primary, or if editing existing record
  const useCollapsible = isNew && additionalFields.length > 2 && primaryFields.length > 0;
  const fieldsToShowAlways = useCollapsible ? primaryFields : sorted;
  const fieldsCollapsed = useCollapsible ? additionalFields : [];

  const [showMore, setShowMore] = useState(!useCollapsible);

  return (
    <>
      {fieldsToShowAlways.map((f) => (
        <FieldInput
          key={f.id}
          field={f}
          value={formData[f.slug]}
          onChange={(v) => updateField(f.slug, v)}
          error={errors[f.slug]}
          disabled={!canEdit || saving}
        />
      ))}

      {fieldsCollapsed.length > 0 && (
        <>
          {!showMore ? (
            <button
              type="button"
              onClick={() => setShowMore(true)}
              className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-600 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50/30 transition-all flex items-center justify-center gap-2"
            >
              <ChevronDown className="w-4 h-4" />
              הצג {fieldsCollapsed.length} שדות נוספים
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs text-gray-500 font-medium pt-2">
                <div className="flex-1 h-px bg-gray-200" />
                שדות נוספים
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              {fieldsCollapsed.map((f) => (
                <FieldInput
                  key={f.id}
                  field={f}
                  value={formData[f.slug]}
                  onChange={(v) => updateField(f.slug, v)}
                  error={errors[f.slug]}
                  disabled={!canEdit || saving}
                />
              ))}
            </>
          )}
        </>
      )}
    </>
  );
}

function FieldInput({
  field, value, onChange, error, disabled,
}: {
  field: Field;
  value: any;
  onChange: (v: any) => void;
  error?: string;
  disabled?: boolean;
}) {
  const baseLabel = (
    <label className="block text-sm font-medium text-gray-700 mb-1.5">
      {field.name}
      {field.is_required && <span className="text-red-500 mr-1">*</span>}
    </label>
  );

  const errorMsg = error && (
    <div className="text-xs text-red-600 mt-1">{error}</div>
  );

  const baseInputCls =
    `input-field ${error ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : ''}`;

  // Relation field gets the picker
  if (field.type === 'relation') {
    return (
      <div>
        {baseLabel}
        <div className="input-field flex items-center justify-between min-h-[40px]">
          <RelationCell
            field={field}
            value={value || null}
            onChange={(newId) => onChange(newId)}
            readOnly={disabled}
          />
        </div>
        {errorMsg}
      </div>
    );
  }

  switch (field.type) {
    case 'city':
      return (
        <div>
          {baseLabel}
          <CityAutocomplete
            value={value ?? ''}
            onChange={(v) => onChange(v)}
            disabled={disabled}
            placeholder="התחל להקליד שם עיר..."
          />
          {errorMsg}
        </div>
      );

    case 'text':
    case 'phone':
    case 'email':
    case 'url':
      return (
        <div>
          {baseLabel}
          <input
            type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'phone' ? 'tel' : 'text'}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            dir={field.type === 'phone' || field.type === 'email' || field.type === 'url' ? 'ltr' : 'rtl'}
            className={baseInputCls}
          />
          {errorMsg}
        </div>
      );

    case 'longtext':
      return (
        <div>
          {baseLabel}
          <textarea
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            rows={3}
            className={baseInputCls}
          />
          {errorMsg}
        </div>
      );

    case 'number':
    case 'currency':
      return (
        <div>
          {baseLabel}
          <div className="relative">
            <input
              type="number"
              value={value ?? ''}
              onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
              disabled={disabled}
              min={field.config?.min}
              max={field.config?.max}
              step={field.type === 'currency' ? '0.01' : 'any'}
              className={baseInputCls + (field.type === 'currency' ? ' pl-8' : '')}
            />
            {field.type === 'currency' && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                {field.config?.currency || '₪'}
              </span>
            )}
          </div>
          {errorMsg}
        </div>
      );

    case 'date':
      return (
        <div>
          {baseLabel}
          <input
            type="date"
            value={value ? String(value).slice(0, 10) : ''}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={disabled}
            className={baseInputCls}
          />
          {errorMsg}
        </div>
      );

    case 'datetime':
      return (
        <div>
          {baseLabel}
          <input
            type="datetime-local"
            value={value ? String(value).slice(0, 16) : ''}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={disabled}
            className={baseInputCls}
          />
          {errorMsg}
        </div>
      );

    case 'checkbox':
      return (
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              disabled={disabled}
              className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm font-medium text-gray-700">
              {field.name}
              {field.is_required && <span className="text-red-500 mr-1">*</span>}
            </span>
          </label>
          {errorMsg}
        </div>
      );

    case 'select':
    case 'status':
      return (
        <div>
          {baseLabel}
          <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={disabled}
            className={baseInputCls}
          >
            <option value="">— בחרו —</option>
            {field.config?.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {errorMsg}
        </div>
      );

    case 'multiselect': {
      const current: string[] = Array.isArray(value) ? value : [];
      return (
        <div>
          {baseLabel}
          <div className="flex flex-wrap gap-1.5">
            {field.config?.options?.map((o) => {
              const selected = current.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(
                      selected
                        ? current.filter((v) => v !== o.value)
                        : [...current, o.value]
                    );
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selected
                      ? 'bg-brand-100 border-brand-300 text-brand-700'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          {errorMsg}
        </div>
      );
    }

    case 'rating': {
      const max = field.config?.max || 5;
      return (
        <div>
          {baseLabel}
          <div className="flex items-center gap-1">
            {Array.from({ length: max }).map((_, i) => {
              const n = i + 1;
              return (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(value === n ? null : n)}
                  className="text-2xl transition-transform hover:scale-110 disabled:opacity-50"
                >
                  {n <= (Number(value) || 0) ? '⭐' : '☆'}
                </button>
              );
            })}
          </div>
          {errorMsg}
        </div>
      );
    }

    default:
      return (
        <div>
          {baseLabel}
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={baseInputCls}
          />
          {errorMsg}
        </div>
      );
  }
}

// ============================================================================
// RELATED RECORDS - shows which records from OTHER tables point to this one
// via relation fields. Groups by table, expandable, click to navigate.
// ============================================================================

interface ReferencingRecord {
  referencing_record_id: string;
  referencing_table_id: string;
  referencing_table_name: string;
  referencing_table_icon: string;
  field_slug: string;
  field_name: string;
  display_summary: string;
  created_at: string;
}

function RelatedRecordsSection({ recordId }: { recordId: string }) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReferencingRecord[]>([]);
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .rpc('find_records_referencing', { p_target_record_id: recordId })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('find_records_referencing error:', error);
          setRows([]);
        } else {
          setRows((data as ReferencingRecord[]) || []);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [recordId]);

  // Group by referencing_table_id
  const byTable = new Map<string, {
    tableId: string;
    tableName: string;
    tableIcon: string;
    items: ReferencingRecord[];
  }>();
  for (const row of rows) {
    const key = row.referencing_table_id;
    if (!byTable.has(key)) {
      byTable.set(key, {
        tableId: row.referencing_table_id,
        tableName: row.referencing_table_name,
        tableIcon: row.referencing_table_icon || '📋',
        items: [],
      });
    }
    byTable.get(key)!.items.push(row);
  }

  if (loading) {
    return (
      <div className="mt-6 pt-5 border-t border-gray-200">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link2 className="w-4 h-4" />
          <span>טוען רשומות קשורות...</span>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return null; // Nothing references this record - don't clutter the UI
  }

  const toggleTable = (tableId: string) => {
    setExpandedTables((prev) => ({ ...prev, [tableId]: !prev[tableId] }));
  };

  const navigateToRecord = (tableId: string, recordId: string) => {
    // Open in new tab so user doesn't lose modal context
    window.open(`/dashboard/${tableId}?recordId=${recordId}`, '_blank');
  };

  return (
    <div className="mt-6 pt-5 border-t border-gray-200">
      <div className="flex items-center gap-2 mb-3">
        <Link2 className="w-4 h-4 text-brand-600" />
        <h3 className="text-sm font-semibold text-gray-700">
          רשומות קשורות
          <span className="text-gray-400 font-normal mr-1.5">({rows.length})</span>
        </h3>
      </div>

      <div className="space-y-2">
        {Array.from(byTable.values()).map((group) => {
          // Default: expanded if <=3 items, collapsed otherwise
          const isExpanded = expandedTables[group.tableId] ?? (group.items.length <= 3);
          return (
            <div
              key={group.tableId}
              className="border border-gray-200 rounded-lg overflow-hidden bg-white"
            >
              <button
                type="button"
                onClick={() => toggleTable(group.tableId)}
                className="w-full flex items-center gap-2 px-3 py-2 text-right hover:bg-gray-50 transition-colors"
              >
                <span className="text-base">{group.tableIcon}</span>
                <span className="text-sm font-medium text-gray-700">{group.tableName}</span>
                <span className="text-xs text-gray-400">({group.items.length})</span>
                <span className="mr-auto text-gray-400">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronLeft className="w-4 h-4" />
                  )}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 divide-y divide-gray-100">
                  {group.items.map((item) => (
                    <button
                      key={item.referencing_record_id}
                      type="button"
                      onClick={() =>
                        navigateToRecord(item.referencing_table_id, item.referencing_record_id)
                      }
                      className="w-full px-3 py-2 text-right hover:bg-brand-50 transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-900 truncate">
                            {item.display_summary || '—'}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            דרך שדה: {item.field_name}
                          </div>
                        </div>
                        <ChevronLeft className="w-4 h-4 text-gray-300 group-hover:text-brand-600 flex-shrink-0 mt-0.5" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── AttachmentPreview ──────────────────────────────────────────────────────
/**
 * Renders the file attached to a record. When it's an image we show it
 * inline (users want to verify an invoice/damage photo at a glance).
 * For PDFs and other documents we show a compact "file card" with a
 * download link — most browsers handle PDF viewing from the opened tab.
 */
function AttachmentPreview({ url, type }: { url: string; type: string | null }) {
  const isImage = type?.startsWith('image/');
  const isPdf = type === 'application/pdf';

  // Short filename for the card — last path segment
  const filename = (() => {
    try {
      const last = url.split('/').pop() || '';
      return decodeURIComponent(last).split('?')[0];
    } catch { return 'attachment'; }
  })();

  if (isImage) {
    return (
      <div className="mb-4">
        <div className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
          <Paperclip className="w-3 h-3" />
          קובץ מצורף
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg overflow-hidden border border-gray-200 hover:border-brand-400 transition-colors"
          title="לחץ לפתיחה במסך מלא"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="קובץ מצורף"
            className="w-full max-h-80 object-contain bg-gray-50"
            loading="lazy"
          />
        </a>
      </div>
    );
  }

  // Non-image file — show a card with icon + download link
  return (
    <div className="mb-4">
      <div className="text-xs font-medium text-gray-500 mb-1.5 flex items-center gap-1">
        <Paperclip className="w-3 h-3" />
        קובץ מצורף
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-colors"
      >
        <div className={`w-10 h-10 rounded-lg grid place-items-center shrink-0 ${
          isPdf ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-600'
        }`}>
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-900 truncate" dir="ltr">
            {filename}
          </div>
          <div className="text-xs text-gray-500">
            {isPdf ? 'מסמך PDF' : (type || 'קובץ')}
          </div>
        </div>
        <Download className="w-4 h-4 text-gray-400 shrink-0" />
      </a>
    </div>
  );
}
