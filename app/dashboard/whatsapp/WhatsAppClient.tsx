'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Workspace, WaMessage, WhatsAppGroup, MessageStatus } from '@/lib/types/database';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  MessageSquare, Check, AlertCircle, Clock, Copy,
  Zap, ExternalLink, RefreshCw, Lock,
} from 'lucide-react';
import GroupsManager from '@/components/GroupsManager';
import InstancesManager from '@/components/instances/InstancesManager';
import { useDevMode } from '@/lib/hooks/useDevMode';

export default function WhatsAppClient({
  workspace,
  allWorkspaces,
  initialMessages,
  initialGroups,
  canEdit,
}: {
  workspace: Workspace;
  allWorkspaces?: Array<{ id: string; name: string; icon: string | null }>;
  initialMessages: WaMessage[];
  initialGroups: WhatsAppGroup[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { enabled: devMode } = useDevMode();
  const canEditCredentials = canEdit && devMode;
  const [instanceId, setInstanceId] = useState(workspace.whatsapp_instance_id || '');
  const [token, setToken] = useState(workspace.whatsapp_token || '');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [testingConn, setTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const isConnected = !!(workspace.whatsapp_instance_id && workspace.whatsapp_token);

  // webhook URL — set this in Green API "System notifications" section
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const webhookUrl = `${siteUrl}/api/whatsapp/webhook?workspace=${workspace.id}`;

  async function handleSaveConnection() {
    if (!canEdit) return;
    setSaving(true);
    setSavedMsg('');
    setTestResult(null);

    const { error } = await supabase
      .from('workspaces')
      .update({
        whatsapp_instance_id: instanceId.trim() || null,
        whatsapp_token: token.trim() || null,
      })
      .eq('id', workspace.id);

    setSaving(false);
    if (error) {
      setSavedMsg('שגיאה בשמירה: ' + error.message);
    } else {
      setSavedMsg('נשמר בהצלחה ✓');
      setTimeout(() => setSavedMsg(''), 3000);
    }
  }

  async function handleTestConnection() {
    if (!instanceId.trim() || !token.trim()) {
      setTestResult({ ok: false, msg: 'יש להזין Instance ID ו-Token' });
      return;
    }
    setTestingConn(true);
    setTestResult(null);
    try {
      // Green API getStateInstance — checks if phone is authorized
      const url = `https://api.green-api.com/waInstance${instanceId.trim()}/getStateInstance/${token.trim()}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.stateInstance === 'authorized') {
        setTestResult({ ok: true, msg: 'מחובר ומורשה ✓' });
      } else if (res.ok) {
        setTestResult({ ok: false, msg: `סטטוס: ${data.stateInstance || 'לא ידוע'} — יש לסרוק את קוד ה-QR` });
      } else {
        setTestResult({ ok: false, msg: `שגיאה: ${data.message || res.statusText}` });
      }
    } catch (e: any) {
      setTestResult({ ok: false, msg: 'שגיאת רשת: ' + (e?.message || 'לא ידוע') });
    }
    setTestingConn(false);
  }

  function copyWebhook() {
    navigator.clipboard.writeText(webhookUrl);
    setSavedMsg('הועתק ✓');
    setTimeout(() => setSavedMsg(''), 2000);
  }

  return (
    <div className="p-4 md:p-8 pr-4 md:pr-8 max-w-5xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-3xl mb-1">וואטסאפ</h1>
          <p className="text-gray-500">חברו את הוואטסאפ כדי לקלוט רשומות אוטומטית מהודעות</p>
        </div>
        {allWorkspaces && allWorkspaces.length > 1 && (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <span className="text-xs text-gray-500 font-medium">סביבה:</span>
            <select
              value={workspace.id}
              onChange={(e) => router.push(`/dashboard/whatsapp?ws=${e.target.value}`)}
              className="text-sm font-medium bg-transparent border-0 focus:outline-none cursor-pointer pr-1"
            >
              {allWorkspaces.map(ws => (
                <option key={ws.id} value={ws.id}>
                  {ws.icon || '📊'} {ws.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* WhatsApp Instances Manager */}
      <div className="mb-6">
        <InstancesManager
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          canEdit={canEdit}
        />
      </div>

      {/* Groups - full routing management */}
      <GroupsManager workspaceId={workspace.id} canEdit={canEdit} />

      {/* Recent messages */}
      <div className="card p-6">
        <h2 className="font-display font-bold text-lg mb-4">הודעות אחרונות</h2>
        {initialMessages.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>עוד לא התקבלו הודעות</p>
            <p className="text-xs mt-1">הודעות שיגיעו דרך ה-webhook יופיעו כאן</p>
          </div>
        ) : (
          <div className="space-y-2">
            {initialMessages.map((m) => (
              <MessageRow key={m.id} msg={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageRow({ msg }: { msg: WaMessage }) {
  const statusInfo: Record<MessageStatus, { label: string; color: string; icon: React.ReactNode }> = {
    received:   { label: 'התקבלה',    color: 'bg-gray-100 text-gray-600',   icon: <Clock className="w-3 h-3" /> },
    classified: { label: 'סווגה',     color: 'bg-blue-100 text-blue-700',   icon: <Zap className="w-3 h-3" /> },
    inserted:   { label: 'נשמרה',     color: 'bg-green-100 text-green-700', icon: <Check className="w-3 h-3" /> },
    sent:       { label: 'נשלחה',     color: 'bg-emerald-100 text-emerald-700', icon: <Check className="w-3 h-3" /> },
    logged:     { label: 'נרשמה',     color: 'bg-slate-100 text-slate-600',  icon: <MessageSquare className="w-3 h-3" /> },
    failed:     { label: 'נכשלה',     color: 'bg-red-100 text-red-700',     icon: <AlertCircle className="w-3 h-3" /> },
    ignored:    { label: 'התעלמנו',   color: 'bg-gray-100 text-gray-400',   icon: <AlertCircle className="w-3 h-3" /> },
  };
  // Safe fallback so an unknown status string from the DB never crashes the page
  const info = statusInfo[msg.status] || {
    label: msg.status || 'לא ידוע',
    color: 'bg-gray-100 text-gray-500',
    icon: <Clock className="w-3 h-3" />,
  };

  return (
    <div className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50/50 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-green-100 text-green-700 grid place-items-center shrink-0 text-xs font-semibold">
            {(msg.sender_name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">
              {msg.sender_name || msg.sender_phone || 'לא ידוע'}
            </div>
            <div className="text-[10px] text-gray-400" dir="ltr">
              {msg.received_at && format(new Date(msg.received_at), 'd MMM, HH:mm', { locale: he })}
            </div>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${info.color}`}>
          {info.icon} {info.label}
        </span>
      </div>
      {msg.text && (
        <div className="text-sm text-gray-700 line-clamp-2 pr-9">{msg.text}</div>
      )}
      {msg.ai_error && (
        <div className="text-xs text-red-600 mt-1 pr-9">⚠ {msg.ai_error}</div>
      )}
    </div>
  );
}
