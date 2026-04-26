'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  Globe,
  ShieldCheck,
  Activity,
  ChevronDown,
  ChevronUp,
  Save,
  Check,
  AlertCircle,
  Trash2,
  Plus,
  X,
  TrendingUp,
  Bot,
  UserX,
  Hash,
  AlertTriangle,
  BarChart3,
  User,
  Bell,
} from 'lucide-react';
import DashboardTab from './DashboardTab';
import MembersTab from './MembersTab';

// ============================================================================
// Types
// ============================================================================

type GGGroup = {
  id: string;
  green_api_chat_id: string;
  group_name: string | null;
  is_active: boolean;
  gg_enabled: boolean;
  gg_is_admin: boolean;
  gg_detections: {
    ai_content: boolean;
    manual_tagging: boolean;
    phone_prefix: boolean;
    global_blocklist: boolean;
  };
  gg_manual_tag_threshold: number;
  gg_ai_sensitivity: 'low' | 'medium' | 'high';
  gg_participants_count: number;
  gg_enabled_at: string | null;
  gg_notify_admins: boolean;
  gg_admin_phones: string[];
  gg_notify_message: string | null;
};

type Stats = Record<string, { kicks: number; deletes: number; reports: number }>;

type PrefixRule = {
  id: string;
  prefix: string;
  country_name: string | null;
  action: 'warn' | 'delete' | 'kick';
  is_active: boolean;
  created_at: string;
};

type WhitelistEntry = {
  id: string;
  phone: string;
  display_name: string | null;
  reason: string | null;
  group_id: string | null;
  created_at: string;
};

type LogEntry = {
  id: string;
  group_id: string;
  group_name: string;
  target_phone: string;
  target_name: string | null;
  action_type: 'warn' | 'delete_message' | 'kick' | 'blocklist_add' | 'whitelist_skip';
  trigger_source: 'ai' | 'manual_report' | 'phone_prefix' | 'global_blocklist' | 'whitelist';
  trigger_details: any;
  was_successful: boolean;
  error_message: string | null;
  created_at: string;
};

type Summary = {
  total: number;
  kicks: number;
  deletes: number;
  warns: number;
  failed: number;
  by_source: Record<string, number>;
};

type Tab = 'dashboard' | 'members' | 'groups' | 'prefixes' | 'whitelist' | 'log';


// ============================================================================
// Main component
// ============================================================================

export default function GroupGuardClient({
  workspaceId,
  workspaceName,
  canEdit,
  isSuperAdmin,
}: {
  workspaceId: string;
  workspaceName: string;
  canEdit: boolean;
  isSuperAdmin: boolean;
}) {
  const [tab, setTab] = useState<Tab>('dashboard');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">GroupGuard</h1>
                <p className="text-sm text-gray-500">
                  ניטור אוטומטי של ספאם בקבוצות וואטסאפ
                </p>
              </div>
            </div>

            {isSuperAdmin && (
              <a
                href="/dashboard/groupguard/admin"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 hover:bg-red-100 transition-colors"
              >
                <Shield className="w-3.5 h-3.5" />
                Admin Panel
              </a>
            )}
          </div>
          {!canEdit && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              אין לך הרשאה לעריכה. רק owner/admin יכולים לשנות הגדרות.
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 flex overflow-x-auto">
            <TabButton
              active={tab === 'dashboard'}
              onClick={() => setTab('dashboard')}
              icon={<BarChart3 className="w-4 h-4" />}
              label="דשבורד"
            />
            <TabButton
              active={tab === 'members'}
              onClick={() => setTab('members')}
              icon={<User className="w-4 h-4" />}
              label="חברי קבוצות"
            />
            <TabButton
              active={tab === 'groups'}
              onClick={() => setTab('groups')}
              icon={<Users className="w-4 h-4" />}
              label="קבוצות"
            />
            <TabButton
              active={tab === 'prefixes'}
              onClick={() => setTab('prefixes')}
              icon={<Globe className="w-4 h-4" />}
              label="קידומות חסומות"
            />
            <TabButton
              active={tab === 'whitelist'}
              onClick={() => setTab('whitelist')}
              icon={<ShieldCheck className="w-4 h-4" />}
              label="רשימה לבנה"
            />
            <TabButton
              active={tab === 'log'}
              onClick={() => setTab('log')}
              icon={<Activity className="w-4 h-4" />}
              label="לוג פעולות"
            />
          </div>

          <div className="p-4 sm:p-6">
            {tab === 'dashboard' && (
              <DashboardTab workspaceId={workspaceId} />
            )}
            {tab === 'members' && (
              <MembersTab workspaceId={workspaceId} />
            )}
            {tab === 'groups' && (
              <GroupsTab workspaceId={workspaceId} canEdit={canEdit} />
            )}
            {tab === 'prefixes' && (
              <PrefixesTab workspaceId={workspaceId} canEdit={canEdit} />
            )}
            {tab === 'whitelist' && (
              <WhitelistTab workspaceId={workspaceId} canEdit={canEdit} />
            )}
            {tab === 'log' && (
              <LogTab workspaceId={workspaceId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


function TabButton({
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
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
        active
          ? 'border-purple-500 text-purple-700 bg-purple-50'
          : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}


// ============================================================================
// Tab 1: Groups
// ============================================================================

function GroupsTab({ workspaceId, canEdit }: { workspaceId: string; canEdit: boolean }) {
  const [groups, setGroups] = useState<GGGroup[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function loadGroups() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/groupguard/groups?workspace_id=${workspaceId}`);
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || `שגיאה ${res.status}`);
      } else {
        setGroups(d.groups || []);
        setStats(d.stats || {});
      }
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  function updateLocal(id: string, patch: Partial<GGGroup>) {
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  async function saveGroup(id: string, patch: Partial<GGGroup>) {
    if (!canEdit) return;
    setSavingId(id);
    try {
      const res = await fetch('/api/groupguard/groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      });
      if (res.ok) {
        setSavedId(id);
        setTimeout(() => setSavedId(null), 2000);
      } else {
        const j = await res.json();
        alert(`שגיאה: ${j.error}`);
      }
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">טוען קבוצות...</div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {error}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-600 mb-2">אין קבוצות וואטסאפ רשומות עדיין</p>
        <p className="text-sm text-gray-500">
          קבוצות מתווספות אוטומטית כשהבוט מקבל הודעה ראשונה מהן
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 mb-4">
        הפעל את GroupGuard בכל קבוצה שאתה רוצה לנטר. ⚠️ הבוט חייב להיות אדמין בקבוצה כדי לבצע פעולות.
      </p>

      {groups.map((g) => {
        const s = stats[g.id] || { kicks: 0, deletes: 0, reports: 0 };
        const isExpanded = expandedId === g.id;
        const isSaving = savingId === g.id;
        const isSaved = savedId === g.id;

        return (
          <div
            key={g.id}
            className={`border rounded-xl transition-all ${
              g.gg_enabled ? 'border-purple-200 bg-purple-50/30' : 'border-gray-200 bg-white'
            }`}
          >
            {/* Header row */}
            <div className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    g.gg_enabled ? 'bg-purple-100' : 'bg-gray-100'
                  }`}
                >
                  <Shield
                    className={`w-5 h-5 ${g.gg_enabled ? 'text-purple-600' : 'text-gray-400'}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {g.group_name || g.green_api_chat_id}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                    <span>
                      {g.gg_enabled ? (
                        <span className="text-green-600 font-medium">פעיל</span>
                      ) : (
                        <span>כבוי</span>
                      )}
                    </span>
                    {g.gg_enabled && (
                      <>
                        <span>•</span>
                        <span>{s.kicks} הוצאות השבוע</span>
                        <span>•</span>
                        <span>{s.deletes} מחיקות</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Master toggle */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={g.gg_enabled}
                    disabled={!canEdit}
                    onChange={(e) => {
                      const newValue = e.target.checked;
                      updateLocal(g.id, { gg_enabled: newValue });
                      saveGroup(g.id, { gg_enabled: newValue });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600 peer-disabled:opacity-50" />
                </label>

                <button
                  onClick={() => setExpandedId(isExpanded ? null : g.id)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </button>
              </div>
            </div>

            {/* Expanded settings */}
            {isExpanded && g.gg_enabled && (
              <div className="border-t border-gray-200 p-4 space-y-4 bg-white">
                {!g.gg_is_admin && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">הבוט אינו אדמין בקבוצה</div>
                      <div className="text-xs mt-1">
                        בלי הרשאת אדמין הבוט לא יוכל למחוק הודעות או להוציא משתמשים.
                        הוסף את המספר שלך כאדמין בקבוצה ולחץ על &quot;רענן&quot; כדי לעדכן.
                      </div>
                    </div>
                  </div>
                )}

                {/* 4 detection toggles */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">רמות זיהוי</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <DetectionToggle
                      icon={<Bot className="w-4 h-4" />}
                      label="זיהוי AI לתוכן"
                      description="ניתוח חכם של הודעות חשודות (gpt-4o-mini)"
                      checked={g.gg_detections.ai_content}
                      onChange={(v) => {
                        const newDetections = { ...g.gg_detections, ai_content: v };
                        updateLocal(g.id, { gg_detections: newDetections });
                        saveGroup(g.id, { gg_detections: newDetections });
                      }}
                      disabled={!canEdit}
                    />
                    <DetectionToggle
                      icon={<UserX className="w-4 h-4" />}
                      label="תיוג ידני של חברים"
                      description="חברי קבוצה מתייגים את הבוט לדיווח"
                      checked={g.gg_detections.manual_tagging}
                      onChange={(v) => {
                        const newDetections = { ...g.gg_detections, manual_tagging: v };
                        updateLocal(g.id, { gg_detections: newDetections });
                        saveGroup(g.id, { gg_detections: newDetections });
                      }}
                      disabled={!canEdit}
                    />
                    <DetectionToggle
                      icon={<Hash className="w-4 h-4" />}
                      label="קידומות חסומות"
                      description="חסימה לפי קוד מדינה"
                      checked={g.gg_detections.phone_prefix}
                      onChange={(v) => {
                        const newDetections = { ...g.gg_detections, phone_prefix: v };
                        updateLocal(g.id, { gg_detections: newDetections });
                        saveGroup(g.id, { gg_detections: newDetections });
                      }}
                      disabled={!canEdit}
                    />
                    <DetectionToggle
                      icon={<Globe className="w-4 h-4" />}
                      label="מאגר ספאמרים גלובלי"
                      description="שיתוף בין כל לקוחות AllChatBoard"
                      checked={g.gg_detections.global_blocklist}
                      onChange={(v) => {
                        const newDetections = { ...g.gg_detections, global_blocklist: v };
                        updateLocal(g.id, { gg_detections: newDetections });
                        saveGroup(g.id, { gg_detections: newDetections });
                      }}
                      disabled={!canEdit}
                    />
                  </div>
                </div>

                {/* Manual tag threshold */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    סף תיוגים ידני: <span className="text-purple-600">{g.gg_manual_tag_threshold}</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    כמה אנשים שונים צריכים לתייג את הבוט על אותה הודעה כדי להוציא את השולח
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={g.gg_manual_tag_threshold}
                    disabled={!canEdit}
                    onChange={(e) => updateLocal(g.id, { gg_manual_tag_threshold: Number(e.target.value) })}
                    onMouseUp={(e) => saveGroup(g.id, { gg_manual_tag_threshold: Number((e.target as HTMLInputElement).value) })}
                    onTouchEnd={(e) => saveGroup(g.id, { gg_manual_tag_threshold: Number((e.target as HTMLInputElement).value) })}
                    className="w-full accent-purple-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>1 (רגיש)</span>
                    <span>10 (סלחני)</span>
                  </div>
                </div>

                {/* AI sensitivity */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">רגישות AI</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['low', 'medium', 'high'] as const).map((level) => (
                      <button
                        key={level}
                        disabled={!canEdit}
                        onClick={() => {
                          updateLocal(g.id, { gg_ai_sensitivity: level });
                          saveGroup(g.id, { gg_ai_sensitivity: level });
                        }}
                        className={`px-3 py-2 text-sm rounded-lg border transition-colors disabled:opacity-50 ${
                          g.gg_ai_sensitivity === level
                            ? 'bg-purple-100 border-purple-400 text-purple-700 font-medium'
                            : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {level === 'low' && 'נמוכה'}
                        {level === 'medium' && 'בינונית'}
                        {level === 'high' && 'גבוהה'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notify admins on spam (alternative when bot is not admin) */}
                <NotifyAdminsBlock
                  group={g}
                  canEdit={canEdit}
                  onUpdate={(patch) => {
                    updateLocal(g.id, patch);
                    saveGroup(g.id, patch);
                  }}
                />

                {/* Status indicator */}
                <div className="text-xs text-gray-500 flex items-center justify-between pt-2 border-t border-gray-100">
                  <div>
                    {g.gg_enabled_at && (
                      <span>
                        פעיל מאז: {new Date(g.gg_enabled_at).toLocaleDateString('he-IL')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isSaving && <span className="text-purple-600">שומר...</span>}
                    {isSaved && (
                      <span className="text-green-600 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        נשמר
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


function DetectionToggle({
  icon,
  label,
  description,
  checked,
  onChange,
  disabled,
  comingSoon,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  comingSoon?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
        disabled
          ? 'opacity-60 cursor-not-allowed bg-gray-50'
          : checked
          ? 'border-purple-300 bg-purple-50/50 hover:bg-purple-50'
          : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 w-4 h-4 accent-purple-600"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
          {icon}
          {label}
          {comingSoon && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-normal">
              בקרוב
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">{description}</div>
      </div>
    </label>
  );
}


// ============================================================================
// Tab 2: Phone Prefixes
// ============================================================================

function PrefixesTab({ workspaceId, canEdit }: { workspaceId: string; canEdit: boolean }) {
  const [rules, setRules] = useState<PrefixRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newPrefix, setNewPrefix] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const [newAction, setNewAction] = useState<'warn' | 'delete' | 'kick'>('kick');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/groupguard/prefixes?workspace_id=${workspaceId}`);
      const d = await res.json();
      if (!res.ok) setError(d.error);
      else setRules(d.rules || []);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function addRule() {
    if (!newPrefix.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/groupguard/prefixes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          prefix: newPrefix.trim(),
          country_name: newCountry.trim() || null,
          action: newAction,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        alert(`שגיאה: ${d.error}`);
      } else {
        setRules((rs) => [d.rule, ...rs]);
        setNewPrefix('');
        setNewCountry('');
        setNewAction('kick');
        setShowForm(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteRule(id: string) {
    if (!confirm('למחוק קידומת זו?')) return;
    const res = await fetch(`/api/groupguard/prefixes?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setRules((rs) => rs.filter((r) => r.id !== id));
    } else {
      const d = await res.json();
      alert(`שגיאה: ${d.error}`);
    }
  }

  async function toggleActive(rule: PrefixRule) {
    const res = await fetch('/api/groupguard/prefixes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
    });
    if (res.ok) {
      setRules((rs) =>
        rs.map((r) => (r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
      );
    }
  }

  if (loading) return <div className="text-center py-8 text-gray-500">טוען...</div>;
  if (error)
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {error}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-gray-600">
          חסום מספרים לפי קידומת מדינה. למשל: 234 (ניגריה), 92 (פקיסטן), 1 (ארה״ב).
        </p>
        {canEdit && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            הוסף קידומת
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">קידומת *</label>
              <input
                type="text"
                inputMode="numeric"
                value={newPrefix}
                onChange={(e) => setNewPrefix(e.target.value.replace(/\D/g, ''))}
                placeholder="234"
                maxLength={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">שם מדינה</label>
              <input
                type="text"
                value={newCountry}
                onChange={(e) => setNewCountry(e.target.value)}
                placeholder="ניגריה"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">פעולה</label>
              <select
                value={newAction}
                onChange={(e) => setNewAction(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              >
                <option value="kick">הוצאה מהקבוצה</option>
                <option value="delete">מחיקת הודעה בלבד</option>
                <option value="warn">אזהרה (תגובה)</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={addRule}
              disabled={submitting || !newPrefix.trim()}
              className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {submitting ? 'מוסיף...' : 'הוסף'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setNewPrefix('');
                setNewCountry('');
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="text-center py-12">
          <Globe className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">אין קידומות חסומות עדיין</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((r) => (
            <div
              key={r.id}
              className={`flex items-center justify-between p-3 border rounded-lg ${
                r.is_active ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="px-2 py-1 bg-gray-100 rounded font-mono text-sm font-medium text-gray-700 flex-shrink-0">
                  +{r.prefix}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {r.country_name || 'ללא שם'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {r.action === 'kick' && 'הוצאה מהקבוצה'}
                    {r.action === 'delete' && 'מחיקת הודעה'}
                    {r.action === 'warn' && 'אזהרה'}
                  </div>
                </div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.is_active}
                      onChange={() => toggleActive(r)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600" />
                  </label>
                  <button
                    onClick={() => deleteRule(r.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ============================================================================
// Tab 3: Whitelist
// ============================================================================

function WhitelistTab({ workspaceId, canEdit }: { workspaceId: string; canEdit: boolean }) {
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [newReason, setNewReason] = useState('admin');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/groupguard/whitelist?workspace_id=${workspaceId}`);
      const d = await res.json();
      if (!res.ok) setError(d.error);
      else setEntries(d.entries || []);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function add() {
    if (!newPhone.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/groupguard/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          phone: newPhone.trim(),
          display_name: newName.trim() || null,
          reason: newReason,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        alert(`שגיאה: ${d.error}`);
      } else {
        setEntries((es) => [d.entry, ...es]);
        setNewPhone('');
        setNewName('');
        setNewReason('admin');
        setShowForm(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('להסיר מספר זה מהרשימה הלבנה?')) return;
    const res = await fetch(`/api/groupguard/whitelist?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setEntries((es) => es.filter((e) => e.id !== id));
    }
  }

  if (loading) return <div className="text-center py-8 text-gray-500">טוען...</div>;
  if (error)
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {error}
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-gray-600">
          מספרים ברשימה לבנה לעולם לא יוצאו מהקבוצות, גם אם דווחו או נמצאים במאגר. שימושי לאדמינים, VIPs או לעצמך.
        </p>
        {canEdit && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            הוסף מספר
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">טלפון *</label>
              <input
                type="text"
                inputMode="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="972501234567"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">שם תצוגה</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="שימיק (admin)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">סיבה</label>
              <select
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              >
                <option value="admin">אדמין</option>
                <option value="owner">בעלים</option>
                <option value="vip">VIP</option>
                <option value="other">אחר</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={add}
              disabled={submitting || !newPhone.trim()}
              className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
            >
              {submitting ? 'מוסיף...' : 'הוסף'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setNewPhone('');
                setNewName('');
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-center py-12">
          <ShieldCheck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">אין מספרים ברשימה הלבנה</p>
          <p className="text-xs text-gray-400 mt-1">מומלץ להוסיף את עצמך כדי לא להוצא בטעות</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between p-3 border border-gray-200 bg-white rounded-lg"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {e.display_name || e.phone}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <span dir="ltr">+{e.phone}</span>
                    {e.reason && (
                      <>
                        <span>•</span>
                        <span>{e.reason}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {canEdit && (
                <button
                  onClick={() => remove(e.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ============================================================================
// Tab 4: Action Log
// ============================================================================

function LogTab({ workspaceId }: { workspaceId: string }) {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/groupguard/log?workspace_id=${workspaceId}&limit=100`);
      const d = await res.json();
      if (!res.ok) setError(d.error);
      else {
        setLog(d.log || []);
        setSummary(d.summary || null);
      }
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="text-center py-8 text-gray-500">טוען...</div>;
  if (error)
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {error}
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="סה״כ פעולות (7 ימים)"
            value={summary.total}
            color="purple"
          />
          <SummaryCard
            icon={<UserX className="w-4 h-4" />}
            label="הוצאות מקבוצות"
            value={summary.kicks}
            color="red"
          />
          <SummaryCard
            icon={<X className="w-4 h-4" />}
            label="הודעות שנמחקו"
            value={summary.deletes}
            color="orange"
          />
          <SummaryCard
            icon={<AlertCircle className="w-4 h-4" />}
            label="כשלים"
            value={summary.failed}
            color="gray"
          />
        </div>
      )}

      {/* Log entries */}
      {log.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">אין פעולות עדיין</p>
          <p className="text-xs text-gray-400 mt-1">פעולות יופיעו כאן כשיתבצעו</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {log.map((e) => (
            <LogRow key={e.id} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}


function SummaryCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'purple' | 'red' | 'orange' | 'gray';
}) {
  const colorClasses = {
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  };
  return (
    <div className={`p-3 border rounded-xl ${colorClasses[color]}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-80 mb-1">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}


function LogRow({ entry }: { entry: LogEntry }) {
  const sourceLabels: Record<string, string> = {
    ai: 'AI',
    manual_report: 'תיוג ידני',
    phone_prefix: 'קידומת',
    global_blocklist: 'מאגר',
    whitelist: 'whitelist',
  };

  const actionLabels: Record<string, string> = {
    kick: 'הוצאה',
    delete_message: 'מחיקת הודעה',
    warn: 'אזהרה',
    blocklist_add: 'הוספה למאגר',
    whitelist_skip: 'דילוג (whitelist)',
  };

  const actionColors: Record<string, string> = {
    kick: 'text-red-700 bg-red-50',
    delete_message: 'text-orange-700 bg-orange-50',
    warn: 'text-amber-700 bg-amber-50',
    blocklist_add: 'text-purple-700 bg-purple-50',
    whitelist_skip: 'text-gray-600 bg-gray-50',
  };

  // Build AI details string if this is an AI-triggered action
  const aiCategories: string[] | null =
    entry.trigger_source === 'ai' && Array.isArray(entry.trigger_details?.categories)
      ? entry.trigger_details.categories
      : null;
  const aiConfidence: number | null =
    entry.trigger_source === 'ai' && typeof entry.trigger_details?.confidence === 'number'
      ? entry.trigger_details.confidence
      : null;
  const aiReason: string | null =
    typeof entry.trigger_details?.reason === 'string' ? entry.trigger_details.reason : null;

  return (
    <div className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
      <div className="flex-shrink-0 mt-0.5">
        {entry.was_successful ? (
          <Check className="w-4 h-4 text-green-600" />
        ) : (
          <AlertCircle className="w-4 h-4 text-red-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${actionColors[entry.action_type] || 'text-gray-600 bg-gray-50'}`}>
            {actionLabels[entry.action_type] || entry.action_type}
          </span>
          <span className="text-gray-700 truncate">
            {entry.target_name || (
              <span dir="ltr" className="font-mono text-xs">+{entry.target_phone}</span>
            )}
          </span>
          <span className="text-gray-400 text-xs">בקבוצה</span>
          <span className="text-gray-700 text-sm truncate">{entry.group_name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-0.5">
          <span>{sourceLabels[entry.trigger_source] || entry.trigger_source}</span>
          <span>•</span>
          <span>{new Date(entry.created_at).toLocaleString('he-IL')}</span>
          {entry.error_message && (
            <>
              <span>•</span>
              <span className="text-red-600 truncate">{entry.error_message}</span>
            </>
          )}
        </div>
        {/* AI details - categories + confidence */}
        {aiCategories && aiCategories.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {aiCategories.map((cat) => (
              <span
                key={cat}
                className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium"
              >
                {cat}
              </span>
            ))}
            {aiConfidence !== null && (
              <span className="text-[10px] text-gray-500">
                ביטחון: {Math.round(aiConfidence * 100)}%
              </span>
            )}
          </div>
        )}
        {/* AI reason */}
        {aiReason && entry.trigger_source === 'ai' && (
          <div className="text-xs text-gray-600 mt-1 italic">{aiReason}</div>
        )}
      </div>
    </div>
  );
}


// ============================================================================
// NotifyAdminsBlock - הגדרת תיוג מנהלים כשהבוט לא אדמין
// ============================================================================

function NotifyAdminsBlock({
  group,
  canEdit,
  onUpdate,
}: {
  group: GGGroup;
  canEdit: boolean;
  onUpdate: (patch: Partial<GGGroup>) => void;
}) {
  const [phoneInput, setPhoneInput] = useState('');
  const [showCustomMsg, setShowCustomMsg] = useState(!!group.gg_notify_message);

  function addPhone() {
    const cleaned = phoneInput.replace(/\D/g, '');
    if (cleaned.length < 8) return;
    if (group.gg_admin_phones.includes(cleaned)) {
      setPhoneInput('');
      return;
    }
    if (group.gg_admin_phones.length >= 20) return;
    onUpdate({ gg_admin_phones: [...group.gg_admin_phones, cleaned] });
    setPhoneInput('');
  }

  function removePhone(phone: string) {
    onUpdate({
      gg_admin_phones: group.gg_admin_phones.filter((p) => p !== phone),
    });
  }

  // Show recommendation if bot is NOT admin and notify_admins is OFF
  const showRecommendation = !group.gg_is_admin && !group.gg_notify_admins;

  return (
    <div className={`rounded-lg border p-3 ${
      group.gg_notify_admins
        ? 'border-amber-300 bg-amber-50/40'
        : 'border-gray-200 bg-gray-50/40'
    }`}>
      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5 text-amber-600" />
            תיוג מנהלים בעת זיהוי ספאם
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            הבוט יתייג אנשים שתגדירו במקום למחוק/להוציא בעצמו
          </div>
        </div>
        <input
          type="checkbox"
          checked={group.gg_notify_admins}
          disabled={!canEdit}
          onChange={(e) => onUpdate({ gg_notify_admins: e.target.checked })}
          className="w-5 h-5 rounded text-amber-600 disabled:opacity-50"
        />
      </div>

      {/* Recommendation when bot is not admin */}
      {showRecommendation && (
        <div className="text-xs bg-amber-100 text-amber-800 rounded p-2 mb-2 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            הבוט לא אדמין בקבוצה - הפעילי את האופציה הזו כדי לקבל התראות במקום
            ניסיונות מחיקה שייכשלו.
          </span>
        </div>
      )}

      {/* Configuration when enabled */}
      {group.gg_notify_admins && (
        <div className="space-y-2.5 mt-3">
          {/* Phone list */}
          <div>
            <div className="text-xs font-medium text-gray-700 mb-1">
              מספרים לתיוג ({group.gg_admin_phones.length}/20)
            </div>

            {/* Existing phones */}
            {group.gg_admin_phones.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {group.gg_admin_phones.map((phone) => (
                  <div
                    key={phone}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-gray-300 rounded text-xs"
                    dir="ltr"
                  >
                    <span>+{phone}</span>
                    {canEdit && (
                      <button
                        onClick={() => removePhone(phone)}
                        className="text-gray-400 hover:text-red-600"
                        type="button"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add input */}
            {canEdit && group.gg_admin_phones.length < 20 && (
              <div className="flex gap-1">
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addPhone();
                    }
                  }}
                  placeholder="972501234567"
                  dir="ltr"
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={addPhone}
                  disabled={phoneInput.replace(/\D/g, '').length < 8}
                  className="px-2.5 py-1 text-xs bg-amber-600 text-white rounded disabled:opacity-50 hover:bg-amber-700"
                >
                  הוסף
                </button>
              </div>
            )}
            <div className="text-[10px] text-gray-400 mt-1">
              💡 פורמט בינלאומי בלי + (לדוגמה: 972501234567).
              המספרים חייבים להיות חברים בקבוצה כדי שהתיוג יעבוד.
            </div>
          </div>

          {/* Custom message toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowCustomMsg(!showCustomMsg)}
              className="text-xs text-gray-600 hover:text-gray-900 underline"
            >
              {showCustomMsg ? 'הסתר' : 'התאמה אישית של הודעת התיוג'}
            </button>

            {showCustomMsg && (
              <div className="mt-2">
                <textarea
                  value={group.gg_notify_message || ''}
                  disabled={!canEdit}
                  onChange={(e) => onUpdate({ gg_notify_message: e.target.value || null })}
                  placeholder="🚨 ספאם זוהה!&#10;משתמש: {user} {userName}&#10;סיבה: {reason}&#10;{admins} - לטיפולכם"
                  rows={4}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-amber-500 resize-none"
                />
                <div className="text-[10px] text-gray-400 mt-1">
                  משתנים זמינים: <code className="bg-gray-100 px-1">{'{user}'}</code> -
                  תיוג השולח,
                  <code className="bg-gray-100 px-1 mx-1">{'{userName}'}</code> -
                  שם השולח,
                  <code className="bg-gray-100 px-1 mx-1">{'{reason}'}</code> -
                  סיבה,
                  <code className="bg-gray-100 px-1">{'{admins}'}</code> -
                  תיוג המנהלים.
                  השאירי ריק להודעת ברירת מחדל.
                </div>
              </div>
            )}
          </div>

          {/* Info note */}
          <div className="text-xs text-gray-500 bg-white/60 rounded p-2 border border-amber-200">
            💡 כשהבוט אדמין: ימחק/יסיר אוטומטית.
            <br />
            כשהבוט לא אדמין: יתייג את המספרים כאן עם פרטי המקרה.
          </div>
        </div>
      )}
    </div>
  );
}
