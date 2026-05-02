// app/dashboard/hub/crm/AddLeadModal.tsx
// מודאל ליצירת ליד חדש - נטען לפי דרישה מהקנבן/דשבורד
'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newLead: any) => void;
  defaultStage?: string;
}

const STAGES = [
  { key: 'new', label: 'חדש', color: '#3B82F6' },
  { key: 'contacted', label: 'יצרנו קשר', color: '#8B5CF6' },
  { key: 'qualified', label: 'מוסמך', color: '#F59E0B' },
  { key: 'proposal', label: 'הצעה נשלחה', color: '#FB923C' },
  { key: 'negotiation', label: 'משא ומתן', color: '#EC4899' },
  { key: 'won', label: 'נסגר בהצלחה', color: '#10B981' },
];

const SOURCES = [
  { key: 'referral', label: '🤝 הפניה' },
  { key: 'website', label: '🌐 אתר' },
  { key: 'google', label: '🔍 גוגל' },
  { key: 'whatsapp', label: '💬 וואטסאפ' },
  { key: 'facebook', label: '📘 פייסבוק' },
  { key: 'instagram', label: '📷 אינסטגרם' },
  { key: 'cold_call', label: '📞 שיחת קור' },
  { key: 'other', label: '➕ אחר' },
];

export default function AddLeadModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  defaultStage = 'new'
}: AddLeadModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    contact_name: '',
    phone: '',
    email: '',
    value: '',
    stage: defaultStage,
    source: 'other',
    notes: '',
  });

  if (!isOpen) return null;

  function reset() {
    setForm({
      title: '',
      contact_name: '',
      phone: '',
      email: '',
      value: '',
      stage: defaultStage,
      source: 'other',
      notes: '',
    });
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('חובה למלא כותרת לליד');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/crm/lead-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const result = await res.json();
      
      if (!res.ok || !result.success) {
        setError(result.error || 'יצירת הליד נכשלה');
        setSubmitting(false);
        return;
      }

      // הצלחה
      onSuccess(result.lead);
      reset();
      onClose();
    } catch (err) {
      setError('שגיאת רשת - נסה שוב');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">➕ הוסף ליד חדש</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          
          {/* כותרת - חובה */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              כותרת הליד <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="לדוגמה: דירת 4 חדרים בהרצל"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              autoFocus
            />
          </div>

          {/* שם איש קשר */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              שם איש קשר
            </label>
            <input
              type="text"
              value={form.contact_name}
              onChange={e => setForm({ ...form, contact_name: e.target.value })}
              placeholder="ישראל ישראלי"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
          </div>

          {/* טלפון + אימייל */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="0501234567"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="info@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* ערך */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ערך הזדמנות (₪)
            </label>
            <input
              type="number"
              value={form.value}
              onChange={e => setForm({ ...form, value: e.target.value })}
              placeholder="100000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              min="0"
            />
          </div>

          {/* שלב */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">שלב</label>
            <div className="grid grid-cols-3 gap-2">
              {STAGES.map(s => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setForm({ ...form, stage: s.key })}
                  className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                    form.stage === s.key 
                      ? 'text-white shadow-md' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  style={form.stage === s.key ? { backgroundColor: s.color } : {}}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* מקור */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">מקור הליד</label>
            <div className="grid grid-cols-2 gap-2">
              {SOURCES.map(s => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setForm({ ...form, source: s.key })}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    form.source === s.key
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* הערות */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
            <textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="מידע נוסף על הליד..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              ❌ {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={submitting}
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={submitting || !form.title.trim()}
              className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {submitting ? 'יוצר...' : '✅ צור ליד'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
