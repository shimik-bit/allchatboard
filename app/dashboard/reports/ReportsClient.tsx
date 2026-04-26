'use client';

import { useState, useEffect } from 'react';
import { Bell, Plus, Send, Edit2, Trash2, Power, X, Clock, Calendar, Users, MessageSquare, Eye, AlertCircle, Check, History, Lock, Play, ChevronRight } from 'lucide-react';

type Workspace = { id: string; name: string };
type Table = { id: string; name: string; icon: string | null };

type Report = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  template_type: string;
  template_config: Record<string, any>;
  schedule_time: string;
  schedule_days: number[];
  timezone: string;
  recipient_phones: string[];
  recipient_names: string[];
  table_ids: string[] | null;
  last_run_at: string | null;
  next_run_at: string | null;
  run_count: number;
  created_at: string;
};

type Run = {
  id: string;
  report_id: string;
  ran_at: string;
  success: boolean;
  recipients_sent: string[];
  error_message: string | null;
};

const TEMPLATES = [
  {
    id: 'open_tasks',
    name: 'משימות פתוחות',
    description: 'תזכורת יומית של רשומות שלא הושלמו',
    icon: '📋',
    color: 'from-blue-500 to-blue-600',
    use_case: 'בוקר טוב! יש לך 5 משימות פתוחות, 2 דחופות',
  },
  {
    id: 'leads_summary',
    name: 'סיכום לידים',
    description: 'דוח לידים מקובץ לפי קמפיין/מקור',
    icon: '🎯',
    color: 'from-purple-500 to-purple-600',
    use_case: 'אתמול נכנסו 8 לידים: 5 פייסבוק, 2 אתר, 1 הפניה',
  },
  {
    id: 'sales_summary',
    name: 'סיכום מכירות',
    description: 'סה״כ מכירות + השוואה לתקופה קודמת',
    icon: '💰',
    color: 'from-green-500 to-green-600',
    use_case: 'מכירות היום: ₪12,400 (+18% מאתמול)',
  },
  {
    id: 'stuck_records',
    name: 'רשומות תקועות',
    description: 'רשומות פתוחות שלא זזו X ימים',
    icon: '⚠️',
    color: 'from-amber-500 to-amber-600',
    use_case: '3 לידים מלפני שבוע ללא מענה - דורש טיפול',
  },
];

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function ReportsClient({
  workspace, isAdmin,
}: {
  workspace: Workspace;
  isAdmin: boolean;
}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [editing, setEditing] = useState<Report | null>(null);

  function loadAll() {
    setLoading(true);
    fetch(`/api/reports?workspace_id=${workspace.id}`)
      .then((r) => r.json())
      .then((d) => {
        setReports(d.reports || []);
        setTables(d.tables || []);
        setRuns(d.recent_runs || []);
        setLoading(false);
      });
  }

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [workspace.id]);

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="card p-8 text-center">
          <Lock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="font-display font-bold text-xl mb-2">דף למנהלים בלבד</h2>
          <p className="text-gray-500 text-sm">רק בעלי סביבה ומנהלים יכולים לנהל דוחות מתוזמנים.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="font-display font-black text-2xl md:text-3xl mb-1 flex items-center gap-2">
            <Bell className="w-7 h-7 text-brand-600" />
            דוחות מתוזמנים בוואטסאפ
          </h1>
          <p className="text-sm text-gray-600">
            הודעות אוטומטיות לאנשי הצוות שלך — ישירות לוואטסאפ, בלי להיכנס למערכת
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowWizard(true); }}
          className="btn-primary text-sm flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> דוח חדש
        </button>
      </div>

      {/* Empty state */}
      {!loading && reports.length === 0 && (
        <EmptyState onCreate={() => { setEditing(null); setShowWizard(true); }} />
      )}

      {/* Reports list */}
      {reports.length > 0 && (
        <div className="space-y-3 mb-8">
          {reports.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              tables={tables}
              runs={runs.filter((run) => run.report_id === r.id).slice(0, 3)}
              onChange={loadAll}
              onEdit={() => { setEditing(r); setShowWizard(true); }}
            />
          ))}
        </div>
      )}

      {/* Recent runs panel */}
      {runs.length > 0 && (
        <RunsPanel runs={runs} reports={reports} />
      )}

      {/* Wizard modal */}
      {showWizard && (
        <ReportWizard
          workspace={workspace}
          tables={tables}
          editing={editing}
          onClose={() => { setShowWizard(false); setEditing(null); }}
          onSaved={() => { setShowWizard(false); setEditing(null); loadAll(); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card p-8 text-center bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="text-5xl mb-3">🤖</div>
      <h3 className="font-display font-bold text-xl mb-2">עוזר אישי שעובד בשבילך</h3>
      <p className="text-gray-600 text-sm max-w-md mx-auto mb-6">
        הגדר דוחות מתוזמנים שיישלחו אוטומטית לוואטסאפ.
        בוקר עם רשימת המשימות, סוף יום עם סיכום הלידים, או התראה על דברים תקועים.
      </p>
      <button onClick={onCreate} className="btn-primary text-sm">
        <Plus className="w-4 h-4 inline ml-1" /> צור דוח ראשון
      </button>
      <div className="mt-8 grid md:grid-cols-2 gap-3 text-right max-w-2xl mx-auto">
        {TEMPLATES.map((t) => (
          <div key={t.id} className="flex items-start gap-3 p-3 bg-white/60 rounded-lg border border-gray-100">
            <div className="text-2xl">{t.icon}</div>
            <div>
              <div className="font-semibold text-sm">{t.name}</div>
              <div className="text-xs text-gray-500 italic mt-1">"{t.use_case}"</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// REPORT CARD
// ============================================================================
function ReportCard({ report, tables, runs, onChange, onEdit }: {
  report: Report;
  tables: Table[];
  runs: Run[];
  onChange: () => void;
  onEdit: () => void;
}) {
  const template = TEMPLATES.find((t) => t.id === report.template_type);
  const lastRun = runs[0];
  const [busy, setBusy] = useState(false);

  async function toggleEnabled() {
    setBusy(true);
    await fetch(`/api/reports/${report.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !report.enabled }),
    });
    onChange();
    setBusy(false);
  }

  async function runNow() {
    if (!confirm(`לשלוח את הדוח "${report.name}" עכשיו ל-${report.recipient_phones.length} מקבלים?`)) return;
    setBusy(true);
    const res = await fetch(`/api/reports/run/${report.id}`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      alert(`✅ הדוח נשלח ל-${data.sent_to.length} מקבלים`);
    } else {
      alert(`❌ שגיאה: ${data.error}`);
    }
    onChange();
    setBusy(false);
  }

  async function handleDelete() {
    if (!confirm(`למחוק את הדוח "${report.name}"? פעולה זו לא ניתנת לביטול.`)) return;
    setBusy(true);
    await fetch(`/api/reports/${report.id}`, { method: 'DELETE' });
    onChange();
  }

  const accessibleTables = report.table_ids === null
    ? null
    : tables.filter((t) => report.table_ids!.includes(t.id));

  return (
    <div className={`card p-4 ${!report.enabled ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3 flex-wrap md:flex-nowrap">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${template?.color || 'from-gray-400 to-gray-600'} grid place-items-center text-2xl flex-shrink-0`}>
          {template?.icon || '📊'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{report.name}</span>
            {report.enabled ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">פעיל</span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold">כבוי</span>
            )}
            {lastRun && !lastRun.success && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> שגיאה אחרונה
              </span>
            )}
          </div>

          {report.description && (
            <div className="text-sm text-gray-500 mt-0.5">{report.description}</div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 mt-3 text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{report.schedule_time}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{formatDays(report.schedule_days)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>{report.recipient_phones.length} מקבלים</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              <span>{accessibleTables === null ? 'כל הטבלאות' : `${accessibleTables.length} טבלאות`}</span>
            </div>
          </div>

          {(report.last_run_at || report.next_run_at) && (
            <div className="text-[11px] text-gray-400 mt-2 flex flex-wrap gap-3">
              {report.last_run_at && (
                <span>אחרון: {new Date(report.last_run_at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              )}
              {report.next_run_at && report.enabled && (
                <span>הבא: {new Date(report.next_run_at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              )}
              <span>{report.run_count} ריצות</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={runNow} disabled={busy} title="שלח עכשיו" className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50">
            <Play className="w-4 h-4" />
          </button>
          <button onClick={toggleEnabled} disabled={busy} title={report.enabled ? 'השבת' : 'הפעל'} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50">
            <Power className="w-4 h-4" />
          </button>
          <button onClick={onEdit} title="ערוך" className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={handleDelete} disabled={busy} title="מחק" className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// RUNS PANEL
// ============================================================================
function RunsPanel({ runs, reports }: { runs: Run[]; reports: Report[] }) {
  return (
    <div className="card p-4">
      <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
        <History className="w-4 h-4" /> היסטוריית שליחות
      </h3>
      <div className="space-y-1">
        {runs.slice(0, 10).map((r) => {
          const report = reports.find((rep) => rep.id === r.report_id);
          return (
            <div key={r.id} className="flex items-center gap-3 py-2 px-3 hover:bg-gray-50 rounded-lg text-sm">
              <span className={`w-2 h-2 rounded-full ${r.success ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="font-medium flex-1 min-w-0 truncate">{report?.name || 'דוח לא ידוע'}</span>
              <span className="text-xs text-gray-500">
                {r.success ? `נשלח ל-${r.recipients_sent.length}` : (r.error_message || 'נכשל')}
              </span>
              <span className="text-xs text-gray-400 mono whitespace-nowrap">
                {new Date(r.ran_at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// WIZARD
// ============================================================================
function ReportWizard({
  workspace, tables, editing, onClose, onSaved,
}: {
  workspace: Workspace;
  tables: Table[];
  editing: Report | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState(editing?.name || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [templateType, setTemplateType] = useState(editing?.template_type || '');
  const [templateConfig, setTemplateConfig] = useState<Record<string, any>>(editing?.template_config || {});
  const [scheduleTime, setScheduleTime] = useState(editing?.schedule_time || '09:00');
  const [scheduleDays, setScheduleDays] = useState<number[]>(editing?.schedule_days || [0, 1, 2, 3, 4]);  // Sun-Thu default for Israel
  const [tableIds, setTableIds] = useState<string[]>(editing?.table_ids || []);
  const [allTables, setAllTables] = useState<boolean>(editing?.table_ids === null || !editing);
  const [recipients, setRecipients] = useState<{ phone: string; name: string }[]>(
    editing
      ? editing.recipient_phones.map((phone, i) => ({
          phone,
          name: editing.recipient_names?.[i] || '',
        }))
      : [{ phone: '', name: '' }]
  );
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  const [preview, setPreview] = useState<{ message: string; isEmpty: boolean; recordCount: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate preview when reaching step 4
  useEffect(() => {
    if (step === 4 && templateType) {
      setPreviewLoading(true);
      fetch('/api/reports/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          template_type: templateType,
          template_config: templateConfig,
          table_ids: allTables ? null : tableIds,
        }),
      })
        .then((r) => r.json())
        .then((d) => { setPreview(d); setPreviewLoading(false); })
        .catch(() => setPreviewLoading(false));
    }
  }, [step, templateType, allTables, tableIds, workspace.id]); // eslint-disable-line

  function toggleDay(day: number) {
    setScheduleDays((arr) => arr.includes(day) ? arr.filter((d) => d !== day) : [...arr, day].sort());
  }

  function toggleTable(id: string) {
    setTableIds((arr) => arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  }

  function addRecipient() {
    setRecipients([...recipients, { phone: '', name: '' }]);
  }

  function removeRecipient(idx: number) {
    setRecipients(recipients.filter((_, i) => i !== idx));
  }

  function updateRecipient(idx: number, field: 'phone' | 'name', value: string) {
    const next = [...recipients];
    next[idx] = { ...next[idx], [field]: value };
    setRecipients(next);
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) return setError('שם הדוח הוא חובה');
    if (!templateType) return setError('בחר תבנית דוח');
    if (scheduleDays.length === 0) return setError('בחר לפחות יום אחד');
    const validRecipients = recipients.filter((r) => r.phone.trim());
    if (validRecipients.length === 0) return setError('הוסף לפחות מקבל אחד');

    setSaving(true);
    try {
      const body = {
        workspace_id: workspace.id,
        name: name.trim(),
        description: description.trim() || null,
        template_type: templateType,
        template_config: templateConfig,
        schedule_time: scheduleTime,
        schedule_days: scheduleDays,
        timezone: 'Asia/Jerusalem',
        recipient_phones: validRecipients.map((r) => r.phone.trim()),
        recipient_names: validRecipients.map((r) => r.name.trim()),
        table_ids: allTables ? null : tableIds,
        enabled,
      };

      const url = editing ? `/api/reports/${editing.id}` : '/api/reports';
      const method = editing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'שמירה נכשלה');
        setSaving(false);
        return;
      }
      onSaved();
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50">
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-display font-bold text-lg">
            {editing ? `עריכת ${editing.name}` : 'דוח חדש'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 bg-gray-50 border-b flex items-center gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex-1 flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold ${
                step === n ? 'bg-brand-600 text-white' : step > n ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step > n ? <Check className="w-4 h-4" /> : n}
              </div>
              <div className="text-xs flex-1">
                {n === 1 && 'תבנית'}
                {n === 2 && 'הגדרות'}
                {n === 3 && 'מקבלים'}
                {n === 4 && 'תצוגה מקדימה'}
              </div>
              {n < 4 && <ChevronRight className="w-3 h-3 text-gray-300" />}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: Template */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5">שם הדוח</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='למשל: "תזכורת בוקר למשימות"'
                  className="input-field"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5">תיאור (אופציונלי)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="למה נוצר הדוח, מי האחראי"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">בחר תבנית</label>
                <div className="space-y-2">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplateType(t.id)}
                      className={`w-full text-right p-3 rounded-xl border-2 transition-all ${
                        templateType === t.id ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex gap-3 items-start">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${t.color} grid place-items-center text-xl flex-shrink-0`}>
                          {t.icon}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{t.name}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>
                          <div className="text-xs text-gray-400 italic mt-1">"{t.use_case}"</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Schedule + Tables */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold mb-2">מתי לשלוח?</label>
                <div className="flex items-center gap-3 mb-3">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="input-field !w-32"
                  />
                  <span className="text-xs text-gray-500">שעון ישראל</span>
                </div>

                <div className="text-xs text-gray-500 mb-2">בחר ימים:</div>
                <div className="grid grid-cols-7 gap-1">
                  {DAYS.map((day, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={`p-2 rounded-lg text-xs font-medium transition-colors ${
                        scheduleDays.includes(i) ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2 text-xs">
                  <button onClick={() => setScheduleDays([0, 1, 2, 3, 4])} className="text-brand-600 hover:underline">ימי עסקים (א-ה)</button>
                  <span className="text-gray-300">·</span>
                  <button onClick={() => setScheduleDays([0, 1, 2, 3, 4, 5, 6])} className="text-brand-600 hover:underline">כל יום</button>
                  <span className="text-gray-300">·</span>
                  <button onClick={() => setScheduleDays([0])} className="text-brand-600 hover:underline">רק ראשון</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">אילו טבלאות לכלול?</label>
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input type="checkbox" checked={allTables} onChange={(e) => setAllTables(e.target.checked)} className="w-4 h-4 rounded text-brand-600" />
                  <span className="text-sm">כל הטבלאות</span>
                </label>
                {!allTables && (
                  <div className="border rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                    {tables.map((t) => (
                      <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                        <input type="checkbox" checked={tableIds.includes(t.id)} onChange={() => toggleTable(t.id)} className="w-4 h-4 rounded text-brand-600" />
                        <span className="text-sm">{t.icon} {t.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Template-specific config */}
              <TemplateConfig
                templateType={templateType}
                config={templateConfig}
                onChange={setTemplateConfig}
              />
            </div>
          )}

          {/* STEP 3: Recipients */}
          {step === 3 && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold mb-2">למי לשלוח?</label>
                <p className="text-xs text-gray-500 mb-3">
                  הזן מספרי טלפון בכל פורמט (0501234567 או 972501234567). אלו לא חייבים להיות חברי צוות.
                </p>
              </div>
              {recipients.map((r, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <input
                    type="text"
                    value={r.name}
                    onChange={(e) => updateRecipient(idx, 'name', e.target.value)}
                    placeholder="שם (אופציונלי)"
                    className="input-field !w-1/3"
                  />
                  <input
                    type="tel"
                    dir="ltr"
                    value={r.phone}
                    onChange={(e) => updateRecipient(idx, 'phone', e.target.value)}
                    placeholder="0501234567"
                    className="input-field flex-1"
                  />
                  {recipients.length > 1 && (
                    <button onClick={() => removeRecipient(idx)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addRecipient} className="text-sm text-brand-600 font-medium hover:underline">
                + הוסף מקבל
              </button>

              <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-900 border border-blue-100">
                💡 ניתן לשלוח לעד 20 מקבלים בדוח אחד. שווה לחשוב מי באמת צריך להירשם — אנשים שנרשמים להמון דוחות מתחילים להתעלם מהם.
              </div>
            </div>
          )}

          {/* STEP 4: Preview */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">תצוגה מקדימה — איך הדוח ייראה בוואטסאפ</label>
              </div>

              {previewLoading ? (
                <div className="p-8 text-center text-gray-400 text-sm">מייצר תצוגה...</div>
              ) : preview ? (
                <div className="bg-[#e0d5c5] rounded-2xl p-4">
                  <div className="bg-white rounded-xl rounded-tr-sm p-3 max-w-[85%] shadow-sm" style={{ backgroundColor: '#dcfce7' }}>
                    <div className="text-[10px] text-green-700 font-bold mb-1">AllChat Bot 🤖</div>
                    <pre className="text-sm whitespace-pre-wrap font-sans" style={{ direction: 'rtl', textAlign: 'right' }}>{preview.message}</pre>
                    <div className="text-[10px] text-gray-500 text-left mt-1">{scheduleTime} ✓✓</div>
                  </div>
                  {preview.isEmpty && (
                    <div className="mt-3 p-2 bg-yellow-100 rounded text-xs text-yellow-900">
                      ℹ️ <strong>שים לב:</strong> בנקודת זמן זו אין נתונים תואמים. הדוח עדיין יישלח עם הודעה ידידותית.
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-red-50 rounded-lg text-sm text-red-800">
                  לא הצלחנו לייצר תצוגה. המשך כדי לשמור והדוח ירוץ בזמן הקבוע.
                </div>
              )}

              <div className="p-3 bg-gray-50 rounded-lg space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">שם:</span><strong>{name}</strong></div>
                <div className="flex justify-between"><span className="text-gray-500">תבנית:</span><strong>{TEMPLATES.find(t => t.id === templateType)?.name}</strong></div>
                <div className="flex justify-between"><span className="text-gray-500">שעה:</span><strong>{scheduleTime}</strong></div>
                <div className="flex justify-between"><span className="text-gray-500">ימים:</span><strong>{formatDays(scheduleDays)}</strong></div>
                <div className="flex justify-between"><span className="text-gray-500">מקבלים:</span><strong>{recipients.filter(r => r.phone.trim()).length}</strong></div>
                <div className="flex justify-between"><span className="text-gray-500">טבלאות:</span><strong>{allTables ? 'כל הטבלאות' : `${tableIds.length} נבחרו`}</strong></div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4 rounded text-brand-600" />
                <span className="text-sm">הפעל את הדוח מיד אחרי שמירה</span>
              </label>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-800 flex gap-2 items-start">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between items-center bg-gray-50/50">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="btn-secondary text-sm"
          >
            {step === 1 ? 'ביטול' : 'חזרה'}
          </button>
          <div className="flex gap-2">
            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 1 && (!name.trim() || !templateType)) ||
                  (step === 2 && scheduleDays.length === 0) ||
                  (step === 3 && recipients.filter(r => r.phone.trim()).length === 0)
                }
                className="btn-primary text-sm"
              >
                המשך →
              </button>
            ) : (
              <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
                {saving ? 'שומר...' : (editing ? 'שמור שינויים' : 'צור דוח')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TEMPLATE-SPECIFIC CONFIG
// ============================================================================
function TemplateConfig({ templateType, config, onChange }: {
  templateType: string;
  config: Record<string, any>;
  onChange: (c: Record<string, any>) => void;
}) {
  function update(key: string, value: any) {
    onChange({ ...config, [key]: value });
  }

  if (templateType === 'leads_summary') {
    return (
      <div className="space-y-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
        <div className="text-xs font-bold text-purple-900">הגדרות סיכום לידים</div>
        <div>
          <label className="block text-xs font-medium mb-1">תקופה</label>
          <select
            value={config.period || 'today'}
            onChange={(e) => update('period', e.target.value)}
            className="input-field !text-sm"
          >
            <option value="today">היום</option>
            <option value="yesterday">אתמול</option>
            <option value="last_24h">24 שעות אחרונות</option>
            <option value="this_week">השבוע</option>
            <option value="last_7_days">7 ימים אחרונים</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">שדה לקיבוץ (slug)</label>
          <input
            type="text"
            dir="ltr"
            value={config.group_by_field || ''}
            onChange={(e) => update('group_by_field', e.target.value)}
            placeholder="campaign_source"
            className="input-field !text-sm"
          />
          <div className="text-[10px] text-gray-500 mt-1">לדוגמה: campaign_source, source, channel</div>
        </div>
      </div>
    );
  }

  if (templateType === 'sales_summary') {
    return (
      <div className="space-y-3 p-3 bg-green-50 rounded-lg border border-green-100">
        <div className="text-xs font-bold text-green-900">הגדרות סיכום מכירות</div>
        <div>
          <label className="block text-xs font-medium mb-1">תקופה</label>
          <select value={config.period || 'today'} onChange={(e) => update('period', e.target.value)} className="input-field !text-sm">
            <option value="today">היום</option>
            <option value="yesterday">אתמול</option>
            <option value="this_week">השבוע</option>
            <option value="this_month">החודש</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">שדה הסכום (slug)</label>
          <input
            type="text"
            dir="ltr"
            value={config.amount_field || ''}
            onChange={(e) => update('amount_field', e.target.value)}
            placeholder="amount"
            className="input-field !text-sm"
          />
        </div>
      </div>
    );
  }

  if (templateType === 'stuck_records') {
    return (
      <div className="space-y-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
        <div className="text-xs font-bold text-amber-900">הגדרות רשומות תקועות</div>
        <div>
          <label className="block text-xs font-medium mb-1">כמה ימים בלי עדכון נחשב "תקוע"</label>
          <input
            type="number"
            value={config.days_threshold || 7}
            onChange={(e) => update('days_threshold', parseInt(e.target.value))}
            className="input-field !text-sm !w-24"
          />
        </div>
      </div>
    );
  }

  if (templateType === 'open_tasks') {
    return (
      <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
        <div className="text-xs font-bold text-blue-900">הגדרות משימות פתוחות</div>
        <div>
          <label className="block text-xs font-medium mb-1">כמה משימות מקסימום להציג</label>
          <input
            type="number"
            value={config.limit || 10}
            onChange={(e) => update('limit', parseInt(e.target.value))}
            className="input-field !text-sm !w-24"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">מסמן כדחוף אם פתוח מעל X ימים</label>
          <input
            type="number"
            value={config.highlight_overdue_days || 3}
            onChange={(e) => update('highlight_overdue_days', parseInt(e.target.value))}
            className="input-field !text-sm !w-24"
          />
        </div>
      </div>
    );
  }

  return null;
}

// ============================================================================
// HELPERS
// ============================================================================
function formatDays(days: number[]): string {
  if (days.length === 7) return 'כל יום';
  if (days.length === 5 && [0,1,2,3,4].every(d => days.includes(d))) return 'א-ה';
  if (days.length === 6 && [0,1,2,3,4,5].every(d => days.includes(d))) return 'א-ו';
  if (days.length === 1) return DAYS[days[0]];
  return days.map(d => DAYS[d].slice(0, 1)).join(', ');
}
