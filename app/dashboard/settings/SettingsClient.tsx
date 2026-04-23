'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Workspace, WorkspaceMember, MemberRole } from '@/lib/types/database';
import { Users, Palette, Building2, Check, Crown, Shield, Edit3, Eye } from 'lucide-react';

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
      setSavedMsg('שגיאה: ' + error.message);
    } else {
      setSavedMsg('נשמר בהצלחה ✓');
      setTimeout(() => setSavedMsg(''), 3000);
      router.refresh();
    }
  }

  const trialDays = Math.max(0, Math.ceil(
    (new Date(workspace.trial_ends_at).getTime() - Date.now()) / 86400000
  ));

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl mb-1">הגדרות</h1>
        <p className="text-gray-500">ניהול הsworkspace והצוות</p>
      </div>

      {/* Plan */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-bold text-lg mb-1">התוכנית שלך</h2>
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
          <Building2 className="w-5 h-5" /> פרטי העסק
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
                {saving ? 'שומר...' : 'שמירה'}
              </button>
              {savedMsg && (
                <span className={`text-sm ${savedMsg.includes('שגיאה') ? 'text-red-600' : 'text-green-600'}`}>
                  {savedMsg}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Team members */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <Users className="w-5 h-5" /> חברי צוות
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

        <div className="mt-4 p-3 rounded-lg bg-brand-50/40 border border-brand-100 text-xs text-brand-900">
          💡 הזמנת חברי צוות חדשים תיפתח בקרוב
        </div>
      </div>

      {/* Danger zone */}
      {isOwner && (
        <div className="card p-6 border-red-200">
          <h2 className="font-display font-bold text-lg text-red-700 mb-2">אזור מסוכן</h2>
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
