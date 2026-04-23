'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Field } from '@/lib/types/database';
import { Link2, X, ExternalLink, Search } from 'lucide-react';

interface RelationOption {
  id: string;
  display_name: string;
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
  const [currentLabel, setCurrentLabel] = useState<string>('');

  const relationTableId = field.config?.relation_table_id;

  // Load the current value's display name
  useEffect(() => {
    if (!value || !relationTableId) {
      setCurrentLabel('');
      return;
    }
    supabase.rpc('list_records_for_dropdown', { p_table_id: relationTableId })
      .then(({ data }) => {
        const match = (data || []).find((r: any) => r.id === value);
        setCurrentLabel(match?.display_name || '...');
      });
  }, [value, relationTableId]);

  async function openPicker() {
    if (readOnly || !relationTableId) return;
    setEditing(true);
    if (options.length === 0) {
      setLoading(true);
      const { data } = await supabase.rpc('list_records_for_dropdown', { p_table_id: relationTableId });
      setOptions((data || []).map((r: any) => ({ id: r.id, display_name: r.display_name })));
      setLoading(false);
    }
  }

  async function handleSelect(id: string | null) {
    setEditing(false);
    await onChange(id);
    // update label
    if (id) {
      const opt = options.find((o) => o.id === id);
      if (opt) setCurrentLabel(opt.display_name);
    } else {
      setCurrentLabel('');
    }
  }

  if (!relationTableId) {
    return <span className="text-red-400 text-xs">שדה קישור לא מוגדר</span>;
  }

  const filtered = searchQuery
    ? options.filter((o) =>
        o.display_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
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
                {filtered.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleSelect(opt.id)}
                    className={`w-full text-right px-3 py-2 rounded-lg text-sm hover:bg-brand-50 ${
                      opt.id === value ? 'bg-brand-100 font-medium' : ''
                    }`}
                  >
                    {opt.display_name}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Display mode
  return (
    <button
      onClick={(e) => { e.stopPropagation(); openPicker(); }}
      disabled={readOnly}
      className="inline-flex items-center gap-1 text-right"
    >
      {value && currentLabel ? (
        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 hover:bg-brand-200 transition-colors">
          <Link2 className="w-3 h-3" />
          {currentLabel}
        </span>
      ) : (
        <span className="text-xs text-gray-400 hover:text-brand-600">+ קשר רשומה</span>
      )}
    </button>
  );
}
