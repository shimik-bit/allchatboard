'use client';

import { useState, useEffect, useMemo } from 'react';
import { X, ArrowLeft, AlertCircle, Check, ArrowRight } from 'lucide-react';
import { suggestFieldMapping, type FieldMin, type FieldMapping } from '@/lib/automations/field-mapping';

type Table = { id: string; name: string; icon: string | null };
type RecordRow = { id: string; data: Record<string, any> };

export default function MoveRecordModal({
  record, sourceTable, sourceFields, allTables, onClose, onMoved,
}: {
  record: RecordRow;
  sourceTable: { id: string; name: string };
  sourceFields: FieldMin[];
  allTables: Table[];
  onClose: () => void;
  onMoved: (newRecordId: string, newTableId: string) => void;
}) {
  const [step, setStep] = useState<'pick_table' | 'mapping'>('pick_table');
  const [targetTableId, setTargetTableId] = useState<string | null>(null);
  const [targetFields, setTargetFields] = useState<FieldMin[]>([]);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [sourceAction, setSourceAction] = useState<'keep' | 'mark_converted' | 'archive' | 'delete'>('mark_converted');
  const [createLink, setCreateLink] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Filter out source table from options
  const targetOptions = useMemo(
    () => allTables.filter((t) => t.id !== sourceTable.id),
    [allTables, sourceTable.id]
  );

  // Load target fields when table is picked
  useEffect(() => {
    if (!targetTableId) return;
    setLoading(true);
    fetch(`/api/tables/${targetTableId}/fields`)
      .then((r) => r.json())
      .then((d) => {
        const fields: FieldMin[] = d.fields || [];
        setTargetFields(fields);
        setMapping(suggestFieldMapping(sourceFields, fields));
        setLoading(false);
      })
      .catch((err) => {
        setError('שגיאה בטעינת שדות הטבלה');
        setLoading(false);
      });
  }, [targetTableId, sourceFields]);

  function pickTable(id: string) {
    setTargetTableId(id);
    setStep('mapping');
    setError(null);
  }

  function updateMapping(sourceSlug: string, targetSlug: string | null) {
    setMapping({ ...mapping, [sourceSlug]: targetSlug });
  }

  async function handleMove() {
    if (!targetTableId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/records/${record.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_table_id: targetTableId,
          field_mapping: mapping,
          source_action: sourceAction,
          create_link: createLink,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'העברה נכשלה');
        setSaving(false);
        return;
      }
      onMoved(json.new_record_id, json.new_table_id);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  const selectedTargetTable = targetOptions.find((t) => t.id === targetTableId);
  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const totalSourceFields = sourceFields.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50">
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step === 'mapping' && (
              <button
                onClick={() => setStep('pick_table')}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="font-display font-bold text-lg flex items-center gap-2">
                🔄 העבר ל...
              </h2>
              <p className="text-xs text-gray-500">
                {step === 'pick_table' ? 'בחר את טבלת היעד' : `העברה ל-${selectedTargetTable?.name}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Pick target table */}
          {step === 'pick_table' && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 mb-3">
                לאיזו טבלה להעביר את הרשומה?
              </p>
              {targetOptions.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  אין טבלאות אחרות בסביבת העבודה
                </div>
              ) : (
                targetOptions.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => pickTable(t.id)}
                    className="w-full text-right p-3 rounded-xl border-2 border-gray-200 hover:border-brand-400 hover:bg-brand-50/30 transition-all flex items-center gap-3 group"
                  >
                    <div className="text-2xl">{t.icon || '📋'}</div>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{t.name}</div>
                    </div>
                    <ArrowLeft className="w-4 h-4 text-gray-400 group-hover:text-brand-600 transition-colors" />
                  </button>
                ))
              )}
            </div>
          )}

          {/* Step 2: Field mapping + source action */}
          {step === 'mapping' && (
            <div className="space-y-5">
              {loading ? (
                <div className="py-8 text-center text-sm text-gray-400">טוען שדות...</div>
              ) : (
                <>
                  {/* Field mapping */}
                  <div>
                    <label className="block text-sm font-semibold mb-1">מיפוי שדות</label>
                    <p className="text-xs text-gray-500 mb-3">
                      איך השדות מ-{sourceTable.name} עוברים ל-{selectedTargetTable?.name}? ({mappedCount}/{totalSourceFields} מופים)
                    </p>
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {sourceFields.map((sf) => {
                        const value = record.data?.[sf.slug];
                        const hasValue = value !== undefined && value !== null && value !== '';
                        return (
                          <div
                            key={sf.slug}
                            className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center p-2 rounded-lg bg-gray-50 border border-gray-100"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate">{sf.name}</div>
                              <div className="text-[10px] text-gray-500 truncate" dir={typeof value === 'string' && /[a-z0-9]/i.test(value) ? 'ltr' : 'rtl'}>
                                {hasValue ? String(value).slice(0, 30) : <span className="text-gray-400 italic">ריק</span>}
                              </div>
                            </div>
                            <ArrowLeft className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <select
                              value={mapping[sf.slug] || ''}
                              onChange={(e) => updateMapping(sf.slug, e.target.value || null)}
                              className="text-xs px-2 py-1.5 rounded-md border border-gray-200 bg-white min-w-0"
                            >
                              <option value="">— לא להעתיק —</option>
                              {targetFields.map((tf) => (
                                <option key={tf.slug} value={tf.slug}>
                                  {tf.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Source action */}
                  <div>
                    <label className="block text-sm font-semibold mb-2">מה לעשות עם הרשומה הישנה?</label>
                    <div className="space-y-2">
                      {[
                        { value: 'mark_converted', icon: '🔗', title: 'סמן כ"הומר" + שמור קישור', desc: 'מומלץ - הרשומה נשארת אבל מסומנת שעברה ליעד' },
                        { value: 'keep', icon: '📌', title: 'השאר כפי שהיא', desc: 'הרשומה הישנה ממשיכה להיות פעילה' },
                        { value: 'archive', icon: '🗄️', title: 'העבר לארכיון', desc: 'מסתיר מתצוגה רגילה אבל לא מוחק' },
                        { value: 'delete', icon: '🗑️', title: 'מחק לצמיתות', desc: 'הרשומה נעלמת לחלוטין', danger: true },
                      ].map((opt) => (
                        <label
                          key={opt.value}
                          className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            sourceAction === opt.value
                              ? opt.danger ? 'border-red-400 bg-red-50' : 'border-brand-400 bg-brand-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            checked={sourceAction === opt.value}
                            onChange={() => setSourceAction(opt.value as any)}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-semibold flex items-center gap-1.5">
                              <span>{opt.icon}</span>
                              <span>{opt.title}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Create link toggle */}
                  {sourceAction !== 'delete' && (
                    <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                      <input
                        type="checkbox"
                        checked={createLink}
                        onChange={(e) => setCreateLink(e.target.checked)}
                        className="w-4 h-4 rounded text-brand-600"
                      />
                      <span className="text-xs text-blue-900">
                        🔗 שמור קישור הדדי בין הרשומות (מומלץ)
                      </span>
                    </label>
                  )}

                  {error && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-800 flex gap-2 items-start">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {error}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {step === 'mapping' && (
          <div className="px-6 py-4 border-t flex justify-between bg-gray-50/50">
            <button onClick={onClose} className="btn-secondary text-sm" disabled={saving}>
              ביטול
            </button>
            <button
              onClick={handleMove}
              disabled={saving || mappedCount === 0}
              className="btn-primary text-sm"
            >
              {saving ? 'מעביר...' : (
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  העבר רשומה
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
