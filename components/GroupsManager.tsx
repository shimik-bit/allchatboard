'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, ChevronDown, ChevronUp, Settings, Save, Check, AlertCircle, Users, Bot, Bell } from 'lucide-react';

type Table = { id: string; name: string; icon: string | null; color: string | null };
type Phone = { id: string; display_name: string; job_title: string | null; phone_number: string };

type Group = {
  id: string;
  green_api_chat_id: string;
  group_name: string | null;
  is_active: boolean;
  classification_hint: string | null;
  target_table_id: string | null;
  target_workspace_id: string | null;
  default_assignee_phone_id: string | null;
  auto_create_record: boolean;
  auto_reply_enabled: boolean;
  notes: string | null;
  created_at: string;
};

export default function GroupsManager({
  workspaceId,
  canEdit,
}: {
  workspaceId: string;
  canEdit: boolean;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  function loadAll() {
    setLoading(true);
    setError(null);
    fetch(`/api/groups?workspace_id=${workspaceId}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({ error: 'תגובה לא תקינה מהשרת' }));
        if (!r.ok || d.error) {
          setError(d.error || `שגיאה ${r.status}`);
        } else {
          setGroups(Array.isArray(d.groups) ? d.groups : []);
          setTables(Array.isArray(d.tables) ? d.tables : []);
          setPhones(Array.isArray(d.phones) ? d.phones : []);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e?.message || e));
        setLoading(false);
      });
  }

  useEffect(() => { loadAll(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [workspaceId]);

  function updateLocal(id: string, patch: Partial<Group>) {
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  async function saveGroup(id: string, patch: Partial<Group>) {
    if (!canEdit) return;
    setSavingId(id);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      });
      if (res.ok) {
        setSavedId(id);
        setTimeout(() => setSavedId(null), 2000);
      } else {
        const j = await res.json();
        alert('שגיאה: ' + (j.error || 'לא ידוע'));
      }
    } catch (e: any) {
      alert('שגיאת רשת: ' + e.message);
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return <div className="card p-6 mb-6 text-center text-gray-400 text-sm">טוען קבוצות...</div>;
  }

  if (error) {
    return (
      <div className="card p-6 mb-6">
        <h2 className="font-display font-bold text-lg mb-2">קבוצות WhatsApp</h2>
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
          <strong className="block mb-1">שגיאה בטעינת קבוצות:</strong>
          {error}
        </div>
        <button onClick={loadAll} className="btn-ghost text-sm mt-3">נסה שוב</button>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="card p-6 mb-6">
        <h2 className="font-display font-bold text-lg mb-2">קבוצות WhatsApp</h2>
        <p className="text-sm text-gray-500">
          עוד לא נקלטו קבוצות. כשהבוט יצורף לקבוצה ויקבל הודעה ראשונה - היא תופיע כאן ותוכל להגדיר אותה.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-bold text-lg">קבוצות WhatsApp</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            כל קבוצה יכולה לנתב הודעות לטבלה ספציפית, ולקבוע אחראי דיפולטיבי
          </p>
        </div>
        <button onClick={loadAll} className="btn-ghost text-xs">רענן</button>
      </div>

      <div className="space-y-2">
        {groups.map((g) => {
          const isExpanded = expandedId === g.id;
          const targetTable = tables.find((t) => t.id === g.target_table_id);
          const targetPhone = phones.find((p) => p.id === g.default_assignee_phone_id);
          const isRouted = !!g.target_table_id;

          return (
            <div key={g.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              {/* Header row */}
              <div
                className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                  isExpanded ? 'bg-brand-50' : 'hover:bg-gray-50/70'
                }`}
                onClick={() => setExpandedId(isExpanded ? null : g.id)}
              >
                <div className={`w-10 h-10 rounded-lg grid place-items-center flex-shrink-0 ${
                  g.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  <Users className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{g.group_name || 'ללא שם'}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap mt-0.5">
                    {isRouted ? (
                      <span className="inline-flex items-center gap-1 text-brand-700 font-medium">
                        🎯 מנותב ל: {targetTable?.icon} {targetTable?.name || '(טבלה הוסרה)'}
                      </span>
                    ) : (
                      <span className="text-amber-600">לא מנותב — AI מסווג אוטומטית</span>
                    )}
                    {targetPhone && (
                      <span>· אחראי: {targetPhone.display_name}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                    g.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {g.is_active ? 'פעיל' : 'כבוי'}
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>

              {/* Expanded settings */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50/30 space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div className="text-[11px] font-mono text-gray-400 break-all" dir="ltr">
                    {g.green_api_chat_id}
                  </div>

                  {/* Active toggle */}
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                    <div>
                      <div className="text-sm font-medium">קבוצה פעילה</div>
                      <div className="text-xs text-gray-500">אם כבוי - הודעות מהקבוצה יתעלמו</div>
                    </div>
                    <Toggle
                      checked={g.is_active}
                      onChange={(v) => { updateLocal(g.id, { is_active: v }); saveGroup(g.id, { is_active: v }); }}
                      disabled={!canEdit}
                    />
                  </div>

                  {/* Target table */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      🎯 נתב הודעות לטבלה
                    </label>
                    <select
                      value={g.target_table_id || ''}
                      onChange={(e) => {
                        const v = e.target.value || null;
                        updateLocal(g.id, { target_table_id: v });
                        saveGroup(g.id, { target_table_id: v });
                      }}
                      disabled={!canEdit}
                      className="input-field text-sm"
                    >
                      <option value="">— בחר AI אוטומטית (ברירת מחדל) —</option>
                      {tables.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.icon || '📋'} {t.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-500 mt-1">
                      אם בחרת טבלה - כל הודעה מהקבוצה תיכנס ישר אליה ללא סיווג AI (חוסך זמן ושגיאות)
                    </p>
                  </div>

                  {/* Default assignee */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      <Bell className="w-3.5 h-3.5 inline ml-1" />
                      אחראי דיפולטיבי
                    </label>
                    <select
                      value={g.default_assignee_phone_id || ''}
                      onChange={(e) => {
                        const v = e.target.value || null;
                        updateLocal(g.id, { default_assignee_phone_id: v });
                        saveGroup(g.id, { default_assignee_phone_id: v });
                      }}
                      disabled={!canEdit}
                      className="input-field text-sm"
                    >
                      <option value="">— ללא ברירת מחדל —</option>
                      {phones.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.display_name}{p.job_title ? ` — ${p.job_title}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-500 mt-1">
                      רשומות שנוצרות מהקבוצה הזו ישויכו אוטומטית לאחראי הזה
                    </p>
                  </div>

                  {/* Behavior toggles */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="text-sm font-medium flex items-center gap-1.5">
                          <Bot className="w-3.5 h-3.5" />
                          יצירת רשומות
                        </div>
                        <div className="text-[11px] text-gray-500">צור רשומה אוטומטית מכל הודעה</div>
                      </div>
                      <Toggle
                        checked={g.auto_create_record}
                        onChange={(v) => { updateLocal(g.id, { auto_create_record: v }); saveGroup(g.id, { auto_create_record: v }); }}
                        disabled={!canEdit}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="text-sm font-medium flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5" />
                          תגובה אוטומטית
                        </div>
                        <div className="text-[11px] text-gray-500">הבוט יענה בקבוצה</div>
                      </div>
                      <Toggle
                        checked={g.auto_reply_enabled}
                        onChange={(v) => { updateLocal(g.id, { auto_reply_enabled: v }); saveGroup(g.id, { auto_reply_enabled: v }); }}
                        disabled={!canEdit}
                      />
                    </div>
                  </div>

                  {/* AI hint */}
                  {!isRouted && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        💡 רמז ל-AI לסיווג
                      </label>
                      <input
                        type="text"
                        value={g.classification_hint || ''}
                        onChange={(e) => updateLocal(g.id, { classification_hint: e.target.value })}
                        onBlur={() => saveGroup(g.id, { classification_hint: g.classification_hint })}
                        disabled={!canEdit}
                        placeholder="לדוגמה: כל הודעה בקבוצה היא דיווח על תקלה"
                        className="input-field text-sm"
                      />
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">הערות פנימיות</label>
                    <textarea
                      rows={2}
                      value={g.notes || ''}
                      onChange={(e) => updateLocal(g.id, { notes: e.target.value })}
                      onBlur={() => saveGroup(g.id, { notes: g.notes })}
                      disabled={!canEdit}
                      placeholder="הסבר על הקבוצה / מי מורשה לכתוב בה / וכו'"
                      className="input-field text-sm"
                    />
                  </div>

                  {/* Status indicator */}
                  <div className="flex items-center justify-between text-xs pt-2">
                    <div className="text-gray-400">
                      נקלטה: {new Date(g.created_at).toLocaleDateString('he-IL')}
                    </div>
                    <div>
                      {savingId === g.id && (
                        <span className="text-brand-600 flex items-center gap-1">
                          <Save className="w-3 h-3 animate-pulse" /> שומר...
                        </span>
                      )}
                      {savedId === g.id && (
                        <span className="text-green-600 flex items-center gap-1">
                          <Check className="w-3 h-3" /> נשמר
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

      <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-100 flex gap-2 items-start">
        <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-900">
          <strong className="block mb-1">איך מוסיפים קבוצה חדשה?</strong>
          הוסף את מספר WhatsApp של הבוט לקבוצה ושלח הודעה כלשהי. הקבוצה תופיע כאן אוטומטית תוך כמה שניות.
        </div>
      </div>
    </div>
  );
}

function Toggle({
  checked, onChange, disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
        checked ? 'bg-brand-600' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${
        checked ? 'right-0.5' : 'right-[22px]'
      }`} />
    </button>
  );
}
