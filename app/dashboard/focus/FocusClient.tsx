'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles, Loader2, RefreshCw, Settings, Phone, MessageSquare,
  Calendar, FileText, CheckCircle2, Clock, X, ArrowRight, ArrowLeft,
  Flame, AlertCircle, Lightbulb, Target, Coffee, Send, ExternalLink,
  Save, Edit2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type Membership = {
  workspace_id: string;
  role: string;
  workspaces: { id: string; name: string; icon: string | null };
};

type Role = {
  id: string;
  role_title: string | null;
  role_description: string | null;
};

type BriefingTask = {
  title: string;
  reason: string;
  table_name?: string;
  record_id?: string;
  priority: 'critical' | 'high' | 'medium' | 'suggestion';
  action_hint?: string;
  estimated_minutes?: number;
};

type Briefing = {
  greeting: string;
  summary: string;
  tasks: BriefingTask[];
  closing?: string;
};

const PRIORITY_CONFIG = {
  critical: { color: 'bg-red-100 text-red-800 border-red-200', icon: Flame, label: 'דחוף!' },
  high: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertCircle, label: 'חשוב' },
  medium: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Target, label: 'מומלץ' },
  suggestion: { color: 'bg-purple-100 text-purple-800 border-purple-200', icon: Lightbulb, label: 'רעיון' },
} as const;

const ACTION_HINT_ICONS = {
  call: Phone,
  message: MessageSquare,
  meeting: Calendar,
  review: FileText,
  decide: Target,
  delegate: ArrowRight,
  document: FileText,
} as const;

export default function FocusClient({
  userId, memberships, initialWorkspaceId, currentRole,
}: {
  userId: string;
  memberships: Membership[];
  initialWorkspaceId: string;
  currentRole: Role | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId);
  const [loading, setLoading] = useState(false);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [taskActions, setTaskActions] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [showRoleSettings, setShowRoleSettings] = useState(!currentRole);
  const [customPrompt, setCustomPrompt] = useState('');

  const currentWorkspace = memberships.find(m => m.workspace_id === workspaceId)?.workspaces;

  async function generateBriefing(prompt?: string) {
    setLoading(true);
    setError(null);
    setTaskActions({});

    try {
      const res = await fetch('/api/focus/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          prompt: prompt || customPrompt || 'תפקס אותי - מה לעשות היום לפי דחיפות?',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'שגיאה ביצירת בריפינג');
      } else {
        setBriefing(data.briefing);
        setSessionId(data.session_id);
      }
    } catch (err: any) {
      setError(err.message || 'שגיאת רשת');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(taskIndex: number, task: BriefingTask, action: string) {
    setTaskActions(prev => ({ ...prev, [taskIndex]: action }));

    try {
      await fetch('/api/focus/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          task_index: taskIndex,
          task_title: task.title,
          action,
        }),
      });
    } catch (err) {
      console.error('Action save failed:', err);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50/50 via-white to-pink-50/30">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur sticky top-0 z-20 border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-600 hover:text-purple-700">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-display font-black text-xl flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Focus Mode
            </h1>
            <p className="text-xs text-gray-500">
              עוזר אישי שמסדר לך את היום
            </p>
          </div>
          {memberships.length > 1 && (
            <select
              value={workspaceId}
              onChange={e => { setWorkspaceId(e.target.value); setBriefing(null); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
            >
              {memberships.map(m => (
                <option key={m.workspace_id} value={m.workspace_id}>
                  {m.workspaces.icon} {m.workspaces.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowRoleSettings(!showRoleSettings)}
            className="p-2 text-gray-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg"
            title="הגדרות תפקיד"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Role settings */}
        {showRoleSettings && (
          <RoleSettings
            workspaceId={workspaceId}
            currentRole={currentRole}
            onSaved={() => { setShowRoleSettings(false); router.refresh(); }}
            onClose={() => setShowRoleSettings(false)}
          />
        )}

        {/* Empty state - no briefing yet */}
        {!briefing && !loading && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mx-auto mb-4 grid place-items-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="font-display font-bold text-2xl mb-2">בוקר טוב! 👋</h2>
            <p className="text-gray-600 mb-6">
              אני אסדר לך את היום. ה-AI יבחן את כל המידע במערכת ויציע 5 משימות חכמות לפי הדחיפות.
            </p>

            {currentRole?.role_title && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium mb-4">
                <Target className="w-3 h-3" />
                {currentRole.role_title}
              </div>
            )}

            <textarea
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              placeholder="ברירת מחדל: 'תפקס אותי - מה לעשות היום?' - או כתוב משהו ספציפי..."
              rows={2}
              className="w-full text-sm p-3 border border-gray-200 rounded-xl mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            />

            <button
              onClick={() => generateBriefing()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-base hover:opacity-90 transition-opacity shadow-md"
            >
              <Sparkles className="w-5 h-5" />
              תפקס אותי עכשיו
            </button>

            {error && (
              <p className="mt-4 text-sm text-red-600">{error}</p>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-700 font-medium">המערכת חושבת...</p>
            <p className="text-xs text-gray-500 mt-1">בוחן נתונים, מנתח דחיפות, מסדר עדיפויות</p>
          </div>
        )}

        {/* Briefing */}
        {briefing && !loading && (
          <>
            {/* Greeting card */}
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-6 text-white shadow-lg">
              <p className="font-display font-bold text-xl mb-2">{briefing.greeting}</p>
              <p className="text-purple-100 text-sm">{briefing.summary}</p>
            </div>

            {/* Tasks */}
            {briefing.tasks.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <Coffee className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-700 font-medium">הכל בשליטה!</p>
                <p className="text-sm text-gray-500 mt-1">אין משימות דחופות עכשיו. תיהנה מהיום ☕</p>
              </div>
            ) : (
              <div className="space-y-3">
                {briefing.tasks.map((task, i) => (
                  <TaskCard
                    key={i}
                    task={task}
                    index={i}
                    workspaceIcon={currentWorkspace?.icon}
                    actionTaken={taskActions[i]}
                    onAction={(action) => handleAction(i, task, action)}
                  />
                ))}
              </div>
            )}

            {briefing.closing && (
              <p className="text-center text-sm text-gray-600 italic py-2">
                {briefing.closing}
              </p>
            )}

            {/* Refresh button */}
            <div className="flex justify-center pt-4">
              <button
                onClick={() => generateBriefing()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 rounded-lg font-medium transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                בריפינג חדש
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function TaskCard({
  task, index, workspaceIcon, actionTaken, onAction,
}: {
  task: BriefingTask;
  index: number;
  workspaceIcon?: string | null;
  actionTaken?: string;
  onAction: (action: string) => void;
}) {
  const config = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const PriorityIcon = config.icon;
  const ActionIcon = task.action_hint ? (ACTION_HINT_ICONS as any)[task.action_hint] : null;

  // Already-actioned card - dimmed
  if (actionTaken) {
    const labels: Record<string, string> = {
      done: '✓ סומן כבוצע',
      skipped: '⊘ דולג',
      snoozed: '⏰ נדחה',
      delegated: '→ הואצל',
      added_to_table: '➕ נוסף לטבלה',
    };
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 opacity-60">
        <p className="text-sm text-gray-500 line-through">{task.title}</p>
        <p className="text-[10px] text-gray-400 mt-1">{labels[actionTaken]}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <div className={`px-2 py-1 rounded-lg text-[10px] font-bold border flex items-center gap-1 ${config.color}`}>
          <PriorityIcon className="w-3 h-3" />
          {config.label}
        </div>
        {task.estimated_minutes && (
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            ~{task.estimated_minutes} דק'
          </span>
        )}
        {task.table_name && (
          <span className="text-[10px] text-gray-500 mr-auto">
            {workspaceIcon} {task.table_name}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-display font-bold text-base mb-1.5 leading-snug flex items-start gap-2">
        {ActionIcon && <ActionIcon className="w-4 h-4 text-purple-600 mt-1 flex-shrink-0" />}
        <span>{task.title}</span>
      </h3>

      {/* Reason */}
      <p className="text-xs text-gray-600 mb-3 leading-relaxed pr-6">{task.reason}</p>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => onAction('done')}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-xs font-medium transition-colors"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          עשיתי
        </button>
        <button
          onClick={() => onAction('snoozed')}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-lg text-xs font-medium transition-colors"
        >
          <Clock className="w-3.5 h-3.5" />
          דחה
        </button>
        <button
          onClick={() => onAction('skipped')}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-gray-400 hover:bg-gray-50 rounded-lg text-xs font-medium transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          לא רלוונטי
        </button>
        {task.record_id && (
          <a
            href={`/dashboard/${task.record_id}`} // This is approximate - would need table_id context
            className="inline-flex items-center gap-1 px-3 py-1.5 text-purple-700 hover:bg-purple-50 rounded-lg text-xs font-medium transition-colors mr-auto"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            פתח רשומה
          </a>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function RoleSettings({
  workspaceId, currentRole, onSaved, onClose,
}: {
  workspaceId: string;
  currentRole: Role | null;
  onSaved: () => void;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState(currentRole?.role_title || '');
  const [description, setDescription] = useState(currentRole?.role_description || '');
  const [busy, setBusy] = useState(false);

  const examples = [
    { title: 'מנהל מכירות', desc: 'אחראי על צוות מכירות, לידים גדולים, סגירת עסקאות אסטרטגיות' },
    { title: 'סוכן מכירות', desc: 'טיפול בלידים חדשים, שיחות מכירה, מעקב אחרי הצעות' },
    { title: 'טכנאי שירות', desc: 'טיפול בקריאות שירות, פתרון בעיות אצל לקוחות, תיעוד פתרונות' },
    { title: 'מנהל פרויקטים', desc: 'ניהול לוחות זמנים, תיאום עם ספקים, מעקב אחרי משימות' },
  ];

  async function handleSave() {
    if (!title.trim()) return;
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      workspace_id: workspaceId,
      user_id: user!.id,
      role_title: title.trim(),
      role_description: description.trim() || null,
    };

    const { error } = currentRole
      ? await supabase.from('user_roles').update(payload).eq('id', currentRole.id)
      : await supabase.from('user_roles').insert(payload);

    setBusy(false);
    if (!error) onSaved();
    else alert('שמירה נכשלה: ' + error.message);
  }

  return (
    <div className="bg-white rounded-2xl border-2 border-purple-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-bold text-base flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-600" />
          הגדרת תפקיד
        </h3>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-gray-600 mb-4">
        תאר את התפקיד שלך כדי שה-AI יבין מה רלוונטי לך. ככה הבריפינג יהיה ממוקד.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium mb-1">תפקיד</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="למשל: מנהל מכירות"
            className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">תיאור (אופציונלי)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="במה אתה מטפל בעיקר? מה התחומי אחריות?"
            rows={2}
            className="w-full text-sm p-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
        </div>

        {/* Quick examples */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-gray-500 uppercase">דוגמאות מהירות:</p>
          <div className="flex flex-wrap gap-1">
            {examples.map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setTitle(ex.title); setDescription(ex.desc); }}
                className="text-[11px] px-2 py-1 bg-gray-100 hover:bg-purple-100 hover:text-purple-700 rounded-md transition-colors"
              >
                {ex.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="text-sm text-gray-600 hover:text-gray-900">ביטול</button>
        <button
          onClick={handleSave}
          disabled={busy || !title.trim()}
          className="inline-flex items-center gap-1 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {busy ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </div>
  );
}
