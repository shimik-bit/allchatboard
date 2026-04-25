'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AuthorizedPhone, PhonePermission } from '@/lib/types/database';
import { Plus, Trash2, Edit2, Phone, Shield, Edit3, Eye, X } from 'lucide-react';

const PERMISSION_INFO: Record<PhonePermission, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  admin: {
    label: 'מנהל',
    icon: <Shield className="w-3.5 h-3.5" />,
    color: 'bg-purple-100 text-purple-700',
    desc: 'יוצר, מעדכן ושולף נתונים',
  },
  writer: {
    label: 'מזין נתונים',
    icon: <Edit3 className="w-3.5 h-3.5" />,
    color: 'bg-blue-100 text-blue-700',
    desc: 'יוצר ומעדכן רשומות',
  },
  reader: {
    label: 'צופה בלבד',
    icon: <Eye className="w-3.5 h-3.5" />,
    color: 'bg-gray-100 text-gray-600',
    desc: 'מקבל מידע, לא יוצר רשומות',
  },
};

export default function PhonesClient({
  workspaceId, initialPhones, canEdit,
}: {
  workspaceId: string;
  initialPhones: AuthorizedPhone[];
  canEdit: boolean;
}) {
  const supabase = createClient();
  const [phones, setPhones] = useState<AuthorizedPhone[]>(initialPhones);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AuthorizedPhone | null>(null);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(p: AuthorizedPhone) {
    setEditing(p);
    setModalOpen(true);
  }

  async function handleSave(data: Partial<AuthorizedPhone>) {
    if (editing) {
      const { data: updated, error } = await supabase
        .from('authorized_phones')
        .update({
          phone: data.phone,
          display_name: data.display_name,
          job_title: data.job_title || null,
          permission: data.permission,
          is_active: data.is_active,
          notes: data.notes || null,
        })
        .eq('id', editing.id)
        .select().single();
      if (error) { alert('שגיאה: ' + error.message); return; }
      if (updated) setPhones((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } else {
      const { data: created, error } = await supabase
        .from('authorized_phones')
        .insert({
          workspace_id: workspaceId,
          phone: data.phone,
          display_name: data.display_name,
          job_title: data.job_title || null,
          permission: data.permission || 'writer',
          is_active: data.is_active ?? true,
          notes: data.notes || null,
        })
        .select().single();
      if (error) { alert('שגיאה: ' + error.message); return; }
      if (created) setPhones((prev) => [created, ...prev]);
    }
    setModalOpen(false);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('למחוק את המספר הזה?')) return;
    const { error } = await supabase.from('authorized_phones').delete().eq('id', id);
    if (error) { alert('שגיאה: ' + error.message); return; }
    setPhones((prev) => prev.filter((p) => p.id !== id));
  }

  async function toggleActive(p: AuthorizedPhone) {
    const { error } = await supabase
      .from('authorized_phones')
      .update({ is_active: !p.is_active })
      .eq('id', p.id);
    if (error) { alert('שגיאה: ' + error.message); return; }
    setPhones((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !x.is_active } : x)));
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6 md:mb-8 flex items-start md:items-center justify-between gap-3 pr-12 md:pr-0 flex-wrap">
        <div className="min-w-0 flex-1">
          <h1 className="font-display font-bold text-xl md:text-3xl mb-1">מספרי טלפון מורשים</h1>
          <p className="text-sm text-gray-500">רק מספרים שמופיעים כאן יוכלו לשלוח נתונים למערכת דרך וואטסאפ</p>
        </div>
        {canEdit && (
          <button onClick={openCreate} className="btn-primary text-sm shrink-0">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">הוסף מספר</span>
            <span className="sm:hidden">חדש</span>
          </button>
        )}
      </div>

      {phones.length === 0 ? (
        <div className="card p-12 text-center">
          <Phone className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">עוד לא הוספת מספרים מורשים.</p>
          <p className="text-sm text-gray-400 mt-1">בלי מספרים מורשים — אף הודעת וואטסאפ לא תיכנס למערכת.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {phones.map((p) => {
            const info = PERMISSION_INFO[p.permission];
            return (
              <div
                key={p.id}
                className={`card p-4 flex items-center gap-4 ${!p.is_active ? 'opacity-60' : ''}`}
              >
                <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-lg font-semibold">
                  {p.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{p.display_name}</span>
                    {p.job_title && (
                      <span className="text-xs text-gray-500">— {p.job_title}</span>
                    )}
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${info.color}`}>
                      {info.icon} {info.label}
                    </span>
                    {!p.is_active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        מושהה
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 font-mono" dir="ltr">
                    {p.phone}
                  </div>
                  {p.notes && (
                    <div className="text-xs text-gray-400 mt-1">{p.notes}</div>
                  )}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleActive(p)}
                      className="p-2 rounded-lg hover:bg-gray-100"
                      title={p.is_active ? 'השעה' : 'הפעל'}
                    >
                      <span className={`block w-4 h-4 rounded-full ${p.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <PhoneModal
          phone={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function PhoneModal({
  phone, onClose, onSave,
}: {
  phone: AuthorizedPhone | null;
  onClose: () => void;
  onSave: (data: Partial<AuthorizedPhone>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    phone: phone?.phone || '',
    display_name: phone?.display_name || '',
    job_title: phone?.job_title || '',
    permission: phone?.permission || 'writer' as PhonePermission,
    is_active: phone?.is_active ?? true,
    notes: phone?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  function normalizePhone(p: string): string {
    // strip non-digits
    let digits = p.replace(/\D/g, '');
    // israeli local 0XX → 972XX
    if (digits.startsWith('0')) digits = '972' + digits.slice(1);
    return digits;
  }

  async function handleSubmit() {
    if (!form.phone.trim() || !form.display_name.trim()) {
      alert('מספר ושם הם שדות חובה');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...form,
        phone: normalizePhone(form.phone),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-black/40 animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl md:rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] md:max-h-[90vh] flex flex-col animate-slide-up overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 md:px-6 py-3.5 border-b border-gray-200 flex-shrink-0">
          <h2 className="font-display font-bold text-lg">
            {phone ? 'עריכת מספר' : 'הוספת מספר מורשה'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" aria-label="סגור">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 md:px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              מספר טלפון <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              dir="ltr"
              placeholder="050-1234567 או +972501234567"
              className="input-field"
            />
            <div className="text-xs text-gray-500 mt-1">
              קידומת ישראל מתורגמת אוטומטית (0XX → 972XX)
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              שם <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              placeholder="יוסי כהן"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">תפקיד בעסק</label>
            <input
              type="text"
              value={form.job_title}
              onChange={(e) => setForm({ ...form, job_title: e.target.value })}
              placeholder="טכנאי, מנהל משמרת, וכו׳"
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">רמת הרשאה</label>
            <div className="space-y-2">
              {(Object.entries(PERMISSION_INFO) as [PhonePermission, typeof PERMISSION_INFO['admin']][]).map(([key, info]) => (
                <label
                  key={key}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                    form.permission === key
                      ? 'border-brand-500 bg-brand-50/50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    checked={form.permission === key}
                    onChange={() => setForm({ ...form, permission: key })}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      {info.icon}
                      <span className="font-medium text-sm">{info.label}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{info.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">הערות</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="input-field"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm">פעיל</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 md:px-6 py-3.5 border-t border-gray-200 bg-gray-50/50 flex-shrink-0">
          <button onClick={onClose} className="btn-secondary text-sm" disabled={saving}>ביטול</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary text-sm">
            {saving ? 'שומר...' : (phone ? 'שמור שינויים' : 'הוסף')}
          </button>
        </div>
      </div>
    </div>
  );
}
