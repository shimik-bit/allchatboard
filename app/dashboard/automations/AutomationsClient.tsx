'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Zap, Play, Power, Edit2, Trash2, Plus, X, AlertCircle, Lock, History, Repeat, ArrowRight, ArrowLeft, Check, Activity, Clock, MessageSquare } from 'lucide-react';
import { useT } from '@/lib/i18n/useT';

type Workspace = { id: string; name: string };
type Table = { id: string; name: string; icon: string | null };

type Workflow = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger_type: string;
  trigger_config: any;
  actions: any[];
  run_count: number;
  last_run_at: string | null;
  last_error: string | null;
  created_at: string;
};

type Sequence = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  steps: any[];
  exit_on_reply: boolean;
  exit_on_status_change: string[] | null;
  exit_on_unsubscribe: boolean;
  enrollment_count: number;
  active_enrollments: number;
  created_at: string;
};

type Run = {
  id: string;
  workflow_id: string;
  ran_at: string;
  success: boolean;
  error_message: string | null;
  duration_ms: number;
};

export default function AutomationsClient({
  workspace, tables, isAdmin,
}: {
  workspace: Workspace;
  tables: Table[];
  isAdmin: boolean;
}) {
  const { t } = useT();
  const [tab, setTab] = useState<'workflows' | 'sequences' | 'history'>('workflows');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [showWorkflowEditor, setShowWorkflowEditor] = useState(false);
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null);
  const [showSequenceEditor, setShowSequenceEditor] = useState(false);

  function loadAll() {
    setLoading(true);
    Promise.all([
      fetch(`/api/workflows?workspace_id=${workspace.id}`).then(r => r.json()),
      fetch(`/api/sequences?workspace_id=${workspace.id}`).then(r => r.json()),
    ]).then(([wfData, seqData]) => {
      setWorkflows(wfData.workflows || []);
      setRuns(wfData.recent_runs || []);
      setSequences(seqData.sequences || []);
      setLoading(false);
    });
  }

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [workspace.id]);

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="card p-8 text-center">
          <Lock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="font-display font-bold text-xl mb-2">{t('permissions.admin_only') || 'דף למנהלים בלבד'}</h2>
          <p className="text-gray-500 text-sm">{t('permissions.no_access') || 'רק בעלי סביבה ומנהלים יכולים לנהל אוטומציות.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display font-black text-2xl md:text-3xl mb-1 flex items-center gap-2">
          <Zap className="w-7 h-7 text-amber-500" />
          אוטומציות
        </h1>
        <p className="text-sm text-gray-600">
          הגדר אוטומציות שירוצו על הרשומות שלך - בלי לחיצה ידנית, בלי הקלדה
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4 overflow-x-auto">
        <button
          onClick={() => setTab('workflows')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            tab === 'workflows' ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-500'
          }`}
        >
          <Zap className="w-3.5 h-3.5 inline ml-1" /> Workflows ({workflows.length})
        </button>
        <button
          onClick={() => setTab('sequences')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            tab === 'sequences' ? 'border-purple-500 text-purple-700' : 'border-transparent text-gray-500'
          }`}
        >
          <Repeat className="w-3.5 h-3.5 inline ml-1" /> סדרות פולואפים ({sequences.length})
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            tab === 'history' ? 'border-blue-500 text-blue-700' : 'border-transparent text-gray-500'
          }`}
        >
          <History className="w-3.5 h-3.5 inline ml-1" /> היסטוריה
        </button>
      </div>

      {/* Workflows tab */}
      {tab === 'workflows' && (
        <WorkflowsTab
          workflows={workflows}
          tables={tables}
          loading={loading}
          onCreate={() => { setEditingWorkflow(null); setShowWorkflowEditor(true); }}
          onEdit={(w: Workflow) => { setEditingWorkflow(w); setShowWorkflowEditor(true); }}
          onChange={loadAll}
        />
      )}

      {/* Sequences tab */}
      {tab === 'sequences' && (
        <SequencesTab
          sequences={sequences}
          loading={loading}
          onCreate={() => { setEditingSequence(null); setShowSequenceEditor(true); }}
          onEdit={(s: Sequence) => { setEditingSequence(s); setShowSequenceEditor(true); }}
          onChange={loadAll}
        />
      )}

      {/* History tab */}
      {tab === 'history' && (
        <HistoryTab runs={runs} workflows={workflows} />
      )}

      {/* Workflow editor */}
      {showWorkflowEditor && (
        <WorkflowEditor
          workspace={workspace}
          tables={tables}
          sequences={sequences}
          editing={editingWorkflow}
          onClose={() => { setShowWorkflowEditor(false); setEditingWorkflow(null); }}
          onSaved={() => { setShowWorkflowEditor(false); setEditingWorkflow(null); loadAll(); }}
        />
      )}

      {/* Sequence editor */}
      {showSequenceEditor && (
        <SequenceEditor
          workspace={workspace}
          tables={tables}
          editing={editingSequence}
          onClose={() => { setShowSequenceEditor(false); setEditingSequence(null); }}
          onSaved={() => { setShowSequenceEditor(false); setEditingSequence(null); loadAll(); }}
        />
      )}
    </div>
  );
}

// ============================================================================
// WORKFLOWS TAB
// ============================================================================
function WorkflowsTab({ workflows, tables, loading, onCreate, onEdit, onChange }: any) {
  const { t } = useT();
  if (loading) return <div className="card p-8 text-center text-gray-400 text-sm">{t('common.loading')}</div>;

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-600">{t('automations.workflows_desc') || 'אוטומציות שרצות בזמן אמת על שינויי רשומות'}</p>
        <button onClick={onCreate} className="btn-primary text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Workflow חדש
        </button>
      </div>

      {workflows.length === 0 ? (
        <EmptyWorkflows onCreate={onCreate} />
      ) : (
        <div className="space-y-2">
          {workflows.map((w: Workflow) => (
            <WorkflowCard key={w.id} workflow={w} tables={tables} onEdit={() => onEdit(w)} onChange={onChange} />
          ))}
        </div>
      )}
    </>
  );
}

function EmptyWorkflows({ onCreate }: { onCreate: () => void }) {
  const { t } = useT();
  return (
    <div className="card p-8 text-center bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <div className="text-5xl mb-3">⚡</div>
      <h3 className="font-display font-bold text-xl mb-2">{t('automations.workflows_subtitle') || 'אוטומציות שעובדות בשבילך'}</h3>
      <p className="text-gray-600 text-sm max-w-md mx-auto mb-6">
        הגדר "אם זה אז זה" - כשליד מקבל סטטוס "חתום" אוטומטית צור רשומת לקוח, שלח ברוך הבא, וסמן את הליד כהומר.
      </p>
      <button onClick={onCreate} className="btn-primary text-sm">
        <Plus className="w-4 h-4 inline ml-1" /> צור Workflow ראשון
      </button>
      <div className="mt-8 grid md:grid-cols-2 gap-3 text-right max-w-2xl mx-auto">
        <div className="p-3 bg-white/60 rounded-lg border border-gray-100">
          <div className="font-semibold text-sm mb-1">🎯 דוגמה: ליד הופך ללקוח</div>
          <div className="text-xs text-gray-500">כשסטטוס משתנה ל"חתום" → צור לקוח חדש + שלח WhatsApp</div>
        </div>
        <div className="p-3 bg-white/60 rounded-lg border border-gray-100">
          <div className="font-semibold text-sm mb-1">📨 דוגמה: ליד חדש = פולואפ אוטומטי</div>
          <div className="text-xs text-gray-500">כשנוצר ליד חדש → התחל סדרת פולואפים</div>
        </div>
      </div>
    </div>
  );
}

function WorkflowCard({ workflow: w, tables, onEdit, onChange }: any) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);

  const triggerLabel = workflow_triggerLabel(w, tables);

  async function toggleEnabled() {
    setBusy(true);
    await fetch(`/api/workflows/${w.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !w.enabled }),
    });
    onChange();
    setBusy(false);
  }

  async function handleDelete() {
    if (!confirm(`למחוק את ה-Workflow "${w.name}"?`)) return;
    setBusy(true);
    await fetch(`/api/workflows/${w.id}`, { method: 'DELETE' });
    onChange();
  }

  return (
    <div className={`card p-4 ${!w.enabled ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 grid place-items-center text-xl flex-shrink-0">
          ⚡
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{w.name}</span>
            {w.enabled
              ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">{t('common.active')}</span>
              : <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold">{t('common.disabled')}</span>}
            {w.last_error && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> שגיאה
              </span>
            )}
          </div>
          {w.description && <div className="text-sm text-gray-500 mt-0.5">{w.description}</div>}
          <div className="text-xs text-gray-600 mt-2 flex items-center flex-wrap gap-1">
            <span className="text-gray-400">כאשר:</span> {triggerLabel}
            <span className="text-gray-400 mx-1">→</span>
            <span className="text-gray-400">פעולות:</span>
            <span className="font-medium">{w.actions?.length || 0}</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-1.5">
            {w.run_count} ריצות
            {w.last_run_at && ` · אחרון: ${new Date(w.last_run_at).toLocaleDateString('he-IL')}`}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={toggleEnabled} disabled={busy} className="p-2 hover:bg-gray-100 rounded-lg" title={w.enabled ? 'השבת' : 'הפעל'}>
            <Power className="w-4 h-4" />
          </button>
          <button onClick={onEdit} className="p-2 hover:bg-gray-100 rounded-lg" title={t('common.edit')}>
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={handleDelete} disabled={busy} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title={t('common.delete')}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function workflow_triggerLabel(w: Workflow, tables: Table[]): string {
  const tableId = w.trigger_config?.table_id;
  const tableName = tables.find((t: Table) => t.id === tableId)?.name || 'טבלה';

  switch (w.trigger_type) {
    case 'record_created':
      return `נוצרת רשומה ב"${tableName}"`;
    case 'field_changed': {
      const slug = w.trigger_config?.field_slug;
      const value = w.trigger_config?.to_value;
      if (value) return `שדה "${slug}" משתנה ל-"${value}" ב"${tableName}"`;
      return `שדה "${slug}" משתנה ב"${tableName}"`;
    }
    default:
      return w.trigger_type;
  }
}

// ============================================================================
// SEQUENCES TAB
// ============================================================================
function SequencesTab({ sequences, loading, onCreate, onEdit, onChange }: any) {
  const { t } = useT();
  if (loading) return <div className="card p-8 text-center text-gray-400 text-sm">{t('common.loading')}</div>;

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-600">{t('automations.sequences_desc') || 'סדרות הודעות אוטומטיות שמתפרסות בזמן (drip campaigns)'}</p>
        <button onClick={onCreate} className="btn-primary text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> סדרה חדשה
        </button>
      </div>

      {sequences.length === 0 ? (
        <EmptySequences onCreate={onCreate} />
      ) : (
        <div className="space-y-2">
          {sequences.map((s: Sequence) => (
            <SequenceCard key={s.id} sequence={s} onEdit={() => onEdit(s)} onChange={onChange} />
          ))}
        </div>
      )}
    </>
  );
}

function EmptySequences({ onCreate }: { onCreate: () => void }) {
  const { t } = useT();
  return (
    <div className="card p-8 text-center bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="text-5xl mb-3">🔁</div>
      <h3 className="font-display font-bold text-xl mb-2">{t('automations.sequences_subtitle') || 'פולואפים שלא נשכחים'}</h3>
      <p className="text-gray-600 text-sm max-w-md mx-auto mb-6">
        לקוח חדש מקבל הודעה ביום הראשון, יום שאחרי, אחרי שבוע, ואחרי חודש - אוטומטית.
        אתה לא צריך לזכור.
      </p>
      <button onClick={onCreate} className="btn-primary text-sm">
        <Plus className="w-4 h-4 inline ml-1" /> צור סדרה ראשונה
      </button>
    </div>
  );
}

function SequenceCard({ sequence: s, onEdit, onChange }: any) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);

  async function toggleEnabled() {
    setBusy(true);
    await fetch(`/api/sequences/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !s.enabled }),
    });
    onChange();
    setBusy(false);
  }

  async function handleDelete() {
    if (!confirm(`למחוק את הסדרה "${s.name}"? כל הנרשמים הפעילים יישכחו.`)) return;
    setBusy(true);
    await fetch(`/api/sequences/${s.id}`, { method: 'DELETE' });
    onChange();
  }

  return (
    <div className={`card p-4 ${!s.enabled ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 grid place-items-center text-xl flex-shrink-0">
          🔁
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{s.name}</span>
            {s.enabled
              ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">פעיל</span>
              : <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold">כבוי</span>}
          </div>
          {s.description && <div className="text-sm text-gray-500 mt-0.5">{s.description}</div>}
          <div className="text-xs text-gray-600 mt-2 flex items-center gap-3 flex-wrap">
            <span><strong>{s.steps?.length || 0}</strong> שלבים</span>
            <span>·</span>
            <span><strong>{s.active_enrollments}</strong> פעילים</span>
            {s.steps?.length > 0 && (
              <>
                <span>·</span>
                <span>משך: ~{calcSequenceDuration(s.steps)} ימים</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={toggleEnabled} disabled={busy} className="p-2 hover:bg-gray-100 rounded-lg">
            <Power className="w-4 h-4" />
          </button>
          <button onClick={onEdit} className="p-2 hover:bg-gray-100 rounded-lg">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={handleDelete} disabled={busy} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function calcSequenceDuration(steps: any[]): number {
  return steps.reduce((sum, s) => sum + (s.delay_days || 0) + ((s.delay_hours || 0) / 24), 0);
}

// ============================================================================
// HISTORY TAB
// ============================================================================
function HistoryTab({ runs, workflows }: { runs: Run[]; workflows: Workflow[] }) {
  const { t } = useT();
  if (runs.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Activity className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <h3 className="font-bold text-lg mb-1">{t('automations.no_runs') || 'עוד אין הפעלות'}</h3>
        <p className="text-gray-500 text-sm">{t('automations.no_runs_hint') || 'כשאוטומציה תרוץ, ההיסטוריה תופיע כאן'}</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-right">{t('common.time') || 'זמן'}</th>
              <th className="px-3 py-2 text-right">Workflow</th>
              <th className="px-3 py-2 text-right">{t('common.status') || 'סטטוס'}</th>
              <th className="px-3 py-2 text-right">{t('common.duration') || 'משך'}</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => {
              const wf = workflows.find(w => w.id === r.workflow_id);
              return (
                <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(r.ran_at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-3 py-2 text-xs">{wf?.name || '—'}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.success
                      ? <span className="text-green-700">✅ הצלחה</span>
                      : <span className="text-red-700">❌ {r.error_message?.slice(0, 50) || 'שגיאה'}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 mono" dir="ltr">{r.duration_ms}ms</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================================
// WORKFLOW EDITOR (simplified, builds incrementally)
// ============================================================================
function WorkflowEditor({ workspace, tables, sequences, editing, onClose, onSaved }: any) {
  const [name, setName] = useState(editing?.name || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [triggerType, setTriggerType] = useState<string>(editing?.trigger_type || 'record_created');
  const [triggerConfig, setTriggerConfig] = useState<any>(editing?.trigger_config || {});
  const [actions, setActions] = useState<any[]>(editing?.actions || []);
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Lazy-load fields when table changes
  const [fieldsForTable, setFieldsForTable] = useState<Record<string, any[]>>({});
  useEffect(() => {
    const tableId = triggerConfig.table_id;
    if (tableId && !fieldsForTable[tableId]) {
      fetch(`/api/tables/${tableId}/fields`).then(r => r.json()).then(d => {
        setFieldsForTable(prev => ({ ...prev, [tableId]: d.fields || [] }));
      });
    }
  }, [triggerConfig.table_id, fieldsForTable]);

  const triggerFields = fieldsForTable[triggerConfig.table_id] || [];

  function addAction(type: string) {
    setActions([...actions, { type, config: {} }]);
  }

  function updateAction(idx: number, config: any) {
    const next = [...actions];
    next[idx] = { ...next[idx], config };
    setActions(next);
  }

  function removeAction(idx: number) {
    setActions(actions.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) return setError('שם חובה');
    if (!triggerConfig.table_id) return setError('בחר טבלה לטריגר');
    if (triggerType === 'field_changed' && !triggerConfig.field_slug) return setError('בחר שדה');
    if (actions.length === 0) return setError('הוסף לפחות פעולה אחת');

    setSaving(true);
    const body = {
      workspace_id: workspace.id,
      name: name.trim(),
      description: description.trim() || null,
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      actions,
      enabled,
    };
    const url = editing ? `/api/workflows/${editing.id}` : '/api/workflows';
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
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50">
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-display font-bold text-lg">⚡ {editing ? 'עריכת Workflow' : 'Workflow חדש'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Basic info */}
          <div>
            <label className="block text-sm font-semibold mb-1.5">שם</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder='למשל: "ליד הופך ללקוח"'
              className="input-field"
              autoFocus
            />
          </div>

          {/* Trigger */}
          <div className="p-4 rounded-xl border-2 border-amber-200 bg-amber-50/40">
            <div className="text-sm font-bold text-amber-900 mb-3">🎯 כאשר... (Trigger)</div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setTriggerType('record_created')}
                className={`p-2 rounded-lg border-2 text-xs ${triggerType === 'record_created' ? 'border-amber-500 bg-white' : 'border-gray-200'}`}
              >
                ➕ נוצרת רשומה חדשה
              </button>
              <button
                type="button"
                onClick={() => setTriggerType('field_changed')}
                className={`p-2 rounded-lg border-2 text-xs ${triggerType === 'field_changed' ? 'border-amber-500 bg-white' : 'border-gray-200'}`}
              >
                ✏️ שדה משתנה
              </button>
            </div>

            <select
              value={triggerConfig.table_id || ''}
              onChange={e => setTriggerConfig({ ...triggerConfig, table_id: e.target.value })}
              className="input-field !text-sm mb-2"
            >
              <option value="">— בחר טבלה —</option>
              {tables.map((t: Table) => (
                <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
              ))}
            </select>

            {triggerType === 'field_changed' && triggerConfig.table_id && (
              <>
                <select
                  value={triggerConfig.field_slug || ''}
                  onChange={e => setTriggerConfig({ ...triggerConfig, field_slug: e.target.value })}
                  className="input-field !text-sm mb-2"
                >
                  <option value="">— בחר שדה —</option>
                  {triggerFields.map((f: any) => (
                    <option key={f.slug} value={f.slug}>{f.name}</option>
                  ))}
                </select>

                {triggerConfig.field_slug && (
                  <input
                    type="text"
                    value={triggerConfig.to_value || ''}
                    onChange={e => setTriggerConfig({ ...triggerConfig, to_value: e.target.value || null })}
                    placeholder="ערך ספציפי (אופציונלי - השאר ריק לכל שינוי)"
                    className="input-field !text-sm"
                  />
                )}
              </>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 rounded-xl border-2 border-blue-200 bg-blue-50/40">
            <div className="text-sm font-bold text-blue-900 mb-3">⚡ אז... (Actions)</div>

            {actions.map((action, i) => (
              <ActionEditor
                key={i}
                index={i}
                action={action}
                tables={tables}
                sequences={sequences}
                triggerFields={triggerFields}
                onChange={(config: any) => updateAction(i, config)}
                onRemove={() => removeAction(i)}
              />
            ))}

            <div className="grid grid-cols-2 gap-1.5 mt-2">
              <button onClick={() => addAction('create_record')} className="text-xs px-2 py-2 rounded-lg bg-white border border-blue-200 hover:border-blue-400">➕ צור רשומה בטבלה</button>
              <button onClick={() => addAction('update_field')} className="text-xs px-2 py-2 rounded-lg bg-white border border-blue-200 hover:border-blue-400">✏️ עדכן שדה</button>
              <button onClick={() => addAction('send_whatsapp')} className="text-xs px-2 py-2 rounded-lg bg-white border border-blue-200 hover:border-blue-400">💬 שלח WhatsApp</button>
              <button onClick={() => addAction('start_sequence')} className="text-xs px-2 py-2 rounded-lg bg-white border border-blue-200 hover:border-blue-400">🔁 הפעל סדרה</button>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="w-4 h-4 rounded text-brand-600" />
            <span className="text-sm">הפעל מיד אחרי שמירה</span>
          </label>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-800 flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2 bg-gray-50/50">
          <button onClick={onClose} className="btn-secondary text-sm" disabled={saving}>{t('common.cancel')}</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
            {saving ? 'שומר...' : (editing ? 'שמור שינויים' : 'צור Workflow')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionEditor({ index, action, tables, sequences, triggerFields, onChange, onRemove }: any) {
  const config = action.config || {};

  return (
    <div className="bg-white rounded-lg p-3 mb-2 border border-blue-100">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold">{index + 1}. {actionLabel(action.type)}</div>
        <button onClick={onRemove} className="p-1 text-red-500 hover:bg-red-50 rounded">
          <X className="w-3 h-3" />
        </button>
      </div>

      {action.type === 'create_record' && (
        <div className="space-y-1.5">
          <select
            value={config.target_table_id || ''}
            onChange={e => onChange({ ...config, target_table_id: e.target.value })}
            className="input-field !text-xs !py-1.5"
          >
            <option value="">— טבלת יעד —</option>
            {tables.map((t: Table) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <p className="text-[10px] text-gray-500">מיפוי שדות אוטומטי לפי שם זהה. לעריכה ידנית בעתיד.</p>
        </div>
      )}

      {action.type === 'update_field' && (
        <div className="grid grid-cols-2 gap-1.5">
          <select
            value={config.field_slug || ''}
            onChange={e => onChange({ ...config, field_slug: e.target.value })}
            className="input-field !text-xs !py-1.5"
          >
            <option value="">— שדה —</option>
            {triggerFields.map((f: any) => <option key={f.slug} value={f.slug}>{f.name}</option>)}
          </select>
          <input
            type="text"
            value={config.value || ''}
            onChange={e => onChange({ ...config, value: e.target.value })}
            placeholder="ערך חדש"
            className="input-field !text-xs !py-1.5"
          />
        </div>
      )}

      {action.type === 'send_whatsapp' && (
        <div className="space-y-1.5">
          <select
            value={config.phone_field || ''}
            onChange={e => onChange({ ...config, phone_field: e.target.value })}
            className="input-field !text-xs !py-1.5"
          >
            <option value="">— שדה הטלפון —</option>
            {triggerFields.filter((f: any) => f.type === 'phone' || f.slug.includes('phone')).map((f: any) =>
              <option key={f.slug} value={f.slug}>{f.name}</option>
            )}
          </select>
          <textarea
            rows={3}
            value={config.message_template || ''}
            onChange={e => onChange({ ...config, message_template: e.target.value })}
            placeholder="שלום {{name}}, ברוך הבא!"
            className="input-field !text-xs"
          />
          <p className="text-[10px] text-gray-500">השתמש ב-{`{{slug}}`} לערכי שדות</p>
        </div>
      )}

      {action.type === 'start_sequence' && (
        <select
          value={config.sequence_id || ''}
          onChange={e => onChange({ ...config, sequence_id: e.target.value })}
          className="input-field !text-xs !py-1.5"
        >
          <option value="">— סדרה —</option>
          {sequences.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
    </div>
  );
}

function actionLabel(type: string): string {
  switch (type) {
    case 'create_record': return '➕ צור רשומה בטבלה';
    case 'update_field': return '✏️ עדכן שדה';
    case 'send_whatsapp': return '💬 שלח WhatsApp';
    case 'start_sequence': return '🔁 הפעל סדרה';
    case 'notify_user': return '🔔 התרע למשתמש';
    default: return type;
  }
}

// ============================================================================
// SEQUENCE EDITOR (simpler - just steps)
// ============================================================================
function SequenceEditor({ workspace, tables, editing, onClose, onSaved }: any) {
  const [name, setName] = useState(editing?.name || '');
  const [description, setDescription] = useState(editing?.description || '');
  const [steps, setSteps] = useState<any[]>(editing?.steps || [{
    delay_days: 0,
    delay_hours: 0,
    channel: 'whatsapp',
    phone_field: 'phone',
    message_template: '',
  }]);
  const [exitOnReply, setExitOnReply] = useState(editing?.exit_on_reply ?? true);
  const [exitOnUnsubscribe, setExitOnUnsubscribe] = useState(editing?.exit_on_unsubscribe ?? true);
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateStep(i: number, patch: any) {
    setSteps(steps.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }

  function addStep() {
    setSteps([...steps, { delay_days: 1, delay_hours: 0, channel: 'whatsapp', phone_field: 'phone', message_template: '' }]);
  }

  function removeStep(i: number) {
    setSteps(steps.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) return setError('שם חובה');
    if (steps.length === 0) return setError('לפחות שלב אחד');
    if (steps.some(s => !s.message_template?.trim())) return setError('כל שלב חייב הודעה');

    setSaving(true);
    const body = {
      workspace_id: workspace.id,
      name: name.trim(),
      description: description.trim() || null,
      steps,
      exit_on_reply: exitOnReply,
      exit_on_unsubscribe: exitOnUnsubscribe,
      exit_on_status_change: [],
      enabled,
    };
    const url = editing ? `/api/sequences/${editing.id}` : '/api/sequences';
    const method = editing ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'שמירה נכשלה');
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50">
      <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-display font-bold text-lg">🔁 {editing ? 'עריכת סדרה' : 'סדרה חדשה'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-1.5">שם הסדרה</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder='למשל: "ברוך הבא ללקוח חדש"' className="input-field" autoFocus />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">תיאור (אופציונלי)</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="input-field" />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">שלבי הסדרה</label>
            {steps.map((step, i) => (
              <div key={i} className="p-4 mb-2 rounded-xl border-2 border-purple-200 bg-purple-50/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-purple-900">📍 שלב {i + 1}</div>
                  {steps.length > 1 && (
                    <button onClick={() => removeStep(i)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="block text-[10px] font-medium mb-0.5">המתן ימים</label>
                    <input type="number" min="0" value={step.delay_days || 0} onChange={e => updateStep(i, { delay_days: parseInt(e.target.value) || 0 })} className="input-field !text-xs !py-1.5" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium mb-0.5">+ שעות</label>
                    <input type="number" min="0" max="23" value={step.delay_hours || 0} onChange={e => updateStep(i, { delay_hours: parseInt(e.target.value) || 0 })} className="input-field !text-xs !py-1.5" />
                  </div>
                </div>
                <div className="mb-2">
                  <label className="block text-[10px] font-medium mb-0.5">שדה הטלפון ברשומה</label>
                  <input type="text" dir="ltr" value={step.phone_field || 'phone'} onChange={e => updateStep(i, { phone_field: e.target.value })} className="input-field !text-xs !py-1.5" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium mb-0.5">{t('common.message') || 'הודעה'}</label>
                  <textarea
                    rows={3}
                    value={step.message_template || ''}
                    onChange={e => updateStep(i, { message_template: e.target.value })}
                    placeholder="שלום {{name}}!"
                    className="input-field !text-xs"
                  />
                </div>
              </div>
            ))}
            <button onClick={addStep} className="w-full p-3 rounded-xl border-2 border-dashed border-purple-300 hover:border-purple-500 hover:bg-purple-50 text-sm text-purple-700 font-medium">
              + הוסף שלב
            </button>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">תנאי יציאה אוטומטית</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                <input type="checkbox" checked={exitOnReply} onChange={e => setExitOnReply(e.target.checked)} className="w-4 h-4 rounded" />
                <span className="text-sm">עצור אם הלקוח השיב בוואטסאפ</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                <input type="checkbox" checked={exitOnUnsubscribe} onChange={e => setExitOnUnsubscribe(e.target.checked)} className="w-4 h-4 rounded" />
                <span className="text-sm">עצור אם הלקוח אמר "תעצור"</span>
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="w-4 h-4 rounded text-brand-600" />
            <span className="text-sm">הפעל את הסדרה מיד אחרי שמירה</span>
          </label>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-800 flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex justify-end gap-2 bg-gray-50/50">
          <button onClick={onClose} className="btn-secondary text-sm">{t('common.cancel')}</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
            {saving ? 'שומר...' : (editing ? 'שמור' : 'צור סדרה')}
          </button>
        </div>
      </div>
    </div>
  );
}
