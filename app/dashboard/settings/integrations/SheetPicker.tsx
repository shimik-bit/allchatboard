'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  FilePlus,
  FileText,
  Link2,
  Loader2,
  Search,
  X,
} from 'lucide-react';

type Spreadsheet = {
  id: string;
  name: string;
  url: string;
  modifiedAt: string;
};

type SheetTab = {
  sheetId: number;
  title: string;
};

type ExistingConfig = {
  id: string;
  spreadsheet_id: string;
  spreadsheet_name: string | null;
  spreadsheet_url: string | null;
  sheet_tab_name: string;
};

type Props = {
  eventTypeKey: string;
  eventTypeLabel: string;
  existingConfig: ExistingConfig | null;
  onClose: () => void;
  onSaved: () => void;
};

type Mode = 'pick' | 'create' | 'url';

export default function SheetPicker({
  eventTypeKey,
  eventTypeLabel,
  existingConfig,
  onClose,
  onSaved,
}: Props) {
  const [mode, setMode] = useState<Mode>('pick');

  // pick-mode state
  const [recentSheets, setRecentSheets] = useState<Spreadsheet[]>([]);
  const [isLoadingRecents, setIsLoadingRecents] = useState(true);
  const [searchQ, setSearchQ] = useState('');

  // url-mode state
  const [urlInput, setUrlInput] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // create-mode state
  const [newName, setNewName] = useState(`TaskFlow - ${eventTypeLabel}`);
  const [isCreating, setIsCreating] = useState(false);

  // common state
  const [selectedSheet, setSelectedSheet] = useState<Spreadsheet | null>(null);
  const [availableTabs, setAvailableTabs] = useState<SheetTab[]>([]);
  const [selectedTabName, setSelectedTabName] = useState<string>('Sheet1');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load recent sheets on mount (pick mode is default)
  useEffect(() => {
    let cancelled = false;
    fetch('/api/integrations/google/sheets/list')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setRecentSheets(data.spreadsheets ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setRecentSheets([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRecents(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // When a sheet is selected, fetch its tabs
  useEffect(() => {
    if (!selectedSheet) {
      setAvailableTabs([]);
      return;
    }
    let cancelled = false;
    fetch('/api/integrations/google/sheets/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spreadsheetId: selectedSheet.id }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.tabs && Array.isArray(data.tabs)) {
          setAvailableTabs(data.tabs);
          // Default to first tab, or the previously-configured one
          const preferred =
            existingConfig?.spreadsheet_id === selectedSheet.id
              ? existingConfig.sheet_tab_name
              : data.tabs[0]?.title ?? 'Sheet1';
          setSelectedTabName(preferred);
        }
      })
      .catch(() => {
        if (!cancelled) setAvailableTabs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSheet, existingConfig]);

  // --- URL paste handler ---
  const handleResolveUrl = async () => {
    setIsResolving(true);
    setResolveError(null);
    try {
      const res = await fetch('/api/integrations/google/sheets/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResolveError(
          data.message ??
            (data.error === 'invalid_url'
              ? 'הקישור לא תקין. ודא שזה קישור לגיליון Google Sheets.'
              : data.error === 'inaccessible'
                ? 'אין גישה לגיליון הזה. עם ההרשאות שלנו נוכל לראות רק גיליונות שיצרנו או שניתנה לנו גישה אליהם.'
                : 'שגיאה: ' + (data.error ?? 'unknown')),
        );
        return;
      }
      setSelectedSheet(data.spreadsheet);
      setAvailableTabs(data.tabs ?? []);
      setSelectedTabName(data.tabs?.[0]?.title ?? 'Sheet1');
    } catch (err: any) {
      setResolveError('שגיאת רשת. נסו שוב.');
    } finally {
      setIsResolving(false);
    }
  };

  // --- Create new sheet ---
  const handleCreateNew = async () => {
    if (!newName.trim()) return;
    setIsCreating(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/integrations/google/sheets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError('יצירת הגיליון נכשלה: ' + (data.error ?? 'unknown'));
        return;
      }
      setSelectedSheet(data);
      setAvailableTabs([{ sheetId: 0, title: 'Sheet1' }]);
      setSelectedTabName('Sheet1');
    } catch {
      setSaveError('שגיאת רשת בעת יצירת הגיליון.');
    } finally {
      setIsCreating(false);
    }
  };

  // --- Save sync config ---
  const handleSave = async () => {
    if (!selectedSheet) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/integrations/google/sync-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: eventTypeKey,
          spreadsheetId: selectedSheet.id,
          spreadsheetName: selectedSheet.name,
          spreadsheetUrl: selectedSheet.url,
          sheetTabName: selectedTabName,
          isEnabled: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError('שמירה נכשלה: ' + (data.error ?? 'unknown'));
        return;
      }
      onSaved();
    } catch {
      setSaveError('שגיאת רשת בעת שמירה.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredRecents = recentSheets.filter((s) =>
    searchQ ? s.name.toLowerCase().includes(searchQ.toLowerCase()) : true,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {existingConfig ? 'שינוי הגדרה' : 'הגדרת סנכרון'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{eventTypeLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="px-6 pt-4 flex gap-1 border-b border-gray-100">
          <ModeTab
            active={mode === 'pick'}
            onClick={() => {
              setMode('pick');
              setSelectedSheet(null);
            }}
            icon={<FileText className="w-3.5 h-3.5" />}
            label="בחר קיים"
          />
          <ModeTab
            active={mode === 'create'}
            onClick={() => {
              setMode('create');
              setSelectedSheet(null);
            }}
            icon={<FilePlus className="w-3.5 h-3.5" />}
            label="צור חדש"
          />
          <ModeTab
            active={mode === 'url'}
            onClick={() => {
              setMode('url');
              setSelectedSheet(null);
            }}
            icon={<Link2 className="w-3.5 h-3.5" />}
            label="הדבק קישור"
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {mode === 'pick' && (
            <div>
              <div className="relative mb-3">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="חיפוש לפי שם..."
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  className="w-full pr-10 pl-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                />
              </div>

              {isLoadingRecents ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  טוען גיליונות...
                </div>
              ) : filteredRecents.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p>אין גיליונות זמינים לתצוגה.</p>
                  <p className="text-xs mt-1">
                    עם הרשאות מוגבלות נראה רק גיליונות שיצרנו או שניתנה לנו גישה אליהם.
                    נסו ליצור חדש או להדביק קישור.
                  </p>
                </div>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {filteredRecents.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSheet(s)}
                      className={`w-full text-right p-3 rounded-lg border transition ${
                        selectedSheet?.id === s.id
                          ? 'bg-purple-50 border-purple-300'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {s.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            עודכן {new Date(s.modifiedAt).toLocaleDateString('he-IL')}
                          </div>
                        </div>
                        {selectedSheet?.id === s.id && (
                          <Check className="w-4 h-4 text-purple-600 shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'create' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                שם הגיליון החדש
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="לדוגמה: לידים מקבוצות וואטסאפ"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
              />
              <p className="text-xs text-gray-500 mt-2">
                הגיליון ייווצר ב-Google Drive שלכם ויהיה בבעלותכם המלאה.
              </p>

              {!selectedSheet && (
                <button
                  onClick={handleCreateNew}
                  disabled={isCreating || !newName.trim()}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      יוצר...
                    </>
                  ) : (
                    <>
                      <FilePlus className="w-4 h-4" />
                      צור גיליון
                    </>
                  )}
                </button>
              )}

              {selectedSheet && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <div className="flex-1 text-sm">
                    <div className="font-medium text-green-900">הגיליון נוצר</div>
                    <a
                      href={selectedSheet.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-green-700 hover:underline"
                    >
                      {selectedSheet.name} ↗
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === 'url' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                קישור לגיליון
              </label>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 ltr-input"
                dir="ltr"
              />

              <button
                onClick={handleResolveUrl}
                disabled={isResolving || !urlInput.trim()}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isResolving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    בודק...
                  </>
                ) : (
                  <>בדוק גישה</>
                )}
              </button>

              {resolveError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {resolveError}
                </div>
              )}

              {selectedSheet && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <div className="flex-1 text-sm">
                    <div className="font-medium text-green-900">{selectedSheet.name}</div>
                    <div className="text-xs text-green-700">מוכן לסנכרון</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab picker — shown once a sheet is selected and has tabs */}
          {selectedSheet && availableTabs.length > 0 && (
            <div className="mt-5 pt-5 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                גיליון משנה (Tab)
              </label>
              <select
                value={selectedTabName}
                onChange={(e) => setSelectedTabName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 bg-white"
              >
                {availableTabs.map((tab) => (
                  <option key={tab.sheetId} value={tab.title}>
                    {tab.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                הנתונים יתווספו לגיליון המשנה שתבחר. אם הוא ריק, יווספו כותרות אוטומטיות.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          {saveError && (
            <div className="text-xs text-red-600">{saveError}</div>
          )}
          <div className="flex items-center gap-2 ms-auto">
            <button
              onClick={onClose}
              className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              ביטול
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedSheet || isSaving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  שומר...
                </>
              ) : (
                <>שמירה</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px flex items-center gap-1.5 transition ${
        active
          ? 'border-purple-500 text-purple-700'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
