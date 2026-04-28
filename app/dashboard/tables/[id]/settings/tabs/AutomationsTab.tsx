'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Loader2, Power, Trash2, Edit2, Sparkles, Clock, Zap,
  CheckCircle2, XCircle, AlertCircle, History, X, ArrowLeft,
} from 'lucide-react';
import type { TableData, FieldData } from '../TableSettingsClient';

// ─── Types ──────────────────────────────────────────────────────────────────
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

type Preset = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: string;
  applicable: boolean;
  missing_field_types: string[];
  template: any;
};

type Run = {
  id: string;
  workflow_id: string;
  ran_at: string;
  success: boolean;
  error_message: string | null;
  duration_ms: number;
};

// ─── Component ──────────────────────────────────────────────────────────────
export default function AutomationsTab({
  table, fields, setError, disabled,
}: {
  table: TableData;
  fields: FieldData[];
  setError: (msg: string | null) => void;
  disabled: boolean;
}) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [recentRuns, setRecentRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPresets, setShowPresets] = useState(false);
  const [editing, setEditing] = useState<Workflow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wfRes, presetsRes] = await Promise.all([
        fetch(`/api/workflows?workspace_id=${table.workspace_id}&table_id=${table.id}`).then(r => r.json()),
        fetch(`/api/workflows/presets?table_id=${table.id}`).then(r => r.json()),
      ]);
      setWorkflows(wfRes.workflows || []);
      setRecentRuns(wfRes.recent_runs || []);
      setPresets(presetsRes.presets || []);
    } catch (e: any) {
      setError(e?.message || 'שגיאה בטעינת אוטומציות');
    } finally {
      setLoading(false);
    }
  }, [table.id, table.workspace_id, setError]);

  useEffect(() => { load(); }, [load]);

  // ───────── Actions ─────────
  async function toggleEnabled(wf: Workflow) {
    try {
      const res = await fetch(`/api/workflows/${wf.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !wf.enabled }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setWorkflows((ws) => ws.map((w) => w.id === wf.id ? { ...w, enabled: !w.enabled } : w));
    } catch (e: any) {
      setError(e?.message || 'שגיאה');
    }
  }

  async function deleteWorkflow(wf: Workflow) {
    if (!confirm(`למחוק את האוטומציה "${wf.name}"?`)) return;
    try {
      const res = await fetch(`/api/workflows/${wf.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
      setWorkflows((ws) => ws.filter((w) => w.id !== wf.id));
    } catch (e: any) {
      setError(e?.message || 'שגיאה במחיקה');
    }
  }

  async function instantiatePreset(preset: Preset) {
    setShowPresets(false);
    try {
      const settings = table.settings || {};
      const phoneField = settings.phone_field_slug || autoDetect(fields, 'phone');
      const datetimeField = settings.datetime_field_slug || autoDetect(fields, 'datetime');

      const res = await fetch('/api/workflows/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: table.workspace_id,
          table_id: table.id,
          preset_id: preset.id,
          phone_field_slug: phoneField,
          datetime_field_slug: datetimeField,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed');
      load();
    } catch (e: any) {
      setError(e?.message || 'שגיאה ביצירת האוטומציה');
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  // ───────── Render ─────────
  return (
    <div className="space-y-6">
      {/* Empty state when no workflows */}
      {workflows.length === 0 && !showPresets && (
        <div className="rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/50 p-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-violet-100 flex items-center justify-center mb-3">
            <Sparkles className="h-6 w-6 text-violet-600" />
          </div>
          <h3 className="font-semibold text-slate-900">אין עדיין אוטומציות בטבלה</h3>
          <p className="mt-1 text-sm text-slate-600">
            התחל מתבניות מוכנות — תזכורות, אישורים, התראות אוטומטיות
          </p>
          <button
            onClick={() => setShowPresets(true)}
            disabled={disabled}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            הוסף אוטומציה ראשונה
          </button>
        </div>
      )}

      {/* Active workflows list */}
      {workflows.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">אוטומציות פעילות ({workflows.length})</h2>
            <button
              onClick={() => setShowPresets(true)}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              הוסף אוטומציה
            </button>
          </div>

          <div className="space-y-2">
            {workflows.map((wf) => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                runs={recentRuns.filter((r) => r.workflow_id === wf.id)}
                disabled={disabled}
                onToggle={() => toggleEnabled(wf)}
                onEdit={() => setEditing(wf)}
                onDelete={() => deleteWorkflow(wf)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Presets picker (overlay) */}
      {showPresets && (
        <PresetPicker
          presets={presets}
          onClose={() => setShowPresets(false)}
          onPick={instantiatePreset}
        />
      )}

      {/* Workflow editor (overlay) */}
      {editing && (
        <WorkflowEditor
          workflow={editing}
          fields={fields}
          tableSettings={table.settings || {}}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setWorkflows((ws) => ws.map((w) => w.id === updated.id ? updated : w));
            setEditing(null);
          }}
          setError={setError}
        />
      )}
    </div>
  );
}

// ─── Workflow Card ──────────────────────────────────────────────────────────
function WorkflowCard({
  workflow, runs, disabled, onToggle, onEdit, onDelete,
}: {
  workflow: Workflow;
  runs: Run[];
  disabled: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const lastRun = runs[0];
  const successCount = runs.filter((r) => r.success).length;
  const failCount = runs.filter((r) => !r.success).length;

  const triggerLabel = describeTrigger(workflow.trigger_type, workflow.trigger_config);
  const actionLabels = (workflow.actions || []).map((a) => describeAction(a));

  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm transition ${
      workflow.enabled ? 'border-slate-200' : 'border-slate-200 opacity-60'
    }`}>
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
          workflow.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
        }`}>
          {workflow.trigger_type === 'time_before_field' ? <Clock className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-slate-900">{workflow.name}</div>
              {workflow.description && (
                <div className="text-xs text-slate-500 mt-0.5">{workflow.description}</div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={onToggle}
                disabled={disabled}
                title={workflow.enabled ? 'השבת' : 'הפעל'}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm transition disabled:opacity-50 ${
                  workflow.enabled
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <Power className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onEdit}
                disabled={disabled}
                title="ערוך"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={onDelete}
                disabled={disabled}
                title="מחק"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Trigger + Actions summary */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-md bg-violet-50 px-2 py-0.5 text-violet-700 font-medium">{triggerLabel}</span>
            <ArrowLeft className="h-3 w-3 text-slate-300" />
            {actionLabels.map((a, i) => (
              <span key={i} className="rounded-md bg-blue-50 px-2 py-0.5 text-blue-700 font-medium">{a}</span>
            ))}
          </div>

          {/* Stats */}
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <History className="h-3 w-3" />
              {workflow.run_count} ריצות
            </span>
            {successCount > 0 && (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> {successCount}
              </span>
            )}
            {failCount > 0 && (
              <span className="inline-flex items-center gap-1 text-rose-700">
                <XCircle className="h-3 w-3" /> {failCount}
              </span>
            )}
            {lastRun && (
              <span className="text-slate-400">· אחרונה: {timeAgo(lastRun.ran_at)}</span>
            )}
          </div>

          {workflow.last_error && (
            <div className="mt-2 flex items-start gap-1.5 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-800">
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
              <span className="font-mono">{workflow.last_error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Preset Picker ──────────────────────────────────────────────────────────
function PresetPicker({
  presets, onClose, onPick,
}: {
  presets: Preset[];
  onClose: () => void;
  onPick: (p: Preset) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 sticky top-0 bg-white">
          <h3 className="font-semibold text-slate-900">בחר תבנית אוטומציה</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {presets.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <p>אין תבניות מתאימות לטבלה זו.</p>
              <p className="text-xs mt-2">ייתכן שחסרים שדות (טלפון/תאריך)</p>
            </div>
          )}

          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => preset.applicable && onPick(preset)}
              disabled={!preset.applicable}
              className={`w-full text-right rounded-xl border p-4 transition ${
                preset.applicable
                  ? 'border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/50 cursor-pointer'
                  : 'border-slate-100 bg-slate-50 cursor-not-allowed opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl shrink-0">{preset.emoji}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900">{preset.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{preset.description}</div>
                  {!preset.applicable && (
                    <div className="mt-2 text-xs text-amber-700 inline-flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      חסר: {preset.missing_field_types.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Workflow Editor (basic: name + description + message template) ────────
function WorkflowEditor({
  workflow, fields, tableSettings, onClose, onSaved, setError,
}: {
  workflow: Workflow;
  fields: FieldData[];
  tableSettings: any;
  onClose: () => void;
  onSaved: (wf: Workflow) => void;
  setError: (msg: string | null) => void;
}) {
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description || '');
  const [actions, setActions] = useState(workflow.actions);
  const [offsetMinutes, setOffsetMinutes] = useState(
    workflow.trigger_type === 'time_before_field' ? Number(workflow.trigger_config?.offset_minutes || 0) : 0
  );
  const [saving, setSaving] = useState(false);

  // For now, only support editing the message template of the first send_whatsapp action.
  const firstWhatsAppIdx = actions.findIndex((a) => a.type === 'send_whatsapp' || a.type === 'notify_user');
  const messageTemplate = firstWhatsAppIdx >= 0 ? (actions[firstWhatsAppIdx].config?.message_template || actions[firstWhatsAppIdx].config?.message || '') : '';

  function setMessage(newMsg: string) {
    if (firstWhatsAppIdx < 0) return;
    const updated = [...actions];
    updated[firstWhatsAppIdx] = {
      ...updated[firstWhatsAppIdx],
      config: { ...updated[firstWhatsAppIdx].config, message_template: newMsg },
    };
    setActions(updated);
  }

  async function save() {
    setSaving(true);
    try {
      const body: any = { name, description, actions };
      if (workflow.trigger_type === 'time_before_field') {
        body.trigger_config = { ...workflow.trigger_config, offset_minutes: offsetMinutes };
      }
      const res = await fetch(`/api/workflows/${workflow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.workflow);
    } catch (e: any) {
      setError(e?.message || 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  }

  // Available variables for the message template
  const availableVars = fields.map((f) => `{${f.slug}}`).slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 sticky top-0 bg-white">
          <h3 className="font-semibold text-slate-900">עריכת אוטומציה</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">שם האוטומציה</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">תיאור</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            />
          </div>

          {workflow.trigger_type === 'time_before_field' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                כמה זמן לפני? (בדקות)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={offsetMinutes}
                  onChange={(e) => setOffsetMinutes(Number(e.target.value))}
                  className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <span className="text-sm text-slate-500">דקות לפני שעת הפגישה</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                30 = חצי שעה, 60 = שעה, 1440 = יום, 10080 = שבוע
              </div>
            </div>
          )}

          {firstWhatsAppIdx >= 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">תבנית ההודעה</label>
              <textarea
                value={messageTemplate}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 font-mono"
                placeholder="שלום! פגישה נקבעה איתך..."
              />
              <div className="mt-2">
                <div className="text-xs text-slate-500 mb-1">משתנים זמינים (לחץ להוספה):</div>
                <div className="flex flex-wrap gap-1">
                  {availableVars.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMessage(messageTemplate + ' ' + v)}
                      className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700 hover:bg-violet-100 hover:text-violet-800"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">בטל</button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            שמור
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function describeTrigger(type: string, config: any): string {
  switch (type) {
    case 'record_created': return '🆕 ביצירת רשומה';
    case 'record_updated': return '✏️ בעדכון רשומה';
    case 'field_changed': return `🔄 בשינוי ${config?.field_slug || 'שדה'}`;
    case 'time_before_field': {
      const mins = Number(config?.offset_minutes || 0);
      if (mins >= 1440) return `⏰ ${mins / 1440} ימים לפני`;
      if (mins >= 60) return `⏰ ${mins / 60} שעות לפני`;
      return `⏰ ${mins} דק׳ לפני`;
    }
    default: return type;
  }
}

function describeAction(action: any): string {
  switch (action.type) {
    case 'send_whatsapp': return '💬 שליחת WhatsApp';
    case 'notify_user': return '🔔 התראה';
    case 'update_field': return `📝 עדכון ${action.config?.field_slug || 'שדה'}`;
    case 'create_record': return '➕ יצירת רשומה';
    case 'start_sequence': return '🔄 התחלת רצף';
    default: return action.type;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'עכשיו';
  if (mins < 60) return `לפני ${mins} דק׳`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}

function autoDetect(fields: FieldData[], type: 'phone' | 'datetime'): string | null {
  if (type === 'phone') {
    return fields.find((f) => f.type === 'phone')?.slug
      || fields.find((f) => f.slug.toLowerCase().includes('phone'))?.slug
      || null;
  }
  if (type === 'datetime') {
    return fields.find((f) => f.type === 'datetime')?.slug
      || fields.find((f) => f.slug === 'scheduled_at')?.slug
      || null;
  }
  return null;
}
