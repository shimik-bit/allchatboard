'use client';

import { useState, useEffect } from 'react';
import { X, Shield, Eye, Pencil, Lock, Unlock, AlertCircle, Check } from 'lucide-react';

type AccessMode = 'open' | 'view_only' | 'restricted';
type PermissionLevel = 'view' | 'edit' | 'none';

type Member = {
  id: string;
  user_id: string;
  display_name: string | null;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  whatsapp_phone: string | null;
};

type Permission = {
  id: string;
  member_id: string;
  permission: PermissionLevel;
  hidden_fields: string[] | null;
  visible_fields: string[] | null;
};

type FieldInfo = {
  id: string;
  slug: string;
  name: string;
  type: string;
};

export default function TablePermissionsModal({
  tableId,
  tableName,
  onClose,
}: {
  tableId: string;
  tableName: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessMode, setAccessMode] = useState<AccessMode>('open');
  const [members, setMembers] = useState<Member[]>([]);
  const [overrides, setOverrides] = useState<Map<string, PermissionLevel>>(new Map());
  // Per-member hidden fields (deny-list of field slugs). Only populated for
  // members who actually have a permission override AND want to restrict
  // some fields. Members without any override are not in this map at all.
  const [hiddenFieldsMap, setHiddenFieldsMap] = useState<Map<string, string[]>>(new Map());
  // Available fields in this table - needed to render the picker
  const [tableFields, setTableFields] = useState<FieldInfo[]>([]);
  // When set, the field-picker popover is open for this member id
  const [pickerOpenForMember, setPickerOpenForMember] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Load current permissions
  useEffect(() => {
    fetch(`/api/tables/${tableId}/permissions`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setError(d.error);
        } else {
          setAccessMode(d.table?.access_mode || 'open');
          setMembers(d.members || []);
          setTableFields(d.fields || []);
          const map = new Map<string, PermissionLevel>();
          const hiddenMap = new Map<string, string[]>();
          (d.permissions || []).forEach((p: Permission) => {
            map.set(p.member_id, p.permission);
            if (p.hidden_fields && p.hidden_fields.length > 0) {
              hiddenMap.set(p.member_id, p.hidden_fields);
            }
          });
          setOverrides(map);
          setHiddenFieldsMap(hiddenMap);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, [tableId]);

  function setMemberPerm(memberId: string, perm: PermissionLevel | null) {
    const next = new Map(overrides);
    if (perm === null) next.delete(memberId);
    else next.set(memberId, perm);
    setOverrides(next);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // Build the save payload. Each member with an override gets its
      // hidden_fields list attached if any are configured for them.
      // Members without an override aren't sent (the API replaces all
      // overrides with this list, so omitted = removed).
      const memberArr = Array.from(overrides.entries()).map(([member_id, permission]) => ({
        member_id,
        permission,
        hidden_fields: hiddenFieldsMap.get(member_id) || null,
        // visible_fields: not used in this UI yet — we always go via
        // the hidden_fields deny-list because it's easier to reason about
        // ("hide salary from this person" rather than "show everything
        // except salary"). Both columns exist in DB for future use.
        visible_fields: null,
      }));
      const res = await fetch(`/api/tables/${tableId}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_mode: accessMode, members: memberArr }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'שמירה נכשלה');
      } else {
        setSavedAt(new Date());
        setTimeout(() => setSavedAt(null), 2500);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // Owners/admins always see everything regardless of overrides
  function effectivePermission(member: Member): { label: string; locked: boolean; perm: PermissionLevel } {
    if (member.role === 'owner' || member.role === 'admin') {
      return { label: 'גישה מלאה (admin)', locked: true, perm: 'edit' };
    }
    const override = overrides.get(member.id);
    if (override) return { label: '', locked: false, perm: override };
    // Default based on access_mode
    if (accessMode === 'open') return { label: 'גישה מלאה (ברירת מחדל)', locked: false, perm: 'edit' };
    if (accessMode === 'view_only') return { label: 'קריאה בלבד (ברירת מחדל)', locked: false, perm: 'view' };
    return { label: 'אין גישה (ברירת מחדל)', locked: false, perm: 'none' };
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-black/50 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] md:max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 grid place-items-center text-white">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg">הרשאות לטבלה</h2>
              <p className="text-xs text-gray-500">{tableName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 grid place-items-center py-12 text-gray-400">טוען...</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Access mode selector */}
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">מצב גישה כללי</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <ModeOption
                  active={accessMode === 'open'}
                  onClick={() => setAccessMode('open')}
                  icon={<Unlock className="w-4 h-4" />}
                  title="פתוח"
                  desc="כל החברים רואים ועורכים"
                  color="green"
                />
                <ModeOption
                  active={accessMode === 'view_only'}
                  onClick={() => setAccessMode('view_only')}
                  icon={<Eye className="w-4 h-4" />}
                  title="קריאה לכולם"
                  desc="כולם רואים, רק מסומנים עורכים"
                  color="amber"
                />
                <ModeOption
                  active={accessMode === 'restricted'}
                  onClick={() => setAccessMode('restricted')}
                  icon={<Lock className="w-4 h-4" />}
                  title="מוגבל"
                  desc="רק חברים מסומנים רואים"
                  color="red"
                />
              </div>
            </div>

            {/* Per-member overrides */}
            <div className="px-6 py-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-1">הרשאות לפי משתמש</h3>
              <p className="text-xs text-gray-500 mb-4">
                ניתן להגדיר הרשאה ספציפית למשתמש שגוברת על מצב הגישה הכללי
              </p>

              {members.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  אין חברים בסביבת העבודה
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((m) => {
                    const eff = effectivePermission(m);
                    return (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
                      >
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 grid place-items-center text-white text-xs font-bold flex-shrink-0">
                          {(m.display_name || '?').charAt(0)}
                        </div>

                        {/* Name + role */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {m.display_name || '—'}
                          </div>
                          <div className="text-[11px] text-gray-500 flex items-center gap-1.5">
                            <span className="capitalize">{roleLabel(m.role)}</span>
                            {m.whatsapp_phone && (
                              <span dir="ltr" className="text-gray-400">· {m.whatsapp_phone}</span>
                            )}
                          </div>
                        </div>

                        {/* Permission selector */}
                        {eff.locked ? (
                          <span className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-500">
                            {eff.label}
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {/* Field restrictor — only visible when this member
                                has a 'view' or 'edit' override (not 'none' or
                                no override). Hides specific fields from them.
                                Indicator shows count of currently-hidden fields. */}
                            {(overrides.get(m.id) === 'view' || overrides.get(m.id) === 'edit') && (
                              <FieldRestrictor
                                fields={tableFields}
                                hiddenSlugs={hiddenFieldsMap.get(m.id) || []}
                                isOpen={pickerOpenForMember === m.id}
                                onToggle={() =>
                                  setPickerOpenForMember(
                                    pickerOpenForMember === m.id ? null : m.id
                                  )
                                }
                                onChange={(slugs) => {
                                  const next = new Map(hiddenFieldsMap);
                                  if (slugs.length === 0) next.delete(m.id);
                                  else next.set(m.id, slugs);
                                  setHiddenFieldsMap(next);
                                }}
                              />
                            )}
                            <PermissionSelector
                              value={overrides.get(m.id) ?? null}
                              currentEffective={eff.perm}
                              defaultLabel={eff.label}
                              onChange={(perm) => {
                                setMemberPerm(m.id, perm);
                                // If user removes the override or sets to 'none',
                                // clear any field restrictions too — they don't
                                // make sense without a base permission.
                                if (perm === null || perm === 'none') {
                                  const next = new Map(hiddenFieldsMap);
                                  next.delete(m.id);
                                  setHiddenFieldsMap(next);
                                }
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Invite new member - dashed link to settings */}
              <a
                href="/dashboard/settings"
                className="mt-3 flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-brand-400 hover:bg-brand-50/30 transition-all text-sm text-gray-600 hover:text-brand-700 group"
              >
                <span className="w-6 h-6 rounded-full bg-gray-100 group-hover:bg-brand-100 grid place-items-center text-base leading-none transition-colors">+</span>
                <span className="font-medium">להזמין חבר חדש לסביבת העבודה</span>
                <span className="text-xs text-gray-400">→ הגדרות</span>
              </a>
              <p className="mt-2 text-[11px] text-gray-500 text-center">
                * רשימה זו מציגה רק חברים קיימים בסביבה. הוספת חבר חדש מתבצעת בעמוד ההגדרות
              </p>
            </div>

            {/* Help */}
            <div className="px-6 py-4 mx-6 mb-6 rounded-xl bg-blue-50 border border-blue-100 flex gap-3 items-start">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900">
                <strong className="block mb-1">איך זה עובד:</strong>
                בעלים ומנהלים תמיד רואים הכל. הודעות WhatsApp שמיועדות לטבלה זו לא יצליחו ליצור רשומה אם השולח לא הורשה לערוך.
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="text-xs">
            {error && <span className="text-red-600">{error}</span>}
            {savedAt && (
              <span className="text-green-600 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> נשמר
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-sm">סגור</button>
            <button onClick={handleSave} disabled={saving || loading} className="btn-primary text-sm">
              {saving ? 'שומר...' : 'שמור הרשאות'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function ModeOption({
  active, onClick, icon, title, desc, color,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: 'green' | 'amber' | 'red';
}) {
  const colorClasses = {
    green: active ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300',
    amber: active ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-amber-300',
    red: active ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-red-300',
  }[color];
  const iconColor = {
    green: 'text-green-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
  }[color];

  return (
    <button
      onClick={onClick}
      className={`text-right p-3 rounded-xl border-2 transition-all ${colorClasses}`}
    >
      <div className={`flex items-center gap-2 mb-1 ${iconColor}`}>
        {icon}
        <span className="font-semibold text-sm text-gray-800">{title}</span>
      </div>
      <div className="text-xs text-gray-600">{desc}</div>
    </button>
  );
}

function PermissionSelector({
  value, currentEffective, defaultLabel, onChange,
}: {
  value: 'view' | 'edit' | 'none' | null;
  currentEffective: 'view' | 'edit' | 'none';
  defaultLabel: string;
  onChange: (perm: 'view' | 'edit' | 'none' | null) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5">
      <PermBtn
        active={value === null}
        onClick={() => onChange(null)}
        title="ברירת מחדל"
      >
        <span className="text-[10px]">ברירת מחדל</span>
      </PermBtn>
      <PermBtn
        active={value === 'edit'}
        onClick={() => onChange('edit')}
        title="עריכה מלאה"
        color="green"
      >
        <Pencil className="w-3 h-3" />
      </PermBtn>
      <PermBtn
        active={value === 'view'}
        onClick={() => onChange('view')}
        title="קריאה בלבד"
        color="amber"
      >
        <Eye className="w-3 h-3" />
      </PermBtn>
      <PermBtn
        active={value === 'none'}
        onClick={() => onChange('none')}
        title="חסום"
        color="red"
      >
        <Lock className="w-3 h-3" />
      </PermBtn>
    </div>
  );
}

function PermBtn({
  active, onClick, title, color, children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  color?: 'green' | 'amber' | 'red';
  children: React.ReactNode;
}) {
  const activeColor = !active
    ? 'text-gray-400 hover:text-gray-700'
    : color === 'green' ? 'bg-white text-green-700 shadow-sm'
    : color === 'amber' ? 'bg-white text-amber-700 shadow-sm'
    : color === 'red' ? 'bg-white text-red-700 shadow-sm'
    : 'bg-white text-gray-800 shadow-sm';

  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-2 py-1 rounded-md text-xs flex items-center gap-1 transition-all ${activeColor}`}
    >
      {children}
    </button>
  );
}

function roleLabel(role: string): string {
  return {
    owner: 'בעלים',
    admin: 'מנהל',
    editor: 'עורך',
    viewer: 'צופה',
  }[role] || role;
}

/**
 * FieldRestrictor - per-member control to hide specific fields from view.
 *
 * Renders as a small button (with badge showing # hidden fields if any).
 * Clicking opens a popover with checkboxes, one per field. Checked = visible
 * (default), unchecked = hidden. We invert the UX from the underlying data
 * model (hidden_fields is a deny-list) because users think in terms of
 * "what can they see" rather than "what should I hide".
 */
function FieldRestrictor({
  fields,
  hiddenSlugs,
  isOpen,
  onToggle,
  onChange,
}: {
  fields: FieldInfo[];
  hiddenSlugs: string[];
  isOpen: boolean;
  onToggle: () => void;
  onChange: (newHiddenSlugs: string[]) => void;
}) {
  const hiddenSet = new Set(hiddenSlugs);
  const hiddenCount = hiddenSlugs.length;

  function toggleField(slug: string) {
    const next = new Set(hiddenSet);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    onChange(Array.from(next));
  }

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`text-xs px-2 py-1 rounded-md border transition flex items-center gap-1 ${
          hiddenCount > 0
            ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}
        title={hiddenCount > 0 ? `${hiddenCount} שדות מוסתרים` : 'בחר שדות נסתרים'}
      >
        {hiddenCount > 0 ? (
          <>
            <span>👁️‍🗨️</span>
            <span>{hiddenCount} מוסתרים</span>
          </>
        ) : (
          <>
            <span>👁️</span>
            <span>שדות</span>
          </>
        )}
      </button>

      {isOpen && (
        <>
          {/* Click-outside catcher */}
          <div className="fixed inset-0 z-30" onClick={onToggle} />

          {/* Popover - left-anchored in RTL means it opens to the right
              from the button (toward the table center, away from edge) */}
          <div className="absolute z-40 top-full mt-1 left-0 bg-white rounded-lg shadow-2xl border border-gray-200 min-w-[220px] max-h-[280px] overflow-y-auto py-1">
            <div className="px-3 py-2 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              שדות שהמשתמש יראה
            </div>
            {fields.length === 0 ? (
              <div className="px-3 py-4 text-xs text-gray-500 text-center">
                לטבלה אין שדות עדיין
              </div>
            ) : (
              fields.map((f) => {
                const isHidden = hiddenSet.has(f.slug);
                return (
                  <label
                    key={f.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={() => toggleField(f.slug)}
                      className="rounded"
                    />
                    <span className={isHidden ? 'text-gray-400 line-through' : 'text-gray-900'}>
                      {f.name}
                    </span>
                    <span className="ml-auto text-[10px] text-gray-400 font-mono">
                      {f.type}
                    </span>
                  </label>
                );
              })
            )}
            {fields.length > 0 && (
              <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-[11px] text-brand-600 hover:underline"
                  disabled={hiddenCount === 0}
                >
                  הצג הכל
                </button>
                <button
                  type="button"
                  onClick={() => onChange(fields.map((f) => f.slug))}
                  className="text-[11px] text-amber-700 hover:underline"
                  disabled={hiddenCount === fields.length}
                >
                  הסתר הכל
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
