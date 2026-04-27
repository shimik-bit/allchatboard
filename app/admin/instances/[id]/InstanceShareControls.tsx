'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Share2, Plus, X, AlertCircle, Building2, MessageSquare, Loader2, ArrowRight, Trash2 } from 'lucide-react';

type Workspace = { id: string; name: string; icon: string | null };

type Link = {
  id: string;
  workspace: Workspace | null;
  display_name: string | null;
  priority: number;
  linked_at: string;
  notes: string | null;
};

type RoutedGroup = {
  id: string;
  chat_id: string;
  group_name: string | null;
  target_workspace: Workspace | null;
  routed_at: string;
};

type UnroutedMessage = {
  id: string;
  sender: string;
  text: string;
  received_at: string;
  routing_status: string;
};

export default function InstanceShareControls({
  instanceId,
  instanceDisplayName,
  isShared,
  primaryWorkspace,
  allWorkspaces,
  links,
  routedGroups,
  unroutedMessages,
}: {
  instanceId: string;
  instanceDisplayName: string;
  isShared: boolean;
  primaryWorkspace: Workspace | null;
  allWorkspaces: Workspace[];
  links: Link[];
  routedGroups: RoutedGroup[];
  unroutedMessages: UnroutedMessage[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add workspace form
  const [addWorkspaceId, setAddWorkspaceId] = useState('');
  const [addNotes, setAddNotes] = useState('');

  async function handleAddWorkspace() {
    if (!addWorkspaceId) return;
    setBusy('add-workspace');
    setError(null);
    try {
      const res = await fetch(`/api/admin/instances/${instanceId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: addWorkspaceId,
          notes: addNotes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'שגיאה');
        setBusy(null);
        return;
      }
      setAddWorkspaceId('');
      setAddNotes('');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function handleRemoveLink(workspaceId: string, name: string) {
    if (!confirm(`להסיר את "${name}" מ-${instanceDisplayName}?`)) return;
    setBusy(`remove-${workspaceId}`);
    setError(null);
    try {
      await fetch(`/api/admin/instances/${instanceId}/share?workspace_id=${workspaceId}`, {
        method: 'DELETE',
      });
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function handleRouteGroup(chatId: string, groupName: string | null) {
    const linkedWorkspaces = [
      ...(primaryWorkspace ? [primaryWorkspace] : []),
      ...links.map(l => l.workspace).filter(Boolean) as Workspace[],
    ];

    if (linkedWorkspaces.length === 0) {
      alert('אין סביבות מקושרות. הוסף סביבה לפני שתוכל לנתב קבוצות.');
      return;
    }

    // Simple prompt for now - in production would be a modal
    const wsOptions = linkedWorkspaces.map((w, i) => `${i + 1}. ${w.name}`).join('\n');
    const choice = prompt(`לאיזו סביבה לנתב את הקבוצה?\n\n${wsOptions}\n\nהקלד מספר:`);
    if (!choice) return;
    const idx = parseInt(choice) - 1;
    if (idx < 0 || idx >= linkedWorkspaces.length) {
      alert('בחירה לא תקינה');
      return;
    }
    const target = linkedWorkspaces[idx];

    setBusy(`route-${chatId}`);
    try {
      const res = await fetch(`/api/admin/instances/${instanceId}/route-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          target_workspace_id: target.id,
          group_name: groupName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'שגיאה');
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function handleRemoveRouting(routingId: string, chatId: string) {
    if (!confirm(`להסיר את הניתוב של ${chatId}?`)) return;
    setBusy(`unroute-${routingId}`);
    try {
      await fetch(`/api/admin/instances/${instanceId}/route-group?chat_id=${encodeURIComponent(chatId)}`, {
        method: 'DELETE',
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-950/40 border border-red-900 rounded-xl p-4 text-sm text-red-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sharing section */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-1">
            <Share2 className="w-4 h-4" />
            שיתוף בין סביבות
            {isShared && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/50 text-purple-300 mr-2">
                משותף
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400">
            ברירת מחדל: כל instance שייך לסביבה אחת בלבד. ניתן לקשר instance למספר סביבות נוספות,
            אבל אז כל קבוצה תצטרך הגדרת ניתוב ידנית.
          </p>
        </div>

        {/* Linked workspaces */}
        {links.length > 0 && (
          <div className="p-4 border-b border-slate-800">
            <div className="text-xs font-bold text-slate-400 mb-2">סביבות נוספות מקושרות:</div>
            <ul className="space-y-2">
              {links.map(link => (
                <li key={link.id} className="flex items-center gap-3 p-2 bg-slate-800/50 rounded-lg">
                  <div className="text-xl">{link.workspace?.icon || '📊'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {link.workspace?.name || '?'}
                      {link.display_name && link.display_name !== link.workspace?.name && (
                        <span className="text-xs text-slate-500 mr-2">({link.display_name})</span>
                      )}
                    </div>
                    {link.notes && (
                      <div className="text-xs text-slate-500 mt-0.5">{link.notes}</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveLink(link.workspace?.id || '', link.workspace?.name || '?')}
                    disabled={busy === `remove-${link.workspace?.id}`}
                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                    title="הסר"
                  >
                    {busy === `remove-${link.workspace?.id}` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Add workspace form */}
        <div className="p-4">
          <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1">
            <Plus className="w-3 h-3" />
            הוסף סביבה ל-instance
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={addWorkspaceId}
              onChange={(e) => setAddWorkspaceId(e.target.value)}
              className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
            >
              <option value="">— בחר סביבה —</option>
              {allWorkspaces
                .filter(w => !links.some(l => l.workspace?.id === w.id))
                .map(w => (
                  <option key={w.id} value={w.id}>
                    {w.icon || '📊'} {w.name}
                  </option>
                ))}
            </select>
            <input
              type="text"
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              placeholder="הערה (אופציונלי)"
              className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
            />
            <button
              onClick={handleAddWorkspace}
              disabled={!addWorkspaceId || busy === 'add-workspace'}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 rounded-lg text-sm font-bold flex items-center gap-1.5"
            >
              {busy === 'add-workspace' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              הוסף
            </button>
          </div>
          {!isShared && (
            <p className="text-xs text-slate-500 mt-2">
              💡 הוספת סביבה ראשונה תהפוך את ה-instance למשותף. ב-instances משותפים, הודעות מקבוצות
              לא ינותבו אוטומטית - תצטרך להגדיר ידנית לאיזו סביבה כל קבוצה שייכת.
            </p>
          )}
        </div>
      </div>

      {/* Group routing - only relevant for shared instances */}
      {isShared && (
        <>
          {/* Routed groups */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4" />
                ניתוב קבוצות
                <span className="text-xs text-slate-500 mr-2">({routedGroups.length} מנותבות)</span>
              </h2>
              <p className="text-xs text-slate-400">
                כל קבוצה ב-instance משותף חייבת להיות ממופה לסביבה ספציפית.
              </p>
            </div>

            {routedGroups.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                עדיין לא נקבע ניתוב לאף קבוצה
              </div>
            ) : (
              <ul className="divide-y divide-slate-800">
                {routedGroups.map(rg => (
                  <li key={rg.id} className="p-3 flex items-center gap-3 text-sm">
                    <MessageSquare className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{rg.group_name || '(ללא שם)'}</div>
                      <div className="text-xs text-slate-500 font-mono truncate" dir="ltr">{rg.chat_id}</div>
                    </div>
                    <ArrowRight className="w-3 h-3 text-slate-600" />
                    <div className="flex items-center gap-1 text-xs">
                      <span>{rg.target_workspace?.icon || '📊'}</span>
                      <span className="font-medium">{rg.target_workspace?.name || '?'}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveRouting(rg.id, rg.chat_id)}
                      disabled={busy === `unroute-${rg.id}`}
                      className="p-1.5 text-slate-500 hover:text-red-400"
                      title="הסר ניתוב"
                    >
                      {busy === `unroute-${rg.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Unrouted messages */}
          {unroutedMessages.length > 0 && (
            <div className="bg-amber-950/20 border border-amber-900 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-amber-900">
                <h2 className="text-sm font-bold text-amber-200 flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4" />
                  הודעות מחכות לניתוב ({unroutedMessages.length})
                </h2>
                <p className="text-xs text-amber-300/70">
                  הודעות שהגיעו ל-instance המשותף ועדיין לא נקבע ניתוב.
                  לחץ "נתב" על קבוצה כדי לבחור סביבה.
                </p>
              </div>

              <ul className="divide-y divide-amber-900/30">
                {unroutedMessages.map(msg => (
                  <li key={msg.id} className="p-3 text-sm">
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        msg.routing_status === 'unrouted_group'
                          ? 'bg-purple-900/40 text-purple-300'
                          : 'bg-blue-900/40 text-blue-300'
                      }`}>
                        {msg.routing_status === 'unrouted_group' ? 'קבוצה' : 'DM'}
                      </span>
                      <span className="text-xs text-slate-400">{msg.sender}</span>
                      <span className="text-xs text-slate-600">·</span>
                      <span className="text-xs text-slate-500">
                        {new Date(msg.received_at).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                    {msg.text && (
                      <div className="text-xs text-slate-300 mt-1 line-clamp-2">{msg.text}</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
