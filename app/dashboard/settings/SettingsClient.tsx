'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Workspace, WorkspaceMember, MemberRole } from '@/lib/types/database';
import { Users, Palette, Building2, Check, Crown, Shield, Edit3, Eye, UserPlus, X, Mail, Copy, Loader2 } from 'lucide-react';
import LanguageSettings from './LanguageSettings';
import { isValidLocale, DEFAULT_LOCALE } from '@/lib/i18n/locales';
import { useT } from '@/lib/i18n/useT';

const COLORS = [
  '#7c3aed', '#2563eb', '#0891b2', '#059669',
  '#d97706', '#dc2626', '#db2777', '#475569',
];

const ROLE_INFO: Record<MemberRole, { label: string; icon: React.ReactNode; color: string }> = {
  owner:  { label: 'בעלים', icon: <Crown className="w-3.5 h-3.5" />,  color: 'bg-amber-100 text-amber-700' },
  admin:  { label: 'מנהל',  icon: <Shield className="w-3.5 h-3.5" />, color: 'bg-purple-100 text-purple-700' },
  editor: { label: 'עורך',  icon: <Edit3 className="w-3.5 h-3.5" />,  color: 'bg-blue-100 text-blue-700' },
  viewer: { label: 'צופה',  icon: <Eye className="w-3.5 h-3.5" />,    color: 'bg-gray-100 text-gray-600' },
};

export default function SettingsClient({
  workspace, members, userId, userEmail, myRole,
}: {
  workspace: Workspace;
  members: WorkspaceMember[];
  userId: string;
  userEmail: string;
  myRole: MemberRole;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useT();

  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.business_description || '');
  const [color, setColor] = useState(workspace.primary_color);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const canEdit = myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';

  async function handleSave() {
    if (!canEdit) return;
    setSaving(true);
    setSavedMsg('');
    const { error } = await supabase
      .from('workspaces')
      .update({
        name: name.trim(),
        business_description: description.trim() || null,
        primary_color: color,
      })
      .eq('id', workspace.id);

    setSaving(false);
    if (error) {
      setSavedMsg(t('errors.save_failed') + ': ' + error.message);
    } else {
      setSavedMsg(t('records.saved') + ' ✓');
      setTimeout(() => setSavedMsg(''), 3000);
      router.refresh();
    }
  }

  const trialDays = Math.max(0, Math.ceil(
    (new Date(workspace.trial_ends_at).getTime() - Date.now()) / 86400000
  ));

  return (
    <div className="p-4 md:p-8 pr-4 md:pr-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl mb-1">{t('settings.title')}</h1>
        <p className="text-gray-500">{t('settings.workspace')}</p>
      </div>

      {/* Plan */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-lg mb-1">{t('settings.title')}</h2>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-700 uppercase">
                {workspace.plan}
              </span>
              {workspace.plan === 'trial' && (
                <span className="text-sm text-gray-500">
                  נותרו {trialDays} ימים
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">הודעות AI החודש</div>
            <div className="font-bold text-lg">
              {workspace.ai_messages_used.toLocaleString()} / {workspace.ai_messages_limit.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Workspace details */}
      <div className="card p-6 mb-6">
        <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
          <Building2 className="w-5 h-5" /> {t('settings.workspace_name')}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              שם העסק
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit || saving}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              תיאור העסק
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEdit || saving}
              rows={3}
              placeholder="תיאור קצר (עוזר ל-AI לסווג הודעות טוב יותר)"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
              <Palette className="w-4 h-4" /> צבע מותג
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={!canEdit || saving}
                  onClick={() => setColor(c)}
                  className={`w-9 h-9 rounded-lg transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ background: c }}
                >
                  {color === c && <Check className="w-5 h-5 text-white mx-auto" />}
                </button>
              ))}
            </div>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
                {saving ? t('common.saving') : t('common.save')}
              </button>
              {savedMsg && (
                <span className={`text-sm ${savedMsg.includes(t('errors.save_failed')) ? 'text-red-600' : 'text-green-600'}`}>
                  {savedMsg}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Language settings */}
      <LanguageSettings
        workspaceId={workspace.id}
        currentLocale={isValidLocale((workspace as any).locale) ? (workspace as any).locale : DEFAULT_LOCALE}
        canEdit={canEdit}
      />

      {/* Team members */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <Users className="w-5 h-5" /> {t('settings.members')}
          </h2>
          <span className="text-xs text-gray-500">{members.length} חברים</span>
        </div>

        <div className="space-y-2">
          {members.map((m) => {
            const info = ROLE_INFO[m.role];
            const isMe = m.user_id === userId;
            return (
              <div
                key={m.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50/70 border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-sm font-semibold">
                    {(m.display_name || userEmail).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {m.display_name || (isMe ? userEmail : 'חבר צוות')}
                      {isMe && <span className="text-xs text-gray-400 mr-2">(אתם)</span>}
                    </div>
                    {m.whatsapp_phone && (
                      <div className="text-xs text-gray-500 font-mono" dir="ltr">{m.whatsapp_phone}</div>
                    )}
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${info.color}`}>
                  {info.icon} {info.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <InviteSection
            workspaceId={workspace.id}
            workspaceName={workspace.name}
            isAdmin={isOwner || myRole === 'admin'}
          />
        </div>
      </div>

      {/* Danger zone */}
      {isOwner && (
        <div className="card p-6 border-red-200">
          <h2 className="font-display font-bold text-lg text-red-700 mb-2">{t('common.warning')}</h2>
          <p className="text-sm text-gray-600 mb-4">
            מחיקת ה-workspace תמחק את כל הטבלאות, הרשומות וההודעות. פעולה זו בלתי הפיכה.
          </p>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-red-300 text-red-700 hover:bg-red-50 transition-colors"
            onClick={() => alert('מחיקת workspace עדיין לא זמינה. פנו לתמיכה.')}
          >
            מחיקת workspace
          </button>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Invite Members Section
// ────────────────────────────────────────────────────────────────────────

function InviteSection({
  workspaceId, workspaceName, isAdmin,
}: {
  workspaceId: string;
  workspaceName: string;
  isAdmin: boolean;
}) {
  const supabase = createClient();
  const [showForm, setShowForm] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  // Form fields
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'editor' | 'viewer'>('editor');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ url: string; email: string } | null>(null);

  // Load pending invites on mount
  useState(() => {
    loadPending();
  });

  async function loadPending() {
    setLoadingInvites(true);
    const { data } = await supabase
      .from('workspace_invitations')
      .select('id, email, role, display_name, status, created_at, expires_at, token')
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setPendingInvites(data || []);
    setLoadingInvites(false);
  }

  async function handleInvite() {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          email: email.trim().toLowerCase(),
          role,
          display_name: displayName.trim() || null,
          message: message.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'שגיאה ביצירת ההזמנה');
        setBusy(false);
        return;
      }

      setSuccess({ url: data.accept_url, email: email.trim() });
      setEmail('');
      setDisplayName('');
      setMessage('');
      await loadPending();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelInvite(id: string) {
    if (!confirm('לבטל את ההזמנה?')) return;
    await fetch(`/api/invitations?id=${id}`, { method: 'DELETE' });
    await loadPending();
  }

  if (!isAdmin) {
    return (
      <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600">
        💡 רק בעלים ומנהלים יכולים להזמין חברי צוות חדשים
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Pending invitations */}
      {pendingInvites.length > 0 && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-700">
            הזמנות ממתינות ({pendingInvites.length})
          </div>
          <ul>
            {pendingInvites.map(inv => (
              <li key={inv.id} className="px-3 py-2 flex items-center gap-2 text-sm border-b border-gray-100 last:border-b-0">
                <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-800 truncate">{inv.email}</div>
                  <div className="text-[10px] text-gray-500">
                    {ROLE_INFO[inv.role as MemberRole]?.label || inv.role} · 
                    פג תוקף ב-{new Date(inv.expires_at).toLocaleDateString('he-IL', { day: '2-digit', month: 'short' })}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/invite/${inv.token}`;
                    navigator.clipboard.writeText(url);
                    alert('הקישור הועתק ללוח');
                  }}
                  className="p-1.5 text-gray-400 hover:text-purple-600 transition-colors"
                  title="העתק קישור"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => cancelInvite(inv.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                  title="בטל הזמנה"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Invite button or form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-400 transition-colors font-medium text-sm flex items-center justify-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          הזמן חבר צוות חדש
        </button>
      ) : (
        <div className="border border-purple-200 rounded-xl p-4 bg-purple-50/30 space-y-3">
          {success ? (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-900 flex items-start gap-2">
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-600" />
                <div>
                  <div className="font-bold">ההזמנה נוצרה!</div>
                  <div className="text-xs mt-1">
                    שלח את הקישור הבא ל-{success.email} (האימייל ינסה להישלח אוטומטית, אך גם תוכל להעתיק):
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={success.url}
                  readOnly
                  className="flex-1 text-xs p-2 bg-white border border-gray-200 rounded-lg font-mono"
                  dir="ltr"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(success.url);
                    alert('הקישור הועתק!');
                  }}
                  className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setSuccess(null); setShowForm(false); }}
                  className="text-xs text-gray-600 hover:text-gray-900"
                >
                  סגור
                </button>
                <button
                  onClick={() => setSuccess(null)}
                  className="text-xs text-purple-700 font-medium mr-auto"
                >
                  + הזמן עוד אחד
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-purple-600" />
                  הזמנה חדשה ל-{workspaceName}
                </h4>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  אימייל <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  dir="ltr"
                  className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">תפקיד</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['admin', 'editor', 'viewer'] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        role === r
                          ? 'bg-purple-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:border-purple-300'
                      }`}
                    >
                      {ROLE_INFO[r]?.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">שם תצוגה (אופציונלי)</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="איך לקרוא לו במערכת"
                  className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">הודעה אישית (אופציונלי)</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="היי, הצטרף לצוות שלנו במערכת..."
                  rows={2}
                  className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 resize-none"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-800">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
                  disabled={busy}
                >
                  ביטול
                </button>
                <button
                  onClick={handleInvite}
                  disabled={busy || !email.trim()}
                  className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      שולח...
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      שלח הזמנה
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
