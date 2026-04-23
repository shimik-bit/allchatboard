'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Workspace, WaMessage, WhatsAppGroup, MessageStatus } from '@/lib/types/database';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  MessageSquare, Check, AlertCircle, Clock, Copy,
  Zap, ExternalLink, RefreshCw,
} from 'lucide-react';

export default function WhatsAppClient({
  workspace,
  initialMessages,
  initialGroups,
  canEdit,
}: {
  workspace: Workspace;
  initialMessages: WaMessage[];
  initialGroups: WhatsAppGroup[];
  canEdit: boolean;
}) {
  const supabase = createClient();
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
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl mb-1">וואטסאפ</h1>
        <p className="text-gray-500">חברו את הוואטסאפ כדי לקלוט רשומות אוטומטית מהודעות</p>
      </div>

      {/* Connection status */}
      <div className="card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-lg">סטטוס חיבור</h2>
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
            isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {isConnected ? <><Check className="w-3.5 h-3.5" /> מחובר</> : <><Clock className="w-3.5 h-3.5" /> לא מחובר</>}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Green API Instance ID
            </label>
            <input
              type="text"
              value={instanceId}
              onChange={(e) => setInstanceId(e.target.value)}
              disabled={!canEdit || saving}
              placeholder="1103xxxxxxx"
              dir="ltr"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Green API Token (API Token Instance)
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={!canEdit || saving}
              placeholder="••••••••••••••••"
              dir="ltr"
              className="input-field"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSaveConnection}
              disabled={!canEdit || saving}
              className="btn-primary text-sm"
            >
              {saving ? 'שומר...' : 'שמירה'}
            </button>
            <button
              onClick={handleTestConnection}
              disabled={testingConn || !instanceId.trim() || !token.trim()}
              className="btn-secondary text-sm"
            >
              {testingConn ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              בדיקת חיבור
            </button>
            {savedMsg && <span className="text-sm text-green-600">{savedMsg}</span>}
            {testResult && (
              <span className={`text-sm inline-flex items-center gap-1 ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {testResult.msg}
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-gray-100">
          <a
            href="https://green-api.com/docs/before-start/"
            target="_blank"
            rel="noopener"
            className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1"
          >
            איך מקבלים Instance ID ו-Token מ-Green API
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Webhook URL */}
      <div className="card p-6 mb-6">
        <h2 className="font-display font-bold text-lg mb-2">כתובת Webhook</h2>
        <p className="text-sm text-gray-600 mb-4">
          הדביקו את הכתובת הזאת בהגדרות ה-Green API תחת &quot;הגדרות התראות&quot; והפעילו את
          <span className="font-mono mx-1" dir="ltr">incomingMessageReceived</span>.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2.5 bg-gray-50 rounded-lg text-xs font-mono border border-gray-200 overflow-x-auto" dir="ltr">
            {webhookUrl}
          </code>
          <button onClick={copyWebhook} className="btn-secondary text-sm whitespace-nowrap">
            <Copy className="w-4 h-4" /> העתק
          </button>
        </div>
      </div>

      {/* Groups */}
      {initialGroups.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="font-display font-bold text-lg mb-4">קבוצות פעילות</h2>
          <div className="space-y-2">
            {initialGroups.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50/70 border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-100 text-green-700 grid place-items-center">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{g.group_name || 'ללא שם'}</div>
                    <div className="text-xs text-gray-500 font-mono" dir="ltr">{g.green_api_chat_id}</div>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  g.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {g.is_active ? 'פעיל' : 'כבוי'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
    failed:     { label: 'נכשלה',     color: 'bg-red-100 text-red-700',     icon: <AlertCircle className="w-3 h-3" /> },
    ignored:    { label: 'התעלמנו',   color: 'bg-gray-100 text-gray-400',   icon: <AlertCircle className="w-3 h-3" /> },
  };
  const info = statusInfo[msg.status];

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
