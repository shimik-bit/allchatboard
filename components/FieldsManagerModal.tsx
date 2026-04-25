'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Pencil, Check, AlertTriangle, GripVertical, Database } from 'lucide-react';
import { useDevMode } from '@/lib/hooks/useDevMode';
import AddFieldModal from './AddFieldModal';

type Field = {
  id: string;
  name: string;
  slug: string;
  type: string;
  is_required: boolean;
  is_primary: boolean;
  position: number;
  ai_extraction_hint: string | null;
};

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'טקסט',
  longtext: 'טקסט ארוך',
  number: 'מספר',
  currency: 'מטבע',
  date: 'תאריך',
  datetime: 'תאריך ושעה',
  select: 'בחירה',
  multiselect: 'בחירה מרובה',
  status: 'סטטוס',
  checkbox: 'תיבת סימון',
  phone: 'טלפון',
  email: 'אימייל',
  url: 'URL',
  city: '🇮🇱 עיר',
  rating: 'דירוג',
  attachment: 'קובץ',
  relation: '🔗 קישור',
  user: 'משתמש',
};

export default function FieldsManagerModal({
  tableId,
  tableName,
  workspaceId,
  onClose,
  onChange,
}: {
  tableId: string;
  tableName: string;
  workspaceId: string;
  onClose: () => void;
  onChange?: () => void;
}) {
  const { enabled: devMode } = useDevMode();
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  function loadFields() {
    setLoading(true);
    fetch(`/api/tables/${tableId}/fields`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setFields(d.fields || []);
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e?.message || e));
        setLoading(false);
      });
  }

  useEffect(() => { loadFields(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tableId]);

  async function handleRename(field: Field) {
    if (!editingName.trim() || editingName === field.name) {
      setEditingId(null);
      return;
    }
    setSavingId(field.id);
    try {
      const res = await fetch(`/api/tables/${tableId}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field_id: field.id, name: editingName.trim() }),
      });
      const j = await res.json();
      if (!res.ok) {
        alert('שגיאה: ' + (j.error || 'לא ידוע'));
      } else {
        setFields(fields.map((f) => (f.id === field.id ? { ...f, name: editingName.trim() } : f)));
        onChange?.();
      }
    } catch (e: any) {
      alert('שגיאת רשת: ' + e.message);
    } finally {
      setSavingId(null);
      setEditingId(null);
    }
  }

  async function handleDelete(field: Field) {
    if (!devMode) return;
    if (field.is_primary) {
      alert('לא ניתן למחוק שדה ראשי');
      return;
    }
    const confirmText = `מחיקת השדה "${field.name}" תמחק את כל הנתונים בעמודה הזו לצמיתות.\n\nכדי לאשר, הקלד את שם השדה:`;
    const userInput = prompt(confirmText);
    if (userInput !== field.name) {
      if (userInput !== null) alert('הטקסט לא תואם — המחיקה בוטלה');
      return;
    }

    setSavingId(field.id);
    try {
      const res = await fetch(`/api/tables/${tableId}/fields?field_id=${field.id}`, {
        method: 'DELETE',
      });
      const j = await res.json();
      if (!res.ok) {
        alert('שגיאה: ' + (j.error || 'לא ידוע'));
      } else {
        setFields(fields.filter((f) => f.id !== field.id));
        onChange?.();
      }
    } catch (e: any) {
      alert('שגיאת רשת: ' + e.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center text-white">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg">ניהול שדות</h2>
              <p className="text-xs text-gray-500">{tableName} · {fields.length} שדות</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && <div className="text-center py-8 text-gray-400 text-sm">טוען שדות...</div>}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
              שגיאה: {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {!devMode && (
                <div className="mb-3 p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-[11px] text-gray-600 flex items-center gap-2">
                  <span>🔒</span>
                  מחיקת שדות זמינה רק במצב מפתח (כפתור בסיידבר למטה)
                </div>
              )}

              <div className="space-y-1.5">
                {fields.map((field) => {
                  const isEditing = editingId === field.id;
                  return (
                    <div
                      key={field.id}
                      className="flex items-center gap-2 p-3 rounded-lg border border-gray-100 hover:border-gray-200 bg-white"
                    >
                      <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />

                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              autoFocus
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename(field);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              className="input-field text-sm flex-1"
                            />
                            <button
                              onClick={() => handleRename(field)}
                              disabled={savingId === field.id}
                              className="p-1.5 rounded text-green-600 hover:bg-green-50"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 rounded text-gray-400 hover:bg-gray-50"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="font-medium text-sm flex items-center gap-2">
                              {field.name}
                              {field.is_primary && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                                  ראשי
                                </span>
                              )}
                              {field.is_required && (
                                <span className="text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded">
                                  חובה
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              {FIELD_TYPE_LABELS[field.type] || field.type}
                              <span className="opacity-50"> · </span>
                              <span dir="ltr" className="font-mono">{field.slug}</span>
                            </div>
                          </>
                        )}
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingId(field.id);
                              setEditingName(field.name);
                            }}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                            title="שנה שם"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {devMode && !field.is_primary && (
                            <button
                              onClick={() => handleDelete(field)}
                              disabled={savingId === field.id}
                              className="p-1.5 rounded hover:bg-red-50 text-red-500"
                              title="מחק שדה"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setShowAdd(true)}
                className="w-full mt-3 p-3 rounded-lg border-2 border-dashed border-gray-200 hover:border-brand-400 text-sm text-gray-500 hover:text-brand-600 flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                הוסף שדה חדש
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex justify-end">
          <button onClick={onClose} className="btn-secondary text-sm">סגור</button>
        </div>
      </div>

      {showAdd && (
        <AddFieldModal
          tableId={tableId}
          workspaceId={workspaceId}
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            loadFields();
            onChange?.();
          }}
        />
      )}
    </div>
  );
}
