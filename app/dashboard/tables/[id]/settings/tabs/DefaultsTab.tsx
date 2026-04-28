'use client';

import { useState } from 'react';
import { Save, Loader2, Video, MapPin, Clock, Smartphone } from 'lucide-react';
import type { TableData, FieldData } from '../TableSettingsClient';

export default function DefaultsTab({
  table, setTable, fields, setError, disabled,
}: {
  table: TableData;
  setTable: (t: TableData) => void;
  fields: FieldData[];
  setError: (msg: string | null) => void;
  disabled: boolean;
}) {
  const initial = table.settings || {};

  const [zoomLink, setZoomLink] = useState<string>(initial.default_zoom_link || '');
  const [meetLink, setMeetLink] = useState<string>(initial.default_meet_link || '');
  const [address, setAddress] = useState<string>(initial.default_address || '');
  const [duration, setDuration] = useState<string>(String(initial.meeting_duration_minutes || ''));
  const [workStart, setWorkStart] = useState<string>(initial.working_hours_start || '');
  const [workEnd, setWorkEnd] = useState<string>(initial.working_hours_end || '');
  const [phoneFieldSlug, setPhoneFieldSlug] = useState<string>(initial.phone_field_slug || autoDetect(fields, 'phone') || '');
  const [datetimeFieldSlug, setDatetimeFieldSlug] = useState<string>(initial.datetime_field_slug || autoDetect(fields, 'datetime') || '');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Field options for the dropdowns
  const phoneFields = fields.filter((f) => f.type === 'phone' || f.slug.includes('phone') || f.slug.includes('טלפון'));
  const datetimeFields = fields.filter((f) => f.type === 'datetime' || f.type === 'date');

  async function save() {
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      const newSettings: any = { ...initial };

      // Only include non-empty values; remove keys that are cleared
      const set = (key: string, val: any) => {
        if (val === '' || val === null || val === undefined) delete newSettings[key];
        else newSettings[key] = val;
      };

      set('default_zoom_link', zoomLink.trim());
      set('default_meet_link', meetLink.trim());
      set('default_address', address.trim());
      set('meeting_duration_minutes', duration ? Number(duration) : null);
      set('working_hours_start', workStart);
      set('working_hours_end', workEnd);
      set('phone_field_slug', phoneFieldSlug);
      set('datetime_field_slug', datetimeFieldSlug);

      const res = await fetch(`/api/tables/${table.id}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: newSettings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'failed to save');

      setTable({ ...table, settings: newSettings });
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
      <Section
        title="זיהוי שדות חכם"
        description="המערכת משתמשת בשדות אלה לאוטומציות (טלפון לשליחת WhatsApp, תאריך לתזכורות)"
        icon={Smartphone}
      >
        <Field label="שדה הטלפון" hint="לאיזה שדה תישלח הודעת WhatsApp">
          <select
            value={phoneFieldSlug}
            onChange={(e) => setPhoneFieldSlug(e.target.value)}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 bg-white disabled:bg-slate-50"
          >
            <option value="">— בחר שדה —</option>
            {phoneFields.map((f) => (
              <option key={f.slug} value={f.slug}>{f.name} ({f.slug})</option>
            ))}
          </select>
          {phoneFields.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">
              ⚠️ אין שדה טלפון בטבלה. <a href={`/dashboard/${table.id}`} className="underline">הוסף שדה</a>
            </p>
          )}
        </Field>

        <Field label="שדה התאריך/שעה" hint="ביחס לשדה זה תיקבענה תזכורות">
          <select
            value={datetimeFieldSlug}
            onChange={(e) => setDatetimeFieldSlug(e.target.value)}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 bg-white disabled:bg-slate-50"
          >
            <option value="">— בחר שדה —</option>
            {datetimeFields.map((f) => (
              <option key={f.slug} value={f.slug}>{f.name} ({f.slug})</option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title="לינקי וידאו ברירת מחדל" description="ישולבו אוטומטית בהודעות אישור הפגישה" icon={Video}>
        <Field label="לינק Zoom" hint="הלינק האישי שלך — יוכנס בתבניות הודעה עם {zoom_link}">
          <input
            type="url"
            value={zoomLink}
            onChange={(e) => setZoomLink(e.target.value)}
            disabled={disabled}
            placeholder="https://zoom.us/j/..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50 ltr:pl-3 dir-ltr text-left"
          />
        </Field>

        <Field label="לינק Google Meet" hint="חלופי / נוסף ל-Zoom">
          <input
            type="url"
            value={meetLink}
            onChange={(e) => setMeetLink(e.target.value)}
            disabled={disabled}
            placeholder="https://meet.google.com/..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50 dir-ltr text-left"
          />
        </Field>
      </Section>

      <Section title="מיקום ומשך פגישה" description="ישמשו כברירת מחדל לפגישות חדשות" icon={MapPin}>
        <Field label="כתובת ברירת מחדל" hint="לפגישות פיזיות במשרד">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={disabled}
            placeholder="למשל: BSR City, מגדל Y קומה 24, פתח תקווה"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50"
          />
        </Field>

        <Field label="משך פגישה (דקות)" hint="ברירת מחדל אם לא צוין במפורש">
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            disabled={disabled}
            placeholder="60"
            min="5"
            max="480"
            className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50"
          />
        </Field>
      </Section>

      <Section title="שעות עבודה" description="ה-AI לא יציע פגישות מחוץ לשעות אלה" icon={Clock}>
        <div className="flex items-center gap-3">
          <Field label="משעה">
            <input
              type="time"
              value={workStart}
              onChange={(e) => setWorkStart(e.target.value)}
              disabled={disabled}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50"
            />
          </Field>
          <span className="text-slate-400 mt-6">—</span>
          <Field label="עד שעה">
            <input
              type="time"
              value={workEnd}
              onChange={(e) => setWorkEnd(e.target.value)}
              disabled={disabled}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:bg-slate-50"
            />
          </Field>
        </div>
      </Section>

      <div className="sticky bottom-4 flex items-center justify-end gap-2">
        {saved && <span className="text-sm text-emerald-700 font-medium">✓ נשמר</span>}
        <button
          type="button"
          onClick={save}
          disabled={saving || disabled}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          שמור הגדרות
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function autoDetect(fields: FieldData[], type: 'phone' | 'datetime'): string | null {
  if (type === 'phone') {
    return fields.find((f) => f.type === 'phone')?.slug
      || fields.find((f) => f.slug.toLowerCase().includes('phone'))?.slug
      || fields.find((f) => f.name.includes('טלפון'))?.slug
      || null;
  }
  if (type === 'datetime') {
    return fields.find((f) => f.type === 'datetime')?.slug
      || fields.find((f) => f.slug === 'scheduled_at')?.slug
      || fields.find((f) => f.type === 'date')?.slug
      || null;
  }
  return null;
}

function Section({
  title, description, icon: Icon, children,
}: {
  title: string;
  description?: string;
  icon?: any;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600 shrink-0">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label, hint, children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
