'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Upload, FileSpreadsheet, X, Loader2, Check, AlertCircle,
  ArrowLeft, Sparkles, Download,
} from 'lucide-react';
import type { Field } from '@/lib/types/database';

type Step = 'upload' | 'mapping' | 'success';

interface AnalyzeResponse {
  import_id: string;
  headers: string[];
  sample_rows: any[][];
  total_rows: number;
  detected_bank: string | null;
  proposed_mapping: Record<string, string | null>;
  confidence: number;
  needs_manual_review: boolean;
}

interface ExecuteResponse {
  import_id: string;
  rows_imported: number;
  rows_skipped: number;
  rows_failed: number;
  duplicate_rows: number;
  sample_inserted: any[];
}

const BANK_LABELS: Record<string, string> = {
  leumi: 'בנק לאומי',
  hapoalim: 'בנק הפועלים',
  discount: 'בנק דיסקונט',
  mizrahi: 'מזרחי טפחות',
  fibi: 'הבינלאומי',
  yahav: 'בנק יהב',
  mercantile: 'מרכנתיל',
  one_zero: 'One Zero',
  pepper: 'פפר',
  esh: 'אש ישראל',
};

/**
 * ExcelImportWizard - Modal for importing data from .xlsx/.csv files.
 *
 * Flow:
 *   1. User drops/picks a file
 *   2. We POST it to /api/excel-import/analyze → AI proposes column mapping
 *   3. User reviews/edits the mapping in a side-by-side table
 *   4. User clicks "Import" → POST to /api/excel-import/execute → rows inserted
 *   5. Success screen with stats (X imported, Y duplicates skipped, ...)
 *
 * Used in tables that benefit from bulk import — primarily bank_transactions
 * but also expenses/income_invoices for historical data.
 */
export default function ExcelImportWizard({
  workspaceId,
  tableId,
  fields,
  onClose,
  onImported,
}: {
  workspaceId: string;
  tableId: string;
  fields: Field[];
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzeData, setAnalyzeData] = useState<AnalyzeResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [executeData, setExecuteData] = useState<ExecuteResponse | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (selectedFile: File) => {
      setError(null);
      const allowedExt = /\.(xlsx|xls|csv)$/i;
      if (!allowedExt.test(selectedFile.name)) {
        setError('קובץ לא נתמך. יש להעלות .xlsx, .xls או .csv');
        return;
      }
      const maxBytes = 10 * 1024 * 1024;
      if (selectedFile.size > maxBytes) {
        setError('הקובץ גדול מדי (מקסימום 10MB)');
        return;
      }

      setFile(selectedFile);
      setIsLoading(true);

      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('workspace_id', workspaceId);
        formData.append('table_id', tableId);

        const res = await fetch('/api/excel-import/analyze', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'נכשלה הניתוח של הקובץ');
          setFile(null);
          return;
        }

        setAnalyzeData(data);
        setMapping(data.proposed_mapping);
        setStep('mapping');
      } catch (e: any) {
        setError(e?.message || 'שגיאה בהעלאת הקובץ');
        setFile(null);
      } finally {
        setIsLoading(false);
      }
    },
    [workspaceId, tableId]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleExecute = async () => {
    if (!file || !analyzeData) return;
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('import_id', analyzeData.import_id);
      formData.append('mapping', JSON.stringify(mapping));
      formData.append('skip_duplicates', skipDuplicates ? 'true' : 'false');

      const res = await fetch('/api/excel-import/execute', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'נכשל היבוא');
        return;
      }

      setExecuteData(data);
      setStep('success');
    } catch (e: any) {
      setError(e?.message || 'שגיאה ביבוא');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = () => {
    onImported();
    onClose();
  };

  const mappedCount = Object.values(mapping).filter((v) => v !== null).length;
  const totalCount = analyzeData ? Object.keys(mapping).length : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">יבוא נתונים מאקסל</h2>
              <p className="text-xs text-gray-500">
                {step === 'upload' && 'העלה קובץ Excel או CSV'}
                {step === 'mapping' && 'ה-AI זיהה את המבנה - אשר או ערוך את השיוכים'}
                {step === 'success' && 'יבוא הושלם בהצלחה'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            aria-label="סגור"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-300 hover:border-emerald-400 hover:bg-gray-50'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-12 h-12 mx-auto text-emerald-500 animate-spin mb-3" />
                    <p className="text-base font-medium text-gray-900">מנתח את הקובץ...</p>
                    <p className="text-sm text-gray-500 mt-1">
                      ה-AI מזהה את המבנה ומציע שיוכים
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-base font-medium text-gray-900">
                      גרור קובץ לכאן או לחץ לבחירה
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      .xlsx, .xls, .csv • עד 10MB
                    </p>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 font-medium text-blue-900 mb-1">
                    <Sparkles className="w-4 h-4" />
                    זיהוי אוטומטי
                  </div>
                  <p className="text-blue-700 text-xs">
                    ה-AI מזהה את הבנק (לאומי, הפועלים, מזרחי...) ואת מבנה העמודות
                  </p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg">
                  <div className="flex items-center gap-2 font-medium text-emerald-900 mb-1">
                    <Check className="w-4 h-4" />
                    מניעת כפילויות
                  </div>
                  <p className="text-emerald-700 text-xs">
                    תנועות שכבר קיימות (לפי סכום + תאריך + תיאור) ידולגו
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Mapping */}
          {step === 'mapping' && analyzeData && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600">
                    נמצאו <strong>{analyzeData.total_rows}</strong> שורות נתונים
                    {analyzeData.detected_bank && (
                      <>
                        {' '}
                        · בנק זוהה: <strong>{BANK_LABELS[analyzeData.detected_bank] || analyzeData.detected_bank}</strong>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {mappedCount} מתוך {totalCount} עמודות שויכו
                    {analyzeData.confidence >= 0.8 ? (
                      <span className="text-emerald-600 mr-1">· זיהוי בביטחון גבוה ✓</span>
                    ) : (
                      <span className="text-amber-600 mr-1">
                        · מומלץ לעבור על השיוכים
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-700">
                        עמודת מקור (Excel)
                      </th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-700">
                        דוגמאות
                      </th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-700">
                        ←
                      </th>
                      <th className="text-right px-4 py-2.5 font-medium text-gray-700">
                        שדה במערכת
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyzeData.headers.map((header, idx) => {
                      const samples = analyzeData.sample_rows
                        .map((r) => String(r[idx] ?? ''))
                        .filter((v) => v)
                        .slice(0, 2);
                      const target = mapping[header];
                      return (
                        <tr key={`${header}-${idx}`} className="border-t border-gray-100">
                          <td className="px-4 py-2 font-medium text-gray-900">
                            {header || <span className="text-gray-400">(ריק)</span>}
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-500 truncate max-w-xs">
                            {samples.join(' · ') || '—'}
                          </td>
                          <td className="px-4 py-2 text-gray-300">→</td>
                          <td className="px-4 py-2">
                            <select
                              value={target || ''}
                              onChange={(e) =>
                                setMapping((m) => ({
                                  ...m,
                                  [header]: e.target.value || null,
                                }))
                              }
                              className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            >
                              <option value="">— דלג על עמודה זו —</option>
                              {fields.map((f) => (
                                <option key={f.id} value={f.slug}>
                                  {f.name}
                                  {f.is_required ? ' *' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-gray-700">
                  דלג על שורות שכבר קיימות (לפי סכום + תאריך + תיאור)
                </span>
              </label>
            </div>
          )}

          {/* STEP 3: Success */}
          {step === 'success' && executeData && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <Check className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">
                היבוא הושלם בהצלחה
              </h3>
              <p className="text-gray-500 text-sm mb-6">
                {executeData.rows_imported} רשומות נוספו לטבלה
              </p>

              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto text-sm">
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <div className="text-2xl font-bold text-emerald-700">
                    {executeData.rows_imported}
                  </div>
                  <div className="text-emerald-600 text-xs mt-1">נוספו</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-700">
                    {executeData.duplicate_rows}
                  </div>
                  <div className="text-blue-600 text-xs mt-1">כפולים (דולגו)</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-700">
                    {executeData.rows_failed}
                  </div>
                  <div className="text-gray-600 text-xs mt-1">נכשלו</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50 rounded-b-2xl">
          {step === 'mapping' ? (
            <>
              <button
                onClick={() => {
                  setStep('upload');
                  setFile(null);
                  setAnalyzeData(null);
                  setMapping({});
                }}
                className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                disabled={isLoading}
              >
                <ArrowLeft className="w-4 h-4" />
                העלה קובץ אחר
              </button>
              <button
                onClick={handleExecute}
                disabled={isLoading || mappedCount === 0}
                className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    מייבא...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    ייבא {analyzeData?.total_rows} שורות
                  </>
                )}
              </button>
            </>
          ) : step === 'success' ? (
            <button
              onClick={handleFinish}
              className="ms-auto px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition"
            >
              סגור
            </button>
          ) : (
            <button
              onClick={onClose}
              className="ms-auto text-sm text-gray-600 hover:text-gray-900"
            >
              ביטול
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
