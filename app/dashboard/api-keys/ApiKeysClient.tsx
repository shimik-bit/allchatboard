'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Key, Plus, Copy, Trash2, AlertCircle, Check, Code, Eye, EyeOff, ExternalLink, Activity, X, Lock, Unlock } from 'lucide-react';

type Workspace = { id: string; name: string };
type Table = { id: string; name: string; icon: string | null };

type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  table_ids: string[] | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  request_count: number;
  notes: string | null;
};

type LogEntry = {
  id: string;
  api_key_id: string;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  ip_address: string | null;
  error_message: string | null;
  created_at: string;
  api_keys?: { name: string; prefix: string };
};

export default function ApiKeysClient({
  workspace, isAdmin,
}: {
  workspace: Workspace;
  isAdmin: boolean;
}) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<'keys' | 'logs'>('keys');

  function loadAll() {
    setLoading(true);
    Promise.all([
      fetch(`/api/api-keys?workspace_id=${workspace.id}`).then((r) => r.json()),
      fetch(`/api/api-keys/logs?workspace_id=${workspace.id}&limit=50`).then((r) => r.json()),
    ]).then(([keysData, logsData]) => {
      if (keysData.keys) setKeys(keysData.keys);
      if (keysData.tables) setTables(keysData.tables);
      if (logsData.logs) setLogs(logsData.logs);
      setLoading(false);
    });
  }

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [workspace.id]);

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="card p-8 text-center">
          <Lock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="font-display font-bold text-xl mb-2">דף למנהלים בלבד</h2>
          <p className="text-gray-500 text-sm">רק בעלי סביבת עבודה ומנהלים יכולים לנהל מפתחות API.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="font-display font-black text-2xl md:text-3xl mb-1">מפתחות API</h1>
          <p className="text-sm text-gray-600">
            צור והנהל מפתחות גישה לאינטגרציות חיצוניות (אתרים, Zapier, Make, אפליקציות מותאמות)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/docs/api" className="btn-secondary text-sm flex items-center gap-1.5">
            <Code className="w-4 h-4" /> תיעוד API
          </Link>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> מפתח חדש
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          onClick={() => setTab('keys')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'keys' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500'
          }`}
        >
          <Key className="w-3.5 h-3.5 inline ml-1" /> מפתחות ({keys.length})
        </button>
        <button
          onClick={() => setTab('logs')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'logs' ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500'
          }`}
        >
          <Activity className="w-3.5 h-3.5 inline ml-1" /> בקשות ({logs.length})
        </button>
      </div>

      {/* Keys list */}
      {tab === 'keys' && (
        loading ? (
          <div className="card p-8 text-center text-gray-400 text-sm">טוען...</div>
        ) : keys.length === 0 ? (
          <div className="card p-8 text-center">
            <Key className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="font-bold text-lg mb-1">עוד אין מפתחות API</h3>
            <p className="text-gray-500 text-sm mb-4">צור מפתח ראשון כדי לחבר אתר, אפליקציה או Zapier ל-AllChatBoard.</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
              <Plus className="w-4 h-4 inline ml-1" /> צור מפתח ראשון
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <KeyCard key={k.id} apiKey={k} tables={tables} onChange={loadAll} />
            ))}
          </div>
        )
      )}

      {/* Logs */}
      {tab === 'logs' && (
        <LogsView logs={logs} />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateKeyModal
          workspaceId={workspace.id}
          tables={tables}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadAll(); }}
        />
      )}
    </div>
  );
}

// ===========================================================================
// KEY CARD - shows one API key with its details
// ===========================================================================
function KeyCard({ apiKey: k, tables, onChange }: { apiKey: ApiKey; tables: Table[]; onChange: () => void }) {
  const isRevoked = !!k.revoked_at;
  const isExpired = k.expires_at && new Date(k.expires_at) < new Date();
  const accessibleTables = k.table_ids === null ? null : tables.filter((t) => k.table_ids!.includes(t.id));

  const perms = [
    k.can_read && 'קריאה',
    k.can_create && 'יצירה',
    k.can_update && 'עדכון',
    k.can_delete && 'מחיקה',
  ].filter(Boolean) as string[];

  async function handleRevoke() {
    if (!confirm(`לבטל את המפתח "${k.name}"? לא ניתן לבטל פעולה זו.`)) return;
    await fetch(`/api/api-keys/${k.id}`, { method: 'POST' });
    onChange();
  }

  async function handleDelete() {
    if (!confirm(`למחוק לצמיתות את המפתח "${k.name}"? היסטוריית הקריאות תיעלם.`)) return;
    await fetch(`/api/api-keys/${k.id}`, { method: 'DELETE' });
    onChange();
  }

  return (
    <div className={`card p-4 ${isRevoked || isExpired ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-4 flex-wrap md:flex-nowrap">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 grid place-items-center text-white flex-shrink-0">
          <Key className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{k.name}</span>
            {isRevoked && <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">בוטל</span>}
            {!isRevoked && isExpired && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">פג תוקף</span>}
            {!isRevoked && !isExpired && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">פעיל</span>}
          </div>

          <div className="text-xs text-gray-500 font-mono mt-0.5" dir="ltr">{k.prefix}</div>

          <div className="flex items-center gap-3 mt-2 text-xs text-gray-600 flex-wrap">
            <span>הרשאות: <strong>{perms.join(' · ')}</strong></span>
            <span>·</span>
            <span>טבלאות: <strong>{accessibleTables === null ? 'הכל' : `${accessibleTables.length} מתוך ${tables.length}`}</strong></span>
            <span>·</span>
            <span>{k.request_count.toLocaleString()} קריאות</span>
            {k.last_used_at && (
              <>
                <span>·</span>
                <span>שימוש אחרון: {new Date(k.last_used_at).toLocaleDateString('he-IL')}</span>
              </>
            )}
          </div>

          {k.notes && (
            <div className="mt-2 text-xs text-gray-500 italic">"{k.notes}"</div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!isRevoked && (
            <button onClick={handleRevoke} title="בטל מפתח" className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg">
              <Lock className="w-4 h-4" />
            </button>
          )}
          <button onClick={handleDelete} title="מחק לצמיתות" className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// LOGS VIEW
// ===========================================================================
function LogsView({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) {
    return (
      <div className="card p-8 text-center text-gray-400 text-sm">
        עוד לא בוצעו קריאות API
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-3 py-2 text-right">זמן</th>
              <th className="px-3 py-2 text-right">מפתח</th>
              <th className="px-3 py-2 text-right">פעולה</th>
              <th className="px-3 py-2 text-right">סטטוס</th>
              <th className="px-3 py-2 text-right">משך</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                  {new Date(l.created_at).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
                <td className="px-3 py-2 text-xs">{l.api_keys?.name || '—'}</td>
                <td className="px-3 py-2 font-mono text-xs" dir="ltr">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] mr-1 ${
                    l.method === 'GET' ? 'bg-blue-100 text-blue-700' :
                    l.method === 'POST' ? 'bg-green-100 text-green-700' :
                    l.method === 'PATCH' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>{l.method}</span>
                  {l.path}
                </td>
                <td className="px-3 py-2 text-xs">
                  <span className={`font-mono ${
                    l.status_code < 300 ? 'text-green-700' :
                    l.status_code < 400 ? 'text-blue-700' :
                    l.status_code < 500 ? 'text-amber-700' : 'text-red-700'
                  }`}>{l.status_code}</span>
                  {l.error_message && <span className="text-red-500 mr-2 text-[10px]">{l.error_message}</span>}
                </td>
                <td className="px-3 py-2 text-xs text-gray-500 font-mono" dir="ltr">{l.duration_ms}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ===========================================================================
// CREATE MODAL
// ===========================================================================
function CreateKeyModal({
  workspaceId, tables, onClose, onCreated,
}: {
  workspaceId: string;
  tables: Table[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<'form' | 'token'>('form');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [canRead, setCanRead] = useState(true);
  const [canCreate, setCanCreate] = useState(true);
  const [canUpdate, setCanUpdate] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  const [allTables, setAllTables] = useState(true);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleTable(id: string) {
    setSelectedTables((arr) => arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  }

  async function handleCreate() {
    setError(null);
    if (!name.trim()) return setError('יש לתת שם למפתח');
    if (!allTables && selectedTables.length === 0) {
      return setError('בחר לפחות טבלה אחת או סמן "כל הטבלאות"');
    }

    setSaving(true);
    try {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          name: name.trim(),
          notes: notes.trim() || null,
          can_read: canRead,
          can_create: canCreate,
          can_update: canUpdate,
          can_delete: canDelete,
          table_ids: allTables ? null : selectedTables,
          expires_at: expiresAt || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'יצירה נכשלה');
        setSaving(false);
        return;
      }
      setCreatedToken(json.plain_token);
      setStep('token');
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  function handleCopy() {
    if (!createdToken) return;
    navigator.clipboard.writeText(createdToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 animate-fade-in"
      onClick={step === 'token' ? undefined : onClose}
    >
      <div
        className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-display font-bold text-lg">
            {step === 'form' ? 'מפתח API חדש' : '🎉 המפתח נוצר בהצלחה'}
          </h2>
          {step === 'form' && (
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {step === 'form' ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5">שם המפתח <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: אתר Wix, אפליקציית Zapier"
                className="input-field"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">תיאורי - יעזור לך לזהות איזו אינטגרציה משתמשת במפתח.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">הרשאות פעולה</label>
              <div className="grid grid-cols-2 gap-2">
                <PermToggle label="קריאה (GET)" checked={canRead} onChange={setCanRead} />
                <PermToggle label="יצירה (POST)" checked={canCreate} onChange={setCanCreate} />
                <PermToggle label="עדכון (PATCH)" checked={canUpdate} onChange={setCanUpdate} warning={canUpdate} />
                <PermToggle label="מחיקה (DELETE)" checked={canDelete} onChange={setCanDelete} warning={canDelete} />
              </div>
              <p className="text-xs text-gray-500 mt-2">תן רק את ההרשאות שצריך - עיקרון ה-least privilege.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">גישה לטבלאות</label>
              <label className="flex items-center gap-2 mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allTables}
                  onChange={(e) => setAllTables(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-600"
                />
                <span className="text-sm">כל הטבלאות בסביבה (כולל טבלאות עתידיות)</span>
              </label>
              {!allTables && (
                <div className="border border-gray-200 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                  {tables.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTables.includes(t.id)}
                        onChange={() => toggleTable(t.id)}
                        className="w-4 h-4 rounded text-brand-600"
                      />
                      <span className="text-sm">{t.icon} {t.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">תאריך תפוגה (אופציונלי)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="input-field"
              />
              <p className="text-xs text-gray-500 mt-1">השאר ריק למפתח ללא תפוגה.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">הערות פנימיות</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="למה המפתח נוצר, מי בשימוש בו"
                className="input-field text-sm"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-800 flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block mb-1">שמור את המפתח עכשיו!</strong>
                זוהי הפעם היחידה שהמפתח יוצג. אם תאבד אותו - תצטרך ליצור חדש.
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">המפתח שלך:</label>
              <div className="bg-gray-900 text-green-300 p-3 rounded-lg font-mono text-sm break-all" dir="ltr">
                {createdToken}
              </div>
              <button
                onClick={handleCopy}
                className="mt-2 w-full btn-primary flex items-center justify-center gap-2"
              >
                {copied ? <><Check className="w-4 h-4" /> הועתק!</> : <><Copy className="w-4 h-4" /> העתק מפתח</>}
              </button>
            </div>

            <div className="text-sm text-gray-600 space-y-2">
              <p><strong>איך להשתמש:</strong></p>
              <div className="bg-gray-50 p-3 rounded-lg font-mono text-xs" dir="ltr">
                <div className="text-gray-400">{`# Authorization header:`}</div>
                <div>Authorization: Bearer {createdToken?.slice(0, 16)}...</div>
              </div>
              <p>
                <Link href="/docs/api" className="text-brand-600 font-semibold hover:underline">
                  → תיעוד מלא עם דוגמאות curl, JavaScript, Python
                </Link>
              </p>
            </div>
          </div>
        )}

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2 bg-gray-50/50">
          {step === 'form' ? (
            <>
              <button onClick={onClose} className="btn-secondary text-sm" disabled={saving}>ביטול</button>
              <button onClick={handleCreate} disabled={saving} className="btn-primary text-sm">
                {saving ? 'יוצר...' : 'צור מפתח'}
              </button>
            </>
          ) : (
            <button onClick={onCreated} className="btn-primary text-sm">סגור והמשך</button>
          )}
        </div>
      </div>
    </div>
  );
}

function PermToggle({ label, checked, onChange, warning }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  warning?: boolean;
}) {
  return (
    <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
      checked
        ? warning ? 'border-amber-400 bg-amber-50' : 'border-brand-400 bg-brand-50'
        : 'border-gray-200 hover:border-gray-300'
    }`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded text-brand-600"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}
