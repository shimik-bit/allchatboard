'use client';

import { useState } from 'react';
import { Save, Loader2 } from 'lucide-react';
import type { TableData } from '../TableSettingsClient';

const COLOR_OPTIONS = [
  '#7C3AED', '#EC4899', '#F59E0B', '#10B981', '#3B82F6',
  '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#64748B',
];

const ICON_OPTIONS = ['📋', '📅', '✅', '🎯', '💼', '📞', '🛒', '🏠', '💰', '📊', '⚙️', '👥'];

export default function GeneralTab({
  table, setTable, setError, disabled,
}: {
  table: TableData;
  setTable: (t: TableData) => void;
  setError: (msg: string | null) => void;
  disabled: boolean;
}) {
  const [name, setName] = useState(table.name);
  const [description, setDescription] = useState(table.description || '');
  const [icon, setIcon] = useState(table.icon || '📋');
  const [color, setColor] = useState(table.color || '#7C3AED');
  const [keywords, setKeywords] = useState((table.ai_keywords || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const dirty =
    name !== table.name ||
    description !== (table.description || '') ||
    icon !== (table.icon || '📋') ||
    color !== (table.color || '#7C3AED') ||
    keywords !== (table.ai_keywords || []).join(', ');

  async function save() {
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      const ai_keywords = keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      const res = await fetch(`/api/tables/${table.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, icon, color, ai_keywords }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed to save');

      setTable({ ...table, name, description, icon, color, ai_keywords });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e?.message || 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Section title="פרטי הטבלה" description="שם, תיאור ומראה ויזואלי">
        <Field label="שם הטבלה" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </Field>

        <Field label="תיאור" hint="עוזר ל-AI להבין מה הטבלה מכילה">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={disabled}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50 disabled:text-slate-500 resize-none"
          />
        </Field>

        <Field label="אייקון">
          <div className="flex flex-wrap gap-2">
            {ICON_OPTIONS.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => !disabled && setIcon(i)}
                disabled={disabled}
                className={`h-10 w-10 rounded-lg border text-xl transition ${
                  icon === i
                    ? 'border-violet-600 bg-violet-50 ring-1 ring-violet-200'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                } disabled:opacity-50`}
              >
                {i}
              </button>
            ))}
          </div>
        </Field>

        <Field label="צבע">
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => !disabled && setColor(c)}
                disabled={disabled}
                className={`h-10 w-10 rounded-lg border-2 transition ${
                  color === c ? 'border-slate-900 ring-2 ring-slate-300' : 'border-white shadow-sm'
                } disabled:opacity-50`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>
      </Section>

      <Section
        title="מילות מפתח לסיווג AI"
        description="ה-AI ישתמש במילים אלו כדי לזהות איזה הודעות שייכות לטבלה הזו"
      >
        <Field
          label="מילות מפתח"
          hint="מופרדות בפסיקים. דוגמה: פגישה, מפגש, דיון, התייעצות"
        >
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            disabled={disabled}
            placeholder="למשל: פגישה, מפגש, פנקס יומן"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50"
          />
        </Field>
      </Section>

      {/* Save bar */}
      <div className="sticky bottom-4 flex items-center justify-end gap-2">
        {saved && <span className="text-sm text-emerald-700 font-medium">✓ נשמר</span>}
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving || disabled}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          שמור שינויים
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function Section({
  title, description, children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label, hint, required, children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
        {required && <span className="text-rose-500 mr-1">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
