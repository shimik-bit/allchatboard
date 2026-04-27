'use client';

/**
 * InstancesManager - main UI for managing WhatsApp instances.
 *
 * Shows: list of instances, statuses, action buttons (connect, pause, delete).
 * Used in /dashboard/whatsapp page for workspace owners/admins.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Smartphone, RefreshCw, Trash2, Power, PowerOff,
  CheckCircle2, AlertCircle, Clock, X, Loader2, Copy, ExternalLink,
  Wifi, WifiOff, Settings as SettingsIcon, ChevronDown, ChevronUp,
} from 'lucide-react';

type Instance = {
  id: string;
  display_name: string;
  provider: string;
  provider_instance_id: string;
  phone_number: string | null;
  state: string;
  state_message: string | null;
  state_updated_at: string;
  authorized_at: string | null;
  expires_at: string | null;
  messages_received_total: number;
  messages_sent_total: number;
  last_message_at: string | null;
  created_at: string;
};

const STATE_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  authorized:   { color: 'text-green-700',  bg: 'bg-green-100',  icon: CheckCircle2, label: 'מחובר' },
  awaiting_qr:  { color: 'text-amber-700',  bg: 'bg-amber-100',  icon: Clock,        label: 'ממתין לסריקת QR' },
  scanning:     { color: 'text-blue-700',   bg: 'bg-blue-100',   icon: Smartphone,   label: 'סריקה...' },
  created:      { color: 'text-gray-600',   bg: 'bg-gray-100',   icon: Loader2,      label: 'נוצר...' },
  expired:      { color: 'text-orange-700', bg: 'bg-orange-100', icon: WifiOff,      label: 'פג תוקף - יש להתחבר מחדש' },
  paused:       { color: 'text-gray-500',   bg: 'bg-gray-100',   icon: PowerOff,     label: 'מושעה' },
  failed:       { color: 'text-red-700',    bg: 'bg-red-100',    icon: AlertCircle,  label: 'שגיאה' },
  deleted:      { color: 'text-gray-400',   bg: 'bg-gray-50',    icon: X,            label: 'נמחק' },
};

export default function InstancesManager({
  workspaceId,
  workspaceName,
  canEdit,
}: {
  workspaceId: string;
  workspaceName: string;
  canEdit: boolean;
}) {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [partnerTokenAvailable, setPartnerTokenAvailable] = useState(false);
  const [qrInstance, setQrInstance] = useState<Instance | null>(null);

  const loadInstances = useCallback(async () => {
    try {
      const res = await fetch(`/api/instances?workspace_id=${workspaceId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setInstances(data.instances || []);
      setPartnerTokenAvailable(data.partner_token_configured);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadInstances();
    // Poll status every 15 seconds
    const interval = setInterval(loadInstances, 15000);
    return () => clearInterval(interval);
  }, [loadInstances]);

  if (loading) {
    return (
      <div className="card p-6 text-center text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
        טוען instances...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-display font-bold text-xl">חיבורי WhatsApp</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            כל instance = מספר WhatsApp אחד מחובר ל-{workspaceName}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold hover:opacity-90 transition-opacity shadow-sm"
          >
            <Plus className="w-4 h-4" />
            חבר WhatsApp חדש
          </button>
        )}
      </div>

      {/* Instances list */}
      {instances.length === 0 ? (
        <div className="card p-8 text-center">
          <Smartphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 font-bold mb-1">עוד לא חוברה WhatsApp</p>
          <p className="text-sm text-gray-500 mb-4">
            חבר WhatsApp כדי להתחיל לקבל הודעות מקבוצות ושיחות פרטיות
          </p>
          {canEdit && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              חבר WhatsApp עכשיו
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {instances.filter(i => i.state !== 'deleted').map((inst) => (
            <InstanceCard
              key={inst.id}
              instance={inst}
              workspaceId={workspaceId}
              canEdit={canEdit}
              onChange={loadInstances}
              onShowQr={() => setQrInstance(inst)}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CreateInstanceModal
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          partnerTokenAvailable={partnerTokenAvailable}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(instance) => {
            setShowCreateModal(false);
            loadInstances();
            // Auto-open QR for new instance if not authorized
            if (instance.state !== 'authorized') {
              setQrInstance(instance);
            }
          }}
        />
      )}

      {/* QR scan modal */}
      {qrInstance && (
        <QrScanModal
          instance={qrInstance}
          onClose={() => setQrInstance(null)}
          onAuthorized={() => {
            setQrInstance(null);
            loadInstances();
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Single instance card
// ──────────────────────────────────────────────────────────────────────

function InstanceCard({
  instance, workspaceId, canEdit, onChange, onShowQr,
}: {
  instance: Instance;
  workspaceId: string;
  canEdit: boolean;
  onChange: () => void;
  onShowQr: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const config = STATE_CONFIG[instance.state] || STATE_CONFIG.created;
  const StateIcon = config.icon;
  const isAuthorized = instance.state === 'authorized';
  const needsQr = ['awaiting_qr', 'scanning', 'expired'].includes(instance.state);

  async function handlePause() {
    if (!canEdit || busy) return;
    setBusy(true);
    try {
      await fetch(`/api/instances/${instance.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: instance.state !== 'paused' }),
      });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(mode: 'logout' | 'delete') {
    if (!canEdit) return;
    const message = mode === 'delete'
      ? `מחיקה מלאה של "${instance.display_name}"? פעולה זו לא ניתנת לביטול וה-instance יימחק גם מ-Green API.`
      : `לנתק את ${instance.display_name} מ-WhatsApp? תוכל להתחבר שוב מאוחר יותר.`;
    if (!confirm(message)) return;
    setBusy(true);
    try {
      await fetch(`/api/instances/${instance.id}?mode=${mode}`, { method: 'DELETE' });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshStatus() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/instances/${instance.id}/status`);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/whatsapp/webhook?workspace=${workspaceId}`
    : '';

  return (
    <div className="card overflow-hidden">
      {/* Header row */}
      <div
        className={`p-4 flex items-center gap-3 cursor-pointer transition-colors ${expanded ? 'bg-gray-50' : 'hover:bg-gray-50/70'}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-10 h-10 rounded-lg grid place-items-center flex-shrink-0 ${config.bg}`}>
          <StateIcon className={`w-5 h-5 ${config.color} ${instance.state === 'created' ? 'animate-spin' : ''}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm truncate">{instance.display_name}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${config.bg} ${config.color}`}>
              {config.label}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
            {instance.phone_number && <span>📞 {instance.phone_number}</span>}
            <span className="font-mono text-[10px]">ID: {instance.provider_instance_id}</span>
            {isAuthorized && (
              <>
                <span>·</span>
                <span>📥 {instance.messages_received_total} נקלטו</span>
              </>
            )}
          </div>
        </div>

        {/* Quick action: connect/scan QR */}
        {needsQr && canEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowQr();
            }}
            className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700"
          >
            סרוק QR
          </button>
        )}

        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-400" />
          : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/30 p-4 space-y-4" onClick={(e) => e.stopPropagation()}>
          {/* Status details */}
          <div className="bg-white rounded-lg border border-gray-100 p-3">
            <p className="text-xs font-bold text-gray-700 mb-1">סטטוס</p>
            <p className="text-sm text-gray-900 mb-1">{instance.state_message || config.label}</p>
            <p className="text-[10px] text-gray-400">
              עודכן {new Date(instance.state_updated_at).toLocaleString('he-IL')}
            </p>
            {instance.expires_at && (
              <p className="text-[10px] text-amber-600 mt-1">
                ⏰ תקף עד {new Date(instance.expires_at).toLocaleDateString('he-IL')}
              </p>
            )}
          </div>

          {/* Webhook URL display */}
          <div className="bg-white rounded-lg border border-gray-100 p-3">
            <p className="text-xs font-bold text-gray-700 mb-2">Webhook URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] text-gray-700 bg-gray-50 p-2 rounded border border-gray-100 font-mono break-all" dir="ltr">
                {webhookUrl}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(webhookUrl);
                  alert('הקישור הועתק');
                }}
                className="p-2 text-gray-400 hover:text-purple-600"
                title="העתק"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5">
              ה-webhook הוגדר אוטומטית. אם הקבוצות לא נכנסות, נסה לרענן את ה-webhook.
            </p>
          </div>

          {/* Actions */}
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleRefreshStatus}
                disabled={busy}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-medium disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
                רענן סטטוס
              </button>

              {isAuthorized && (
                <button
                  onClick={handlePause}
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  <Power className="w-3.5 h-3.5" />
                  השעה זמנית
                </button>
              )}

              {instance.state === 'paused' && (
                <button
                  onClick={handlePause}
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  <Power className="w-3.5 h-3.5" />
                  הפעל מחדש
                </button>
              )}

              <button
                onClick={() => handleDelete('logout')}
                disabled={busy}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-lg text-xs font-medium disabled:opacity-50"
              >
                <WifiOff className="w-3.5 h-3.5" />
                נתק WhatsApp
              </button>

              <button
                onClick={() => handleDelete('delete')}
                disabled={busy}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-medium disabled:opacity-50 mr-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                מחק לגמרי
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Create new instance modal
// ──────────────────────────────────────────────────────────────────────

function CreateInstanceModal({
  workspaceId, workspaceName, partnerTokenAvailable, onClose, onSuccess,
}: {
  workspaceId: string;
  workspaceName: string;
  partnerTokenAvailable: boolean;
  onClose: () => void;
  onSuccess: (instance: Instance) => void;
}) {
  const [mode, setMode] = useState<'auto' | 'manual'>(partnerTokenAvailable ? 'auto' : 'manual');
  const [displayName, setDisplayName] = useState(`WhatsApp של ${workspaceName}`);
  const [plan, setPlan] = useState<'developer' | 'mini' | 'business' | 'pro'>('developer');
  const [manualInstanceId, setManualInstanceId] = useState('');
  const [manualToken, setManualToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true);
    setError(null);

    const payload: any = {
      workspace_id: workspaceId,
      display_name: displayName.trim(),
      manual: mode === 'manual',
    };

    if (mode === 'auto') {
      payload.plan = plan;
    } else {
      payload.manual_instance_id = manualInstanceId.trim();
      payload.manual_token = manualToken.trim();
    }

    try {
      const res = await fetch('/api/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'שגיאה ביצירה');
        setBusy(false);
        return;
      }
      onSuccess(data.instance);
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-display font-bold text-xl flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-purple-600" />
              חבר WhatsApp חדש
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              תיצור instance חדש או תחבר קיים מ-Green API
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setMode('auto')}
            disabled={!partnerTokenAvailable}
            className={`p-3 rounded-xl border-2 text-right transition-all ${
              mode === 'auto'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-gray-300'
            } ${!partnerTokenAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="font-bold text-sm">⚡ יצירה אוטומטית</div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              {partnerTokenAvailable ? 'נוצר אוטומטית ב-Green API' : 'דורש Partner Token'}
            </div>
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`p-3 rounded-xl border-2 text-right transition-all ${
              mode === 'manual'
                ? 'border-purple-500 bg-purple-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="font-bold text-sm">📝 חיבור ידני</div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              הכנס פרטים מ-Green API שלך
            </div>
          </button>
        </div>

        <div className="space-y-3">
          {/* Display name */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              שם תצוגה <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="WhatsApp של מחלקת מכירות"
              className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200"
              autoFocus
            />
          </div>

          {mode === 'auto' && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                תוכנית
              </label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as any)}
                className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200"
              >
                <option value="developer">Developer (חינם, 14 יום ניסיון)</option>
                <option value="mini">Mini ($15/חודש)</option>
                <option value="business">Business ($39/חודש)</option>
                <option value="pro">Pro ($79/חודש)</option>
              </select>
              <p className="text-[10px] text-gray-500 mt-1">
                💡 התחל ב-Developer לבדיקה. תוכל לשדרג אחר כך מ-Green API console.
              </p>
            </div>
          )}

          {mode === 'manual' && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Green API Instance ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={manualInstanceId}
                  onChange={(e) => setManualInstanceId(e.target.value)}
                  placeholder="7107597263"
                  dir="ltr"
                  className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  API Token <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  placeholder="ניתן ב-Green API console"
                  dir="ltr"
                  className="w-full text-sm p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 font-mono"
                />
              </div>
              <p className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded-lg">
                📍 מצא את הפרטים ב-<a href="https://console.green-api.com/" target="_blank" rel="noopener" className="text-purple-600 underline">console.green-api.com</a>:
                לחץ על Instance → תראה Instance ID ו-API Token Instance.
              </p>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
              disabled={busy}
            >
              ביטול
            </button>
            <button
              onClick={handleCreate}
              disabled={busy || !displayName.trim() || (mode === 'manual' && (!manualInstanceId.trim() || !manualToken.trim()))}
              className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
            >
              {busy ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  יוצר...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  צור Instance
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// QR scan modal - polls every 5s for status change
// ──────────────────────────────────────────────────────────────────────

function QrScanModal({
  instance, onClose, onAuthorized,
}: {
  instance: Instance;
  onClose: () => void;
  onAuthorized: () => void;
}) {
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'qr' | 'authorized' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  const fetchQr = useCallback(async () => {
    try {
      const res = await fetch(`/api/instances/${instance.id}/qr`);
      const data = await res.json();

      if (data.status === 'authorized') {
        setStatus('authorized');
        // Wait a moment so user sees success, then close
        setTimeout(onAuthorized, 1500);
        return;
      }

      if (data.status === 'qr' && data.qr_base64) {
        setQrBase64(data.qr_base64);
        setStatus('qr');
        return;
      }

      setStatus('error');
      setError(data.message || 'לא הצלחנו לקבל QR code');
    } catch (err: any) {
      setStatus('error');
      setError(err.message);
    }
  }, [instance.id, onAuthorized]);

  useEffect(() => {
    fetchQr();
    // Poll every 5 seconds while showing QR
    const interval = setInterval(fetchQr, 5000);
    return () => clearInterval(interval);
  }, [fetchQr]);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 grid place-items-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-display font-bold text-xl">סרוק קוד QR</h3>
            <p className="text-xs text-gray-500 mt-1">
              חיבור {instance.display_name} ל-WhatsApp
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QR display */}
        <div className="bg-gradient-to-b from-gray-50 to-white border-2 border-gray-200 rounded-2xl p-6 mb-4 grid place-items-center min-h-[280px]">
          {status === 'loading' && (
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-purple-600 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-600">מייצר קוד QR...</p>
            </div>
          )}
          {status === 'qr' && qrBase64 && (
            <div className="text-center">
              <img
                src={`data:image/png;base64,${qrBase64}`}
                alt="QR Code"
                className="w-64 h-64 mx-auto mb-2"
              />
              <p className="text-xs text-gray-500">
                <RefreshCw className="w-3 h-3 inline animate-spin" /> ממתין לסריקה...
              </p>
            </div>
          )}
          {status === 'authorized' && (
            <div className="text-center">
              <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-3" />
              <p className="text-lg font-bold text-green-800">חובר בהצלחה!</p>
              <p className="text-sm text-gray-600 mt-1">סוגר את החלון...</p>
            </div>
          )}
          {status === 'error' && (
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-red-800">שגיאה</p>
              <p className="text-xs text-gray-600 mt-1">{error}</p>
              <button
                onClick={fetchQr}
                className="mt-3 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold"
              >
                נסה שוב
              </button>
            </div>
          )}
        </div>

        {/* Instructions */}
        {status === 'qr' && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-900 space-y-1">
            <p className="font-bold mb-1">איך לסרוק:</p>
            <p>1. פתח WhatsApp בטלפון</p>
            <p>2. תפריט (3 נקודות) → מכשירים מקושרים</p>
            <p>3. לחץ "קישור מכשיר"</p>
            <p>4. סרוק את ה-QR למעלה</p>
          </div>
        )}
      </div>
    </div>
  );
}
