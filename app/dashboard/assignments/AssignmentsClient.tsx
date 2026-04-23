'use client';

import { useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2, Edit2, X, UserCheck, AlertCircle, Phone as PhoneIcon, ArrowLeft } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Table = { id: string; name: string; slug: string };
type Field = {
  id: string;
  table_id: string;
  name: string;
  slug: string;
  type: string;
  config: any;
};
type Phone = {
  id: string;
  phone: string;
  display_name: string;
  job_title: string | null;
};
type Rule = {
  id: string;
  table_id: string;
  field_id: string;
  match_value: string | null;
  priority: number;
  is_active: boolean;
  assignee_phone_id: string | null;
  raw_phone: string | null;
  raw_name: string | null;
  authorized_phones: Phone | Phone[] | null;
};

// Field types that make sense as routing targets — anything that has discrete
// values the AI will fill in. Free-text fields would create too much noise.
const ROUTABLE_FIELD_TYPES = new Set(['select', 'status', 'multi_select', 'tags', 'category']);

export default function AssignmentsClient({
  workspaceId, initialTables, initialFields, initialPhones, initialRules, canEdit,
}: {
  workspaceId: string;
  initialTables: Table[];
  initialFields: Field[];
  initialPhones: Phone[];
  initialRules: Rule[];
  canEdit: boolean;
}) {
  const supabase = createClient();
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);

  // Group rules by table for display — feels much more navigable than a flat list
  const rulesByTable = useMemo(() => {
    const map = new Map<string, Rule[]>();
    for (const rule of rules) {
      if (!map.has(rule.table_id)) map.set(rule.table_id, []);
      map.get(rule.table_id)!.push(rule);
    }
    return map;
  }, [rules]);

  function fieldFor(rule: Rule): Field | undefined {
    return initialFields.find(f => f.id === rule.field_id);
  }

  function tableFor(rule: Rule): Table | undefined {
    return initialTables.find(t => t.id === rule.table_id);
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(rule: Rule) {
    setEditing(rule);
    setModalOpen(true);
  }

  async function handleSave(formData: {
    table_id: string;
    field_id: string;
    match_value: string;        // empty string → catch-all (NULL in DB)
    assignee_mode: 'phone' | 'raw';
    assignee_phone_id: string;  // when assignee_mode = 'phone'
    raw_phone: string;          // when assignee_mode = 'raw'
    raw_name: string;
    priority: number;
    is_active: boolean;
  }) {
    const payload: any = {
      workspace_id: workspaceId,
      table_id: formData.table_id,
      field_id: formData.field_id,
      match_value: formData.match_value.trim() || null,
      priority: formData.priority,
      is_active: formData.is_active,
      // Only one of these is non-null — the CHECK constraint enforces it
      assignee_phone_id: formData.assignee_mode === 'phone' ? formData.assignee_phone_id : null,
      raw_phone: formData.assignee_mode === 'raw' ? formData.raw_phone.trim() : null,
      raw_name: formData.assignee_mode === 'raw' ? formData.raw_name.trim() : null,
    };

    if (editing) {
      const { data, error } = await supabase
        .from('assignment_rules')
        .update(payload)
        .eq('id', editing.id)
        .select(`
          id, table_id, field_id, match_value, priority, is_active,
          assignee_phone_id, raw_phone, raw_name,
          authorized_phones ( id, phone, display_name, job_title )
        `)
        .single();
      if (error) { alert('שגיאה בשמירה: ' + error.message); return; }
      setRules(rs => rs.map(r => r.id === editing.id ? (data as any) : r));
    } else {
      const { data, error } = await supabase
        .from('assignment_rules')
        .insert(payload)
        .select(`
          id, table_id, field_id, match_value, priority, is_active,
          assignee_phone_id, raw_phone, raw_name,
          authorized_phones ( id, phone, display_name, job_title )
        `)
        .single();
      if (error) { alert('שגיאה ביצירה: ' + error.message); return; }
      setRules(rs => [...rs, data as any].sort((a, b) => a.priority - b.priority));
    }
    setModalOpen(false);
  }

  async function handleDelete(rule: Rule) {
    if (!confirm('למחוק את הכלל?')) return;
    const { error } = await supabase.from('assignment_rules').delete().eq('id', rule.id);
    if (error) { alert('שגיאה במחיקה: ' + error.message); return; }
    setRules(rs => rs.filter(r => r.id !== rule.id));
  }

  async function toggleActive(rule: Rule) {
    const { error } = await supabase
      .from('assignment_rules')
      .update({ is_active: !rule.is_active })
      .eq('id', rule.id);
    if (error) { alert('שגיאה: ' + error.message); return; }
    setRules(rs => rs.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 pr-4 md:pr-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 pr-12 md:pr-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-1">שיוך פניות לנציגים</h1>
          <p className="text-sm text-gray-600">
            הגדירו לכל קטגוריה איזה נציג מטפל. כשתיפתח פנייה תואמת — הוא יקבל הודעת וואטסאפ אישית.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-3 md:px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">כלל חדש</span>
            <span className="sm:hidden">חדש</span>
          </button>
        )}
      </div>

      {/* Empty state */}
      {rules.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <UserCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">אין עדיין כללי שיוך</h3>
          <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">
            הוסיפו כלל ראשון - למשל: "כל פנייה בקטגוריה <strong>אינסטלציה</strong> תועבר לדני (052-...)".
            כשהבוט יסווג פנייה חדשה לקטגוריה הזו, דני יקבל התראה אישית בוואטסאפ.
          </p>
          {canEdit && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700"
            >
              <Plus className="w-4 h-4" />
              צרו כלל ראשון
            </button>
          )}
        </div>
      )}

      {/* Rules grouped by table */}
      {rules.length > 0 && initialTables.map(table => {
        const tableRules = rulesByTable.get(table.id);
        if (!tableRules || tableRules.length === 0) return null;

        return (
          <div key={table.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">{table.name}</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {tableRules.map(rule => {
                const field = fieldFor(rule);
                // Supabase joins can return either an array or a single object
                // depending on FK shape — normalize both.
                const ap = Array.isArray(rule.authorized_phones)
                  ? rule.authorized_phones[0]
                  : rule.authorized_phones;
                const assignee = ap || { display_name: rule.raw_name, phone: rule.raw_phone };
                return (
                  <div key={rule.id} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50">
                    {/* Match condition */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs text-gray-500 shrink-0">כש־</span>
                      <span className="text-sm font-medium text-gray-700 shrink-0">
                        {field?.name || '?'}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">=</span>
                      {rule.match_value === null ? (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                          כל ערך
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium truncate">
                          {rule.match_value}
                        </span>
                      )}
                    </div>

                    {/* Arrow */}
                    <ArrowLeft className="w-4 h-4 text-gray-300 shrink-0" />

                    {/* Assignee */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <UserCheck className="w-4 h-4 text-brand-600 shrink-0" />
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {assignee?.display_name || 'ללא שם'}
                      </span>
                      <span className="text-xs text-gray-500 truncate font-mono" dir="ltr">
                        {assignee?.phone}
                      </span>
                    </div>

                    {/* Status + actions */}
                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleActive(rule)}
                          className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                            rule.is_active
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {rule.is_active ? 'פעיל' : 'מושבת'}
                        </button>
                        <button
                          onClick={() => openEdit(rule)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                          title="עריכה"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(rule)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="מחיקה"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Help block — only show when there are rules */}
      {rules.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3 text-sm">
          <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-blue-900">
            <strong>איך זה עובד:</strong> כשהבוט יוצר רשומה חדשה, הוא בודק את הכללים לפי <strong>סדר עדיפות</strong> (מהנמוך לגבוה).
            הכלל הראשון שמתאים — מנצח. הנציג מקבל הודעת וואטסאפ אישית עם פרטי הפנייה ולינק לדשבורד.
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <RuleModal
          rule={editing}
          tables={initialTables}
          fields={initialFields}
          phones={initialPhones}
          existingRules={rules}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function RuleModal({
  rule, tables, fields, phones, existingRules, onSave, onClose,
}: {
  rule: Rule | null;
  tables: Table[];
  fields: Field[];
  phones: Phone[];
  existingRules: Rule[];
  onSave: (data: any) => void | Promise<void>;
  onClose: () => void;
}) {
  // Initialize form state. When editing, derive assignee_mode from which side
  // is populated — that's also the source of truth in the DB.
  const [tableId, setTableId] = useState(rule?.table_id || tables[0]?.id || '');
  const [fieldId, setFieldId] = useState(rule?.field_id || '');
  const [matchValue, setMatchValue] = useState(rule?.match_value || '');
  const [assigneeMode, setAssigneeMode] = useState<'phone' | 'raw'>(
    rule?.raw_phone ? 'raw' : 'phone'
  );
  const [assigneePhoneId, setAssigneePhoneId] = useState(rule?.assignee_phone_id || phones[0]?.id || '');
  const [rawPhone, setRawPhone] = useState(rule?.raw_phone || '');
  const [rawName, setRawName] = useState(rule?.raw_name || '');
  const [priority, setPriority] = useState(rule?.priority ?? 100);
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  // Show only routable fields belonging to the chosen table
  const tableFields = useMemo(
    () => fields.filter(f => f.table_id === tableId && ROUTABLE_FIELD_TYPES.has(f.type)),
    [fields, tableId]
  );

  // When user changes the table, reset the field selection (old field probably
  // doesn't belong to the new table)
  function onTableChange(newTableId: string) {
    setTableId(newTableId);
    const firstField = fields.find(f => f.table_id === newTableId && ROUTABLE_FIELD_TYPES.has(f.type));
    setFieldId(firstField?.id || '');
    setMatchValue(''); // clear match value too — it's tied to field options
  }

  // For select/status fields we can show the available options as a dropdown
  // instead of free text — much harder to typo.
  const selectedField = fields.find(f => f.id === fieldId);
  const fieldOptions: Array<{ value: string; label: string }> =
    selectedField?.config?.options || [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tableId || !fieldId) {
      alert('בחרו טבלה ושדה');
      return;
    }
    if (assigneeMode === 'phone' && !assigneePhoneId) {
      alert('בחרו נציג מהרשימה');
      return;
    }
    if (assigneeMode === 'raw' && (!rawPhone.trim() || !rawName.trim())) {
      alert('הזינו טלפון ושם של הנציג');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        table_id: tableId,
        field_id: fieldId,
        match_value: matchValue,
        assignee_mode: assigneeMode,
        assignee_phone_id: assigneePhoneId,
        raw_phone: rawPhone,
        raw_name: rawName,
        priority,
        is_active: isActive,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">
            {rule ? 'עריכת כלל שיוך' : 'כלל שיוך חדש'}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Table */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">טבלה</label>
            <select
              value={tableId}
              onChange={(e) => onTableChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {tables.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שדה לסיווג</label>
            {tableFields.length === 0 ? (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                לטבלה זו אין שדות מסוג קטגוריה / סטטוס / תגיות. הוסיפו שדה כזה כדי ליצור כלל שיוך.
              </div>
            ) : (
              <select
                value={fieldId}
                onChange={(e) => { setFieldId(e.target.value); setMatchValue(''); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— בחרו שדה —</option>
                {tableFields.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Match value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ערך תואם
              <span className="text-xs text-gray-500 font-normal mr-2">
                (השאירו ריק לתפיסת כל הערכים)
              </span>
            </label>
            {fieldOptions.length > 0 ? (
              <select
                value={matchValue}
                onChange={(e) => setMatchValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">— כל ערך (catch-all) —</option>
                {fieldOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={matchValue}
                onChange={(e) => setMatchValue(e.target.value)}
                placeholder="למשל: אינסטלציה"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            )}
          </div>

          {/* Divider */}
          <div className="pt-2 border-t border-gray-100" />

          {/* Assignee mode toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">נציג מטפל</label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setAssigneeMode('phone')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  assigneeMode === 'phone'
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                מספר מורשה
              </button>
              <button
                type="button"
                onClick={() => setAssigneeMode('raw')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  assigneeMode === 'raw'
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                טלפון חיצוני
              </button>
            </div>

            {assigneeMode === 'phone' ? (
              phones.length === 0 ? (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  אין מספרים מורשים. עברו ל"מספרים מורשים" והוסיפו את הנציגים.
                </div>
              ) : (
                <select
                  value={assigneePhoneId}
                  onChange={(e) => setAssigneePhoneId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {phones.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.display_name} {p.job_title ? `(${p.job_title})` : ''} — {p.phone}
                    </option>
                  ))}
                </select>
              )
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={rawName}
                  onChange={(e) => setRawName(e.target.value)}
                  placeholder="שם הנציג"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <input
                  type="tel"
                  dir="ltr"
                  value={rawPhone}
                  onChange={(e) => setRawPhone(e.target.value)}
                  placeholder="0501234567"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            )}
          </div>

          {/* Priority + active */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                עדיפות
                <span className="text-xs text-gray-500 font-normal mr-2">(נמוך = קודם)</span>
              </label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 100)}
                min={1}
                max={9999}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">סטטוס</label>
              <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-brand-600"
                />
                <span className="text-sm">{isActive ? 'פעיל' : 'מושבת'}</span>
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={saving || !fieldId}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'שומר…' : (rule ? 'עדכון' : 'יצירה')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
