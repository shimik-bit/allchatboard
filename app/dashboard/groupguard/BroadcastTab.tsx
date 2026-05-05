'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Send, Calendar, Clock, Users, Loader2, X, Search,
  CheckCircle2, XCircle, Trash2, AlertCircle, RefreshCcw, Plus,
  Sparkles, Wand2,
} from 'lucide-react';
import { useT } from '@/lib/i18n/useT';

/**
 * BroadcastTab — admin-only UI for broadcasting + deleting WhatsApp messages.
 *
 * Three sub-tabs:
 *   1. "פרסום חדש" — compose form: text + group picker + delay + scheduling
 *   2. "היסטוריה" — list of past/active broadcast jobs with status + counts
 *   3. "מחיקות" — list of past/active delete jobs (and their progress)
 *
 * Live status: jobs in 'running' state poll every 5 seconds for fresh
 * counters. Stops polling once status reaches a terminal state.
 */

type BroadcastJob = {
  id: string;
  message_text: string;
  delay_seconds: number;
  scheduled_at: string | null;
  status: 'pending' | 'running' | 'done' | 'cancelled' | 'failed';
  total_targets: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  last_error: string | null;
};

type DeleteJob = {
  id: string;
  kind: 'broadcast' | 'manual';
  source_broadcast_id: string | null;
  delay_seconds: number;
  scheduled_at: string | null;
  status: 'pending' | 'running' | 'done' | 'cancelled' | 'failed';
  total_targets: number;
  deleted_count: number;
  failed_count: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  last_error: string | null;
};

type Group = {
  id: string;
  group_name: string | null;
  green_api_chat_id: string;
  is_active: boolean;
  members_count: number | null;
};

type SubTab = 'compose' | 'history' | 'deletions';

export default function BroadcastTab({ workspaceId }: { workspaceId: string }) {
  const { t } = useT();
  const [subTab, setSubTab] = useState<SubTab>('compose');

  return (
    <div dir="rtl" className="space-y-4">
      {/* Sub-tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        <SubTabBtn active={subTab === 'compose'} onClick={() => setSubTab('compose')}>
          <Send className="w-4 h-4" />
          <span>{t('groupguard.broadcast.tab_new')}</span>
        </SubTabBtn>
        <SubTabBtn active={subTab === 'history'} onClick={() => setSubTab('history')}>
          <Clock className="w-4 h-4" />
          <span>{t('groupguard.broadcast.tab_history')}</span>
        </SubTabBtn>
        <SubTabBtn active={subTab === 'deletions'} onClick={() => setSubTab('deletions')}>
          <Trash2 className="w-4 h-4" />
          <span>{t('groupguard.broadcast.tab_deletes')}</span>
        </SubTabBtn>
      </div>

      {subTab === 'compose' && <ComposeView workspaceId={workspaceId} onCreated={() => setSubTab('history')} />}
      {subTab === 'history' && <HistoryView workspaceId={workspaceId} />}
      {subTab === 'deletions' && <DeletionsView workspaceId={workspaceId} />}
    </div>
  );
}

function SubTabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors ${
        active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compose: create a new broadcast
// ─────────────────────────────────────────────────────────────────────────────

function ComposeView({ workspaceId, onCreated }: { workspaceId: string; onCreated: () => void }) {
  const { t } = useT();
  const [message, setMessage] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(30);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState(''); // datetime-local string
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupSearch, setGroupSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // AI compose modal state. Opens when the user clicks "✨ כתוב עם AI"
  // above the message textarea. Picking a draft from the modal copies it
  // into the textarea and closes the modal.
  const [aiOpen, setAiOpen] = useState(false);

  // Load groups for the picker. Active only — sending to inactive groups
  // is almost always a mistake.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setGroupsLoading(true);
      try {
        const res = await fetch(`/api/groupguard/groups?workspace_id=${workspaceId}`);
        const json = await res.json();
        if (cancelled) return;
        setGroups((json.groups || []).filter((g: Group) => g.is_active));
      } catch {
        // Silent — the empty list and the disabled submit button are signal enough
      } finally {
        if (!cancelled) setGroupsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workspaceId]);

  const filteredGroups = groups.filter((g) => {
    if (!groupSearch.trim()) return true;
    return (g.group_name || '').toLowerCase().includes(groupSearch.toLowerCase());
  });

  function toggleGroup(id: string) {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAll() {
    setSelectedGroupIds(new Set(filteredGroups.map((g) => g.id)));
  }
  function selectNone() {
    setSelectedGroupIds(new Set());
  }

  // Estimate: total time = (groups - 1) * delay
  const estimatedMinutes = selectedGroupIds.size > 1
    ? Math.ceil(((selectedGroupIds.size - 1) * delaySeconds) / 60)
    : 0;

  async function handleSubmit() {
    setError(null);
    setSuccess(null);
    if (!message.trim()) {
      setError('יש להזין טקסט להודעה');
      return;
    }
    if (selectedGroupIds.size === 0) {
      setError('בחר לפחות קבוצה אחת');
      return;
    }
    if (scheduleEnabled && !scheduledAt) {
      setError('בחר תאריך ושעה לתזמון');
      return;
    }

    setSubmitting(true);
    try {
      const body: any = {
        workspace_id: workspaceId,
        message_text: message.trim(),
        group_ids: Array.from(selectedGroupIds),
        delay_seconds: delaySeconds,
      };
      // datetime-local has no timezone — interpret as local; new Date() picks up the user's TZ
      if (scheduleEnabled && scheduledAt) {
        const d = new Date(scheduledAt);
        if (isNaN(d.getTime())) {
          setError('תאריך לא תקין');
          setSubmitting(false);
          return;
        }
        body.scheduled_at = d.toISOString();
      }

      const res = await fetch('/api/whatsapp/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'שליחה נכשלה');
        return;
      }

      setSuccess(
        scheduleEnabled
          ? `התזמון נשמר! ${selectedGroupIds.size} קבוצות יקבלו את ההודעה החל מ-${new Date(scheduledAt).toLocaleString('he-IL')}`
          : `הפרסום החל! ${selectedGroupIds.size} קבוצות בתור.`
      );
      // Reset form
      setMessage('');
      setSelectedGroupIds(new Set());
      setScheduleEnabled(false);
      setScheduledAt('');
      // Auto-jump to history after a moment so they see the running job
      setTimeout(() => onCreated(), 1500);
    } catch (e: any) {
      setError(e?.message || 'שגיאת רשת');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Message text */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-semibold text-gray-700">
            הודעה <span className="text-red-500">*</span>
            <span className="text-xs text-gray-400 font-normal mr-2">{message.length}/4096</span>
          </label>
          {/* AI assist — opens a modal that takes a topic and returns 3 drafts */}
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="text-xs text-purple-600 hover:text-purple-800 font-semibold flex items-center gap-1 px-2 py-1 rounded hover:bg-purple-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{message.trim() ? t('groupguard.broadcast.ai_improve') : t('groupguard.broadcast.ai_compose')}</span>
          </button>
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={4096}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
          placeholder="כתוב את ההודעה כאן... תומך באמוג׳ים ובעברית 😊"
        />
      </div>

      {/* AI compose modal */}
      {aiOpen && (
        <AIComposeModal
          workspaceId={workspaceId}
          initialTopic={message.trim()} // pre-fill from the textarea if there's already text
          onClose={() => setAiOpen(false)}
          onPick={(text) => {
            setMessage(text);
            setAiOpen(false);
          }}
        />
      )}

      {/* Group picker */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-semibold text-gray-700">
            קבוצות יעד <span className="text-red-500">*</span>
            <span className="text-xs text-gray-400 font-normal mr-2">
              {selectedGroupIds.size} מסומנות
            </span>
          </label>
          <div className="flex gap-2 text-xs">
            <button onClick={selectAll} className="text-purple-600 hover:text-purple-800 font-semibold">
              בחר הכל
            </button>
            <button onClick={selectNone} className="text-gray-500 hover:text-gray-700">
              נקה
            </button>
          </div>
        </div>
        {/* Search */}
        <div className="relative mb-2">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
            className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
            placeholder="חפש קבוצה..."
          />
        </div>
        <div className="border border-gray-200 rounded-lg max-h-72 overflow-y-auto">
          {groupsLoading ? (
            <div className="p-4 text-center text-sm text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin inline-block ml-2" />
              טוען קבוצות...
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              {groupSearch ? 'לא נמצאו קבוצות תואמות' : 'אין קבוצות פעילות. סרוק קבוצות בטאב "קבוצות".'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredGroups.map((g) => {
                const checked = selectedGroupIds.has(g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => toggleGroup(g.id)}
                    className={`w-full text-right px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50 ${checked ? 'bg-purple-50' : ''}`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                      checked ? 'border-purple-500 bg-purple-500' : 'border-gray-300 bg-white'
                    }`}>
                      {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0 text-right">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {g.group_name || 'קבוצה ללא שם'}
                      </div>
                      {g.members_count != null && (
                        <div className="text-xs text-gray-500">
                          {g.members_count} משתתפים
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delay */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          {t('groupguard.broadcast.delay_label')}
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            min={0}
            max={3600}
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(Math.max(0, Math.min(3600, parseInt(e.target.value) || 0)))}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:border-purple-500"
          />
          <div className="flex gap-1">
            {[5, 15, 30, 60, 120].map((s) => (
              <button
                key={s}
                onClick={() => setDelaySeconds(s)}
                className={`px-2 py-1 text-xs rounded border ${
                  delaySeconds === s
                    ? 'bg-purple-500 text-white border-purple-500'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {s}s
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          ⚠️ פחות מ-15 שניות עלול להיתפס כספאם. מומלץ 30 שניות ומעלה.
        </p>
      </div>

      {/* Schedule */}
      <div>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2 cursor-pointer">
          <input
            type="checkbox"
            checked={scheduleEnabled}
            onChange={(e) => setScheduleEnabled(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <Calendar className="w-4 h-4" />
          תזמן לעתיד
        </label>
        {scheduleEnabled && (
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
          />
        )}
      </div>

      {/* Estimate */}
      {selectedGroupIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-900">
          <div className="font-semibold mb-1">סיכום:</div>
          <div className="text-xs space-y-0.5">
            <div>• {selectedGroupIds.size} קבוצות יקבלו את ההודעה</div>
            {estimatedMinutes > 0 && (
              <div>• זמן משוער לסיום: ~{estimatedMinutes} דקות (עם השהייה של {delaySeconds}ש בין הודעה להודעה)</div>
            )}
            {scheduleEnabled && scheduledAt && (
              <div>• תזמן ל-{new Date(scheduledAt).toLocaleString('he-IL')}</div>
            )}
          </div>
        </div>
      )}

      {/* Error/success */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          {success}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting || !message.trim() || selectedGroupIds.size === 0}
        className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            שולח...
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            {scheduleEnabled ? 'תזמן פרסום' : 'שלח עכשיו'}
          </>
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// History: list of broadcast jobs with live status
// ─────────────────────────────────────────────────────────────────────────────

function HistoryView({ workspaceId }: { workspaceId: string }) {
  const [jobs, setJobs] = useState<BroadcastJob[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/whatsapp/broadcasts?workspace_id=${workspaceId}`);
      const json = await res.json();
      setJobs(json.jobs || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  // Live polling: if any job is in pending/running state, refresh every 5s.
  // We auto-stop polling when nothing's active so we don't hammer the API.
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'pending' || j.status === 'running');
    if (!hasActive) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [jobs, load]);

  async function cancelJob(id: string) {
    if (!confirm('לבטל את הפרסום? הודעות שכבר נשלחו לא יחזרו אחורה.')) return;
    await fetch(`/api/whatsapp/broadcasts/${id}`, { method: 'DELETE' });
    load();
  }

  async function startDeleteFromBroadcast(broadcastId: string) {
    if (!confirm('למחוק את כל ההודעות שנשלחו בפרסום הזה?')) return;
    const res = await fetch('/api/whatsapp/delete-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: workspaceId,
        kind: 'broadcast',
        source_broadcast_id: broadcastId,
        delay_seconds: 5,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || 'שגיאה');
      return;
    }
    alert(`עבודת מחיקה נוצרה (${json.total_targets} הודעות).`);
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500"><Loader2 className="w-5 h-5 animate-spin inline ml-2" />טוען...</div>;
  }
  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <Send className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <div className="text-sm text-gray-500">עדיין לא ביצעת פרסום.</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">{jobs.length} עבודות אחרונות</div>
        <button onClick={load} className="text-purple-600 hover:text-purple-800 text-sm flex items-center gap-1">
          <RefreshCcw className="w-3.5 h-3.5" />
          רענן
        </button>
      </div>
      {jobs.map((j) => (
        <JobCard
          key={j.id}
          job={j}
          onCancel={() => cancelJob(j.id)}
          onDeleteAll={() => startDeleteFromBroadcast(j.id)}
        />
      ))}
    </div>
  );
}

function JobCard({ job, onCancel, onDeleteAll }: { job: BroadcastJob; onCancel: () => void; onDeleteAll: () => void }) {
  const isActive = job.status === 'pending' || job.status === 'running';
  const isDone = job.status === 'done';
  const progress = job.total_targets > 0
    ? Math.round(((job.sent_count + job.failed_count) / job.total_targets) * 100)
    : 0;

  const statusInfo = {
    pending: { label: 'ממתין', color: 'bg-yellow-100 text-yellow-800' },
    running: { label: 'בריצה', color: 'bg-blue-100 text-blue-800' },
    done: { label: 'הושלם', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'בוטל', color: 'bg-gray-100 text-gray-700' },
    failed: { label: 'נכשל', color: 'bg-red-100 text-red-800' },
  }[job.status];

  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-white">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 line-clamp-2 whitespace-pre-wrap">
            {job.message_text}
          </div>
          <div className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full font-semibold text-xs ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            <span>{new Date(job.created_at).toLocaleString('he-IL')}</span>
            {job.scheduled_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(job.scheduled_at).toLocaleString('he-IL')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {(isActive || job.sent_count > 0 || job.failed_count > 0) && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>{job.sent_count + job.failed_count} מתוך {job.total_targets}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${job.failed_count > 0 ? 'bg-yellow-500' : 'bg-green-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {job.failed_count > 0 && (
            <div className="text-xs text-red-600 mt-1">⚠️ {job.failed_count} נכשלו</div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap text-xs">
        {isActive && (
          <button onClick={onCancel} className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-gray-700">
            <XCircle className="w-3.5 h-3.5 inline ml-1" />
            בטל
          </button>
        )}
        {isDone && job.sent_count > 0 && (
          <button onClick={onDeleteAll} className="px-2 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5 inline ml-1" />
            מחק את כל ההודעות שנשלחו
          </button>
        )}
      </div>

      {job.last_error && (
        <div className="mt-2 text-xs text-red-700 bg-red-50 px-2 py-1 rounded">
          שגיאה: {job.last_error}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Deletions: list of delete jobs
// ─────────────────────────────────────────────────────────────────────────────

function DeletionsView({ workspaceId }: { workspaceId: string }) {
  const [jobs, setJobs] = useState<DeleteJob[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/whatsapp/delete-jobs?workspace_id=${workspaceId}`);
      const json = await res.json();
      setJobs(json.jobs || []);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'pending' || j.status === 'running');
    if (!hasActive) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [jobs, load]);

  async function cancelJob(id: string) {
    if (!confirm('לבטל את עבודת המחיקה?')) return;
    await fetch(`/api/whatsapp/delete-jobs/${id}`, { method: 'DELETE' });
    load();
  }

  if (loading) return <div className="text-center py-8 text-gray-500"><Loader2 className="w-5 h-5 animate-spin inline ml-2" />טוען...</div>;
  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <Trash2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <div className="text-sm text-gray-500">אין עבודות מחיקה.</div>
        <div className="text-xs text-gray-400 mt-1">
          כדי למחוק הודעות, עבור לטאב "היסטוריה" ובחר עבודת פרסום שהושלמה.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">{jobs.length} עבודות מחיקה</div>
        <button onClick={load} className="text-purple-600 hover:text-purple-800 text-sm flex items-center gap-1">
          <RefreshCcw className="w-3.5 h-3.5" />
          רענן
        </button>
      </div>
      {jobs.map((j) => (
        <DeleteJobCard key={j.id} job={j} onCancel={() => cancelJob(j.id)} />
      ))}
    </div>
  );
}

function DeleteJobCard({ job, onCancel }: { job: DeleteJob; onCancel: () => void }) {
  const isActive = job.status === 'pending' || job.status === 'running';
  const progress = job.total_targets > 0
    ? Math.round(((job.deleted_count + job.failed_count) / job.total_targets) * 100)
    : 0;
  const statusInfo = {
    pending: { label: 'ממתין', color: 'bg-yellow-100 text-yellow-800' },
    running: { label: 'מוחק', color: 'bg-blue-100 text-blue-800' },
    done: { label: 'הושלם', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'בוטל', color: 'bg-gray-100 text-gray-700' },
    failed: { label: 'נכשל', color: 'bg-red-100 text-red-800' },
  }[job.status];

  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-white">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900">
            {job.kind === 'broadcast' ? '🗑️ מחיקת פרסום שלם' : '🗑️ מחיקה ידנית'}
          </div>
          <div className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full font-semibold text-xs ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            <span>{new Date(job.created_at).toLocaleString('he-IL')}</span>
            <span>{job.total_targets} הודעות</span>
          </div>
        </div>
      </div>

      {(isActive || job.deleted_count > 0 || job.failed_count > 0) && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>{job.deleted_count + job.failed_count} מתוך {job.total_targets}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
          {job.failed_count > 0 && (
            <div className="text-xs text-red-600 mt-1">⚠️ {job.failed_count} נכשלו</div>
          )}
        </div>
      )}

      {isActive && (
        <button onClick={onCancel} className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 text-xs text-gray-700">
          <XCircle className="w-3.5 h-3.5 inline ml-1" />
          בטל
        </button>
      )}

      {job.last_error && (
        <div className="mt-2 text-xs text-red-700 bg-red-50 px-2 py-1 rounded">{job.last_error}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Compose modal — give it a topic, get 3 drafts back
// ─────────────────────────────────────────────────────────────────────────────

type Draft = { label: string; body: string; length_chars: number };
type ToneChoice = 'auto' | 'formal' | 'friendly' | 'energetic';
type LengthChoice = 'short' | 'medium' | 'long';

const TONE_LABELS: Record<ToneChoice, string> = {
  auto: 'אוטומטי (3 נימות)',
  formal: 'רשמי',
  friendly: 'ידידותי',
  energetic: 'אנרגטי',
};

const LENGTH_LABELS: Record<LengthChoice, string> = {
  short: 'קצר',
  medium: 'בינוני',
  long: 'ארוך',
};

function AIComposeModal({
  workspaceId,
  initialTopic,
  onClose,
  onPick,
}: {
  workspaceId: string;
  initialTopic: string;
  onClose: () => void;
  onPick: (text: string) => void;
}) {
  // If there's existing text in the message, treat it as the starting topic
  // and label the action "improve". Otherwise the user is starting fresh.
  const [topic, setTopic] = useState(initialTopic);
  const [tone, setTone] = useState<ToneChoice>('auto');
  const [length, setLength] = useState<LengthChoice>('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  async function handleGenerate() {
    if (!topic.trim()) {
      setError('כתוב נושא או רעיון קצר');
      return;
    }
    setError(null);
    setLoading(true);
    setDrafts([]);
    try {
      const res = await fetch('/api/whatsapp/compose-with-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          topic: topic.trim(),
          tone,
          length,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'AI שגיאה');
        return;
      }
      setDrafts(json.drafts || []);
    } catch (e: any) {
      setError(e?.message || 'שגיאת רשת');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg h-[90vh] sm:h-auto sm:max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">כתיבה עם AI</h2>
              <p className="text-xs text-gray-500">תן לי כותרת — אני כותב את ההודעה</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="סגור">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              נושא ההודעה <span className="text-red-500">*</span>
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={500}
              rows={3}
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
              placeholder="לדוגמה: הנחת חורף 20% על כל המוצרים עד יום שישי"
            />
            <div className="text-xs text-gray-400 mt-0.5">{topic.length}/500</div>
          </div>

          {/* Tone + Length pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">נימה</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as ToneChoice)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-500 bg-white"
              >
                {(['auto', 'formal', 'friendly', 'energetic'] as ToneChoice[]).map((t) => (
                  <option key={t} value={t}>{TONE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">אורך</label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as LengthChoice)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-500 bg-white"
              >
                {(['short', 'medium', 'long'] as LengthChoice[]).map((l) => (
                  <option key={l} value={l}>{LENGTH_LABELS[l]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Generate button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-bold text-base hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 hover:shadow-xl hover:shadow-purple-600/40 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                כותב...
              </>
            ) : drafts.length > 0 ? (
              <>
                <RefreshCcw className="w-4 h-4" />
                צור שוב
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                צור ניסוחים
              </>
            )}
          </button>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Drafts list */}
          {drafts.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-700">בחר גרסה:</div>
              {drafts.map((d, i) => (
                <button
                  key={i}
                  onClick={() => onPick(d.body)}
                  className="w-full text-right border border-gray-200 hover:border-purple-400 hover:bg-purple-50 rounded-lg p-3 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-purple-700">
                      {d.label}
                    </span>
                    <span className="text-xs text-gray-400">{d.length_chars} תווים</span>
                  </div>
                  <div className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                    {d.body}
                  </div>
                </button>
              ))}
              <div className="text-xs text-gray-500 text-center pt-1">
                לחץ על גרסה כדי להעתיק אותה לטקסט הראשי
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
