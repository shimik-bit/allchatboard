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
  Search,
} from 'lucide-react';
import DashboardTab from './DashboardTab';
import MembersTab from './MembersTab';
import { useT } from '@/lib/i18n/useT';

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
  const { t } = useT();

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
                <h1 className="text-2xl font-bold text-gray-900">{t('groupguard.title')}</h1>
                <p className="text-sm text-gray-500">
                  {t('groupguard.subtitle')}
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
              {t('groupguard.no_edit_permission')}
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
              label={t('groupguard.tabs.dashboard')}
            />
            <TabButton
              active={tab === 'members'}
              onClick={() => setTab('members')}
              icon={<User className="w-4 h-4" />}
              label={t('groupguard.tabs.members')}
            />
            <TabButton
              active={tab === 'groups'}
              onClick={() => setTab('groups')}
              icon={<Users className="w-4 h-4" />}
              label={t('groupguard.tabs.groups')}
            />
            <TabButton
              active={tab === 'prefixes'}
              onClick={() => setTab('prefixes')}
              icon={<Globe className="w-4 h-4" />}
              label={t('groupguard.tabs.prefixes')}
            />
            <TabButton
              active={tab === 'whitelist'}
              onClick={() => setTab('whitelist')}
              icon={<ShieldCheck className="w-4 h-4" />}
              label={t('groupguard.tabs.whitelist')}
            />
            <TabButton
              active={tab === 'log'}
              onClick={() => setTab('log')}
              icon={<Activity className="w-4 h-4" />}
              label={t('groupguard.tabs.log')}
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
  const { t } = useT();
  const [groups, setGroups] = useState<GGGroup[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [scanModalGroup, setScanModalGroup] = useState<GGGroup | null>(null);

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
        setError(d.error || `Error ${res.status}`);
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
        alert(`Error: ${j.error}`);
      }
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">{t('groupguard.common.loading')}</div>;
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
        <p className="text-gray-600 mb-2">{t('groupguard.groups.no_groups')}</p>
        <p className="text-sm text-gray-500">
          {t('groupguard.groups.no_groups_hint')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 mb-4">
        ⚠️ {t('groupguard.groups.enable_hint')}
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
                        <span className="text-green-600 font-medium">{t('groupguard.common.enabled')}</span>
                      ) : (
                        <span>{t('groupguard.common.disabled')}</span>
                      )}
                    </span>
                    {g.gg_enabled && (
                      <>
                        <span>•</span>
                        <span>{s.kicks} {t('groupguard.groups.kicks_this_week')}</span>
                        <span>•</span>
                        <span>{s.deletes} {t('groupguard.groups.deletes')}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Scan button - finds spammers in group */}
                {g.gg_enabled && canEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setScanModalGroup(g);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                    title={t('groupguard.groups.scan_tooltip')}
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t('groupguard.groups.scan_members')}</span>
                  </button>
                )}

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
                      <div className="font-medium">{t('groupguard.groups.bot_not_admin_title')}</div>
                      <div className="text-xs mt-1">
                        {t('groupguard.groups.bot_not_admin_desc1')}{' '}
                        {t('groupguard.groups.bot_not_admin_desc2')}
                      </div>
                    </div>
                  </div>
                )}

                {/* 4 detection toggles */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">{t('groupguard.groups.detection_layers')}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <DetectionToggle
                      icon={<Bot className="w-4 h-4" />}
                      label={t('groupguard.groups.detection_ai_label')}
                      description={t('groupguard.groups.detection_ai_desc')}
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
                      label={t('groupguard.groups.detection_manual_label')}
                      description={t('groupguard.groups.detection_manual_desc')}
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
                      label={t('groupguard.groups.detection_prefix_label')}
                      description={t('groupguard.groups.detection_prefix_desc')}
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
                      label={t('groupguard.groups.detection_blocklist_label')}
                      description={t('groupguard.groups.detection_blocklist_desc')}
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
                    {t('groupguard.groups.manual_threshold_label')}: <span className="text-purple-600">{g.gg_manual_tag_threshold}</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    {t('groupguard.groups.manual_threshold_desc')}
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
                    <span>{t('groupguard.groups.threshold_sensitive')}</span>
                    <span>{t('groupguard.groups.threshold_lenient')}</span>
                  </div>
                </div>

                {/* AI sensitivity */}
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">{t('groupguard.groups.ai_sensitivity_label')}</div>
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
                        {level === 'low' && t('groupguard.groups.sensitivity_low')}
                        {level === 'medium' && t('groupguard.groups.sensitivity_medium')}
                        {level === 'high' && t('groupguard.groups.sensitivity_high')}
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
                        {t('groupguard.groups.enabled_since')}: {new Date(g.gg_enabled_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isSaving && <span className="text-purple-600">{t('groupguard.groups.saving')}</span>}
                    {isSaved && (
                      <span className="text-green-600 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        {t('groupguard.groups.saved')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Scan modal - shown when user clicks "סרוק חברים" on a group */}
      {scanModalGroup && (
        <ScanGroupModal
          group={scanModalGroup}
          onClose={() => setScanModalGroup(null)}
        />
      )}
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
  const { t } = useT();
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
              {t('groupguard.groups.coming_soon')}
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
  const { t } = useT();
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
        alert(`Error: ${d.error}`);
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
    if (!confirm(t('groupguard.prefixes.delete_confirm'))) return;
    const res = await fetch(`/api/groupguard/prefixes?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setRules((rs) => rs.filter((r) => r.id !== id));
    } else {
      const d = await res.json();
      alert(`Error: ${d.error}`);
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

  if (loading) return <div className="text-center py-8 text-gray-500">{t('groupguard.common.loading')}</div>;
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
          {t('groupguard.prefixes.description')}
        </p>
        {canEdit && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            {t('groupguard.prefixes.add_prefix')}
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('groupguard.prefixes.prefix_label')} *</label>
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
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('groupguard.prefixes.country_name')}</label>
              <input
                type="text"
                value={newCountry}
                onChange={(e) => setNewCountry(e.target.value)}
                placeholder={t('groupguard.prefixes.country_placeholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('groupguard.prefixes.action_label')}</label>
              <select
                value={newAction}
                onChange={(e) => setNewAction(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              >
                <option value="kick">{t('groupguard.prefixes.action_kick')}</option>
                <option value="delete">{t('groupguard.prefixes.action_delete')}</option>
                <option value="warn">{t('groupguard.prefixes.action_warn')}</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={addRule}
              disabled={submitting || !newPrefix.trim()}
              className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {submitting ? t('groupguard.prefixes.adding') : t('groupguard.prefixes.add_button')}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setNewPrefix('');
                setNewCountry('');
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              {t('groupguard.prefixes.cancel')}
            </button>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="text-center py-12">
          <Globe className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">{t('groupguard.prefixes.no_prefixes')}</p>
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
                    {r.country_name || t('groupguard.prefixes.no_name')}
                  </div>
                  <div className="text-xs text-gray-500">
                    {r.action === 'kick' && t('groupguard.prefixes.action_kick')}
                    {r.action === 'delete' && t('groupguard.prefixes.action_delete')}
                    {r.action === 'warn' && t('groupguard.prefixes.action_warn')}
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
  const { t } = useT();
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
        alert(`Error: ${d.error}`);
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
    if (!confirm(t('groupguard.whitelist.delete_confirm'))) return;
    const res = await fetch(`/api/groupguard/whitelist?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setEntries((es) => es.filter((e) => e.id !== id));
    }
  }

  if (loading) return <div className="text-center py-8 text-gray-500">{t('groupguard.common.loading')}</div>;
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
          {t('groupguard.whitelist.description')}
        </p>
        {canEdit && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            {t('groupguard.whitelist.add_phone')}
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('groupguard.whitelist.phone_label')} *</label>
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
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('groupguard.whitelist.display_name_label')}</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('groupguard.whitelist.display_name_placeholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('groupguard.whitelist.reason_label')}</label>
              <select
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              >
                <option value="admin">{t('groupguard.whitelist.reason_admin')}</option>
                <option value="owner">{t('groupguard.whitelist.reason_owner')}</option>
                <option value="vip">VIP</option>
                <option value="other">{t('groupguard.whitelist.reason_other')}</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={add}
              disabled={submitting || !newPhone.trim()}
              className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
            >
              {submitting ? t('groupguard.whitelist.adding') : t('groupguard.whitelist.add_button')}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setNewPhone('');
                setNewName('');
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              {t('groupguard.whitelist.cancel')}
            </button>
          </div>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-center py-12">
          <ShieldCheck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">{t('groupguard.whitelist.no_entries')}</p>
          <p className="text-xs text-gray-400 mt-1">{t('groupguard.whitelist.no_entries_hint')}</p>
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
  const { t } = useT();
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

  if (loading) return <div className="text-center py-8 text-gray-500">{t('groupguard.common.loading')}</div>;
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
            label={t('groupguard.log.total_actions')}
            value={summary.total}
            color="purple"
          />
          <SummaryCard
            icon={<UserX className="w-4 h-4" />}
            label={t('groupguard.log.kicks')}
            value={summary.kicks}
            color="red"
          />
          <SummaryCard
            icon={<X className="w-4 h-4" />}
            label={t('groupguard.log.deletes')}
            value={summary.deletes}
            color="orange"
          />
          <SummaryCard
            icon={<AlertCircle className="w-4 h-4" />}
            label={t('groupguard.log.failures')}
            value={summary.failed}
            color="gray"
          />
        </div>
      )}

      {/* Log entries */}
      {log.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">{t('groupguard.log.no_actions')}</p>
          <p className="text-xs text-gray-400 mt-1">{t('groupguard.log.no_actions_hint')}</p>
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
  const { t, locale } = useT();
  const sourceLabels: Record<string, string> = {
    ai: t('groupguard.log.trigger_ai'),
    manual_report: t('groupguard.log.trigger_manual_report'),
    phone_prefix: t('groupguard.log.trigger_phone_prefix'),
    global_blocklist: t('groupguard.log.trigger_global_blocklist'),
    whitelist: t('groupguard.log.trigger_whitelist'),
  };

  const actionLabels: Record<string, string> = {
    kick: t('groupguard.log.action_kick'),
    delete_message: t('groupguard.log.action_delete_message'),
    warn: t('groupguard.log.action_warn'),
    blocklist_add: t('groupguard.log.action_blocklist_add'),
    whitelist_skip: t('groupguard.log.action_whitelist_skip'),
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
          <span className="text-gray-400 text-xs">{t('groupguard.log.in_group')}</span>
          <span className="text-gray-700 text-sm truncate">{entry.group_name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-0.5">
          <span>{sourceLabels[entry.trigger_source] || entry.trigger_source}</span>
          <span>•</span>
          <span>{new Date(entry.created_at).toLocaleString(locale === 'he' ? 'he-IL' : 'en-US')}</span>
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
                {t('groupguard.log.confidence')}: {Math.round(aiConfidence * 100)}%
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
  const { t } = useT();
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
            {t('groupguard.groups.notify_admins_block.title')}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {t('groupguard.groups.notify_admins_block.description')}
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
            {t('groupguard.groups.notify_admins_block.warning_not_admin')}
          </span>
        </div>
      )}

      {/* Configuration when enabled */}
      {group.gg_notify_admins && (
        <div className="space-y-2.5 mt-3">
          {/* Phone list */}
          <div>
            <div className="text-xs font-medium text-gray-700 mb-1">
              {t('groupguard.groups.notify_admins_block.admin_phones_label')} ({group.gg_admin_phones.length}/20)
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
                  placeholder={t('groupguard.groups.notify_admins_block.admin_phones_placeholder')}
                  dir="ltr"
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={addPhone}
                  disabled={phoneInput.replace(/\D/g, '').length < 8}
                  className="px-2.5 py-1 text-xs bg-amber-600 text-white rounded disabled:opacity-50 hover:bg-amber-700"
                >
                  {t('groupguard.common.add')}
                </button>
              </div>
            )}
            <div className="text-[10px] text-gray-400 mt-1">
              {t('groupguard.groups.notify_admins_block.admin_phones_format_hint')}
            </div>
          </div>

          {/* Custom message toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowCustomMsg(!showCustomMsg)}
              className="text-xs text-gray-600 hover:text-gray-900 underline"
            >
              {showCustomMsg
                ? t('groupguard.groups.notify_admins_block.custom_message_hide')
                : t('groupguard.groups.notify_admins_block.custom_message_show')}
            </button>

            {showCustomMsg && (
              <div className="mt-2">
                <textarea
                  value={group.gg_notify_message || ''}
                  disabled={!canEdit}
                  onChange={(e) => onUpdate({ gg_notify_message: e.target.value || null })}
                  placeholder={t('groupguard.groups.notify_admins_block.message_placeholder')}
                  rows={4}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-amber-500 resize-none"
                />
                <div className="text-[10px] text-gray-400 mt-1">
                  {t('groupguard.groups.notify_admins_block.variables_label')}: <code className="bg-gray-100 px-1">{'{user}'}</code> -
                  {' '}{t('groupguard.groups.notify_admins_block.variable_user')},
                  <code className="bg-gray-100 px-1 mx-1">{'{userName}'}</code> -
                  {' '}{t('groupguard.groups.notify_admins_block.variable_userName')},
                  <code className="bg-gray-100 px-1 mx-1">{'{reason}'}</code> -
                  {' '}{t('groupguard.groups.notify_admins_block.variable_reason')},
                  <code className="bg-gray-100 px-1">{'{admins}'}</code> -
                  {' '}{t('groupguard.groups.notify_admins_block.variable_admins')}.
                  {' '}{t('groupguard.groups.notify_admins_block.empty_default')}.
                </div>
              </div>
            )}
          </div>

          {/* Info note */}
          <div className="text-xs text-gray-500 bg-white/60 rounded p-2 border border-amber-200">
            {t('groupguard.groups.notify_admins_block.bot_admin_will_kick')}
            <br />
            {t('groupguard.groups.notify_admins_block.bot_not_admin_will_tag')}
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================================
// ScanGroupModal - סריקת חברי קבוצה מול מאגר ספאמרים גלובלי
// ============================================================================

interface ScanResult {
  members: Array<{
    phone: string;
    whatsapp_id: string;
    is_admin: boolean;
    report_count: number;
    unique_groups_count: number;
    unique_workspaces_count: number;
    reason_summary: string | null;
    is_confirmed: boolean;
    first_reported_at: string | null;
    last_reported_at: string | null;
    has_member_profile: boolean;
    member_name: string | null;
  }>;
  scan_summary: {
    total_members: number;
    flagged_count: number;
    scanned_at: string;
    group_name?: string;
  };
}

function ScanGroupModal({
  group,
  onClose,
}: {
  group: GGGroup;
  onClose: () => void;
}) {
  const { t } = useT();
  const [phase, setPhase] = useState<'scanning' | 'results' | 'removing' | 'done'>('scanning');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [removalResults, setRemovalResults] = useState<{ phone: string; success: boolean; error?: string }[]>([]);

  // Trigger scan on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/groupguard/groups/${group.id}/scan`, {
          method: 'POST',
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || `Error ${res.status}`);
          setPhase('results');
          return;
        }
        setResult(data);
        // Pre-select all confirmed spammers (high-confidence ones)
        const confirmedPhones = new Set<string>(
          data.members
            .filter((m: ScanResult['members'][0]) => m.is_confirmed && !m.is_admin)
            .map((m: ScanResult['members'][0]) => m.phone),
        );
        setSelectedPhones(confirmedPhones);
        setPhase('results');
      } catch (e: any) {
        if (cancelled) return;
        setError(String(e?.message || e));
        setPhase('results');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  function togglePhone(phone: string) {
    setSelectedPhones((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) {
        next.delete(phone);
      } else {
        next.add(phone);
      }
      return next;
    });
  }

  function toggleAll() {
    if (!result) return;
    const removableCount = result.members.filter((m) => !m.is_admin).length;
    if (selectedPhones.size === removableCount) {
      setSelectedPhones(new Set());
    } else {
      setSelectedPhones(
        new Set(
          result.members.filter((m) => !m.is_admin).map((m) => m.phone),
        ),
      );
    }
  }

  async function handleRemove() {
    if (selectedPhones.size === 0) return;
    if (!confirm(t('groupguard.scan_modal.confirm_remove', { count: selectedPhones.size }))) return;

    setPhase('removing');
    try {
      const res = await fetch(`/api/groupguard/groups/${group.id}/bulk-remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones: Array.from(selectedPhones) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Error ${res.status}`);
        setPhase('results');
        return;
      }
      setRemovalResults(data.results || []);
      setPhase('done');
    } catch (e: any) {
      setError(String(e?.message || e));
      setPhase('results');
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between">
          <div>
            <h2 className="font-display font-bold text-xl text-gray-900 flex items-center gap-2">
              <Search className="w-5 h-5 text-purple-600" />
              {t('groupguard.scan_modal.title')}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {group.group_name || group.green_api_chat_id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {phase === 'scanning' && (
            <div className="p-12 text-center">
              <div className="inline-block w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4" />
              <p className="text-gray-700 font-medium">{t('groupguard.scan_modal.scanning')}</p>
              <p className="text-sm text-gray-500 mt-1">
                {t('groupguard.scan_modal.scanning_subtitle')}
              </p>
            </div>
          )}

          {phase === 'removing' && (
            <div className="p-12 text-center">
              <div className="inline-block w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mb-4" />
              <p className="text-gray-700 font-medium">{t('groupguard.scan_modal.removing', { count: selectedPhones.size })}</p>
              <p className="text-sm text-gray-500 mt-1">{t('groupguard.scan_modal.removing_subtitle')}</p>
            </div>
          )}

          {error && phase === 'results' && (
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-red-900">{t('groupguard.scan_modal.scan_error')}</div>
                    <div className="text-sm text-red-700 mt-1">{error}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {phase === 'results' && result && !error && (
            <div>
              {/* Summary */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {result.scan_summary.total_members}
                    </div>
                    <div className="text-xs text-gray-600">{t('groupguard.scan_modal.total_members')}</div>
                  </div>
                  <div>
                    <div
                      className={`text-2xl font-bold ${
                        result.scan_summary.flagged_count > 0
                          ? 'text-red-600'
                          : 'text-green-600'
                      }`}
                    >
                      {result.scan_summary.flagged_count}
                    </div>
                    <div className="text-xs text-gray-600">{t('groupguard.scan_modal.flagged_count')}</div>
                  </div>
                </div>
              </div>

              {/* Empty state */}
              {result.members.length === 0 && (
                <div className="p-12 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                    <Shield className="w-8 h-8" />
                  </div>
                  <h3 className="font-display font-bold text-lg text-gray-900">
                    {t('groupguard.scan_modal.group_clean')}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {t('groupguard.scan_modal.group_clean_message', { total: result.scan_summary.total_members })}
                  </p>
                </div>
              )}

              {/* Members list with checkboxes */}
              {result.members.length > 0 && (
                <div>
                  {/* Select all bar */}
                  <div className="px-6 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          selectedPhones.size > 0 &&
                          selectedPhones.size ===
                            result.members.filter((m) => !m.is_admin).length
                        }
                        onChange={toggleAll}
                        className="w-4 h-4 rounded text-purple-600"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {t('groupguard.scan_modal.select_all')}{' '}
                        {t('groupguard.scan_modal.removable_count', { count: result.members.filter((m) => !m.is_admin).length })}
                      </span>
                    </label>
                    <span className="text-xs text-gray-500">
                      {t('groupguard.scan_modal.selected_count', { count: selectedPhones.size })}
                    </span>
                  </div>

                  {/* List */}
                  <div className="divide-y divide-gray-100">
                    {result.members.map((m) => (
                      <div
                        key={m.phone}
                        className={`px-6 py-3 flex items-start gap-3 ${
                          m.is_admin ? 'bg-amber-50/50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPhones.has(m.phone)}
                          onChange={() => togglePhone(m.phone)}
                          disabled={m.is_admin}
                          className="w-4 h-4 rounded text-purple-600 mt-1 disabled:opacity-30"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900" dir="ltr">
                              +{m.phone}
                            </span>
                            {m.member_name && (
                              <span className="text-sm text-gray-600">
                                ({m.member_name})
                              </span>
                            )}
                            {m.is_admin && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded">
                                {t('groupguard.scan_modal.admin_cannot_remove')}
                              </span>
                            )}
                            {m.is_confirmed && (
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-medium rounded flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {t('groupguard.scan_modal.confirmed_spammer')}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>
                              <strong>{m.report_count}</strong> {t('groupguard.scan_modal.reports')}
                            </span>
                            <span>
                              {t('groupguard.scan_modal.in_groups')} <strong>{m.unique_groups_count}</strong>
                            </span>
                            <span>
                              {t('groupguard.scan_modal.by_clients')} <strong>{m.unique_workspaces_count}</strong>
                            </span>
                          </div>
                          {m.reason_summary && (
                            <div className="text-xs text-gray-500 mt-1 italic">
                              {t('groupguard.scan_modal.reason')}: {m.reason_summary}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {phase === 'done' && (
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-600 mb-4">
                  <Check className="w-8 h-8" />
                </div>
                <h3 className="font-display font-bold text-lg text-gray-900">
                  {t('groupguard.scan_modal.done_title')}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {t('groupguard.scan_modal.done_subtitle_success', { count: removalResults.filter((r) => r.success).length })}
                  {removalResults.filter((r) => !r.success).length > 0 &&
                    t('groupguard.scan_modal.done_subtitle_failures', { failed: removalResults.filter((r) => !r.success).length })}
                </p>
              </div>

              {/* Show failures */}
              {removalResults.filter((r) => !r.success).length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="font-medium text-sm text-red-900 mb-2">
                    {t('groupguard.scan_modal.failed_removals')}
                  </div>
                  <ul className="space-y-1 text-xs text-red-700">
                    {removalResults
                      .filter((r) => !r.success)
                      .map((r) => (
                        <li key={r.phone}>
                          <span dir="ltr">+{r.phone}</span> - {r.error}
                        </li>
                      ))}
                  </ul>
                  <div className="text-xs text-red-600 mt-2">
                    {t('groupguard.scan_modal.failure_hint')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50 rounded-b-2xl">
          {phase === 'results' && result && result.members.length > 0 && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                {t('groupguard.scan_modal.cancel')}
              </button>
              <button
                onClick={handleRemove}
                disabled={selectedPhones.size === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <UserX className="w-4 h-4" />
                {selectedPhones.size > 0
                  ? t('groupguard.scan_modal.remove_button_count', { count: selectedPhones.size })
                  : t('groupguard.scan_modal.remove_button_default')}
              </button>
            </>
          )}
          {phase === 'done' && (
            <button
              onClick={onClose}
              className="ml-auto px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg"
            >
              {t('groupguard.scan_modal.close')}
            </button>
          )}
          {(phase === 'scanning' || phase === 'removing') && (
            <button
              onClick={onClose}
              className="ml-auto px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg"
            >
              {t('groupguard.scan_modal.close_continues_bg')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
