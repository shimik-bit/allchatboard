'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Field } from '@/lib/types/database';
import { Link2, X, Search } from 'lucide-react';

interface RelationOption {
  id: string;
  display_name: string;
  data: Record<string, any>;
}

export default function RelationCell({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: Field;
  value: string | null;
  onChange: (newId: string | null) => void | Promise<void>;
  readOnly?: boolean;
}) {
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [options, setOptions] = useState<RelationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentRecord, setCurrentRecord] = useState<RelationOption | null>(null);
  const [targetFields, setTargetFields] = useState<Field[]>([]);

  const relationTableId = field.config?.relation_table_id;
  const displayColumns: string[] =
    (field.config?.display_columns as string[]) ||
    (field.config?.display_field ? [field.config.display_field] : []);

  // Load fields of target table for proper formatting
  useEffect(() => {
    if (!relationTableId) return;
    supabase
      .from('fields')
      .select('id, name, slug, type, config')
      .eq('table_id', relationTableId)
      .then(({ data }) => setTargetFields((data as any) || []));
  }, [relationTableId, supabase]);

  // Load current value's data
  useEffect(() => {
    if (!value || !relationTableId) {
      setCurrentRecord(null);
      return;
    }
    supabase
      .rpc('list_records_for_dropdown_rich', { p_table_id: relationTableId })
      .then(({ data }) => {
        const match = (data || []).find((r: any) => r.id === value);
        if (match) {
          setCurrentRecord({
            id: match.id,
            display_name: match.display_name,
            data: match.data || {},
          });
        }
      });
  }, [value, relationTableId, supabase]);

  async function openPicker() {
    if (readOnly || !relationTableId) return;
    setEditing(true);
    if (options.length === 0) {
      setLoading(true);
      const { data } = await supabase.rpc('list_records_for_dropdown_rich', {
        p_table_id: relationTableId,
      });
      setOptions(
        (data || []).map((r: any) => ({
          id: r.id,
          display_name: r.display_name,
          data: r.data || {},
        }))
      );
      setLoading(false);
    }
  }

  async function handleSelect(id: string | null) {
    setEditing(false);
    await onChange(id);
    if (id) {
      const opt = options.find((o) => o.id === id);
      if (opt) setCurrentRecord(opt);
    } else {
      setCurrentRecord(null);
    }
  }

  if (!relationTableId) {
    return <span className="text-red-400 text-xs">שדה קישור לא מוגדר</span>;
  }

  function formatColumn(slug: string, data: Record<string, any>): string {
    const f = targetFields.find((tf) => tf.slug === slug);
    const raw = data?.[slug];
    if (raw === null || raw === undefined || raw === '') return '';

    if (f?.type === 'select' || f?.type === 'status') {
      const opt = ((f.config as any)?.options || []).find((o: any) => o.value === raw);
      return opt?.label || String(raw);
    }
    if (f?.type === 'currency' && typeof raw === 'number') {
      return `₪${raw.toLocaleString()}`;
    }
    if (Array.isArray(raw)) return raw.join(', ');
    return String(raw);
  }

  const filtered = searchQuery
    ? options.filter((o) => {
        const q = searchQuery.toLowerCase();
        return (
          o.display_name.toLowerCase().includes(q) ||
          displayColumns.some((slug) =>
            String(o.data?.[slug] || '').toLowerCase().includes(q)
          )
        );
      })
    : options;

  if (editing) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-fade-in"
        onClick={() => setEditing(false)}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-brand-600" />
            <h3 className="font-semibold">{field.name}</h3>
            <button
              onClick={() => setEditing(false)}
              className="mr-auto p-1.5 rounded-lg hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-3 border-b border-gray-200">
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חיפוש..."
                className="input-field text-sm pr-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="text-center py-8 text-gray-500 text-sm">טוען...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                {searchQuery ? 'לא נמצאו תוצאות' : 'אין רשומות בטבלה'}
              </div>
            ) : (
              <>
                {value && (
                  <button
                    onClick={() => handleSelect(null)}
                    className="w-full text-right px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 mb-1"
                  >
                    × הסר קישור
                  </button>
                )}
                {filtered.map((opt) => {
                  const cols = displayColumns
                    .map((slug) => formatColumn(slug, opt.data))
                    .filter(Boolean);
                  const display = cols.length > 0 ? cols : [opt.display_name];
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleSelect(opt.id)}
                      className={`w-full text-right px-3 py-2 rounded-lg text-sm hover:bg-brand-50 ${
                        opt.id === value ? 'bg-brand-100 font-medium' : ''
                      }`}
                    >
                      <div className="font-medium">{display[0]}</div>
                      {display.length > 1 && (
                        <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                          {display.slice(1).map((v, i) => (
                            <span key={i}>{v}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Display mode - show up to 3 columns
  const displayValues = currentRecord
    ? displayColumns
        .map((slug) => formatColumn(slug, currentRecord.data))
        .filter(Boolean)
    : [];

  if (!value || displayValues.length === 0) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); openPicker(); }}
        disabled={readOnly}
        className="text-xs text-gray-400 hover:text-brand-600"
      >
        {readOnly ? '—' : '+ קשר רשומה'}
      </button>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); openPicker(); }}
      disabled={readOnly}
      className="inline-flex flex-col items-start gap-0.5 text-right max-w-full disabled:cursor-default"
    >
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 hover:bg-brand-200 transition-colors max-w-full">
        <Link2 className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">{displayValues[0]}</span>
      </span>
      {displayValues.length > 1 && (
        <span className="text-[11px] text-gray-500 leading-tight px-1 flex items-center gap-1.5 flex-wrap">
          {displayValues.slice(1).map((v, i) => (
            <span key={i} className="truncate">{v}</span>
          ))}
        </span>
      )}
    </button>
  );
}
