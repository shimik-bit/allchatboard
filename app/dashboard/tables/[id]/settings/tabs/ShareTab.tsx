'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Share2, Loader2, Plus, Copy, ExternalLink, Trash2, Edit2, Power,
  Check, AlertCircle, Eye, BookOpen, Sparkles, X, Calendar as CalIcon,
  Clock, Settings as SettingsIcon,
} from 'lucide-react';
import type { TableData, FieldData } from '../TableSettingsClient';

type BookingPage = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  enabled: boolean;
  duration_minutes: number;
  buffer_minutes: number;
  advance_notice_days: number;
  min_lead_time_hours: number;
  working_hours: any[];
  field_mapping: Record<string, string>;
  form_fields: any[];
  confirmation_message: string | null;
  view_count: number;
  booking_count: number;
  created_at: string;
};

const HE_DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function ShareTab({
  table, fields, setError, disabled,
}: {
  table: TableData;
  fields: FieldData[];
  setError: (msg: string | null) => void;
  disabled: boolean;
}) {
  const [pages, setPages] = useState<BookingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BookingPage | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/booking-pages?workspace_id=${table.workspace_id}&table_id=${table.id}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setPages(d.pages || []);
    } catch (e: any) {
      setError(e?.message || 'שגיאה בטעינה');
    } finally {
      setLoading(false);
    }
  }, [table.id, table.workspace_id, setError]);

  useEffect(() => { load(); }, [load]);

  // Detect required fields automatically
  const datetimeFields = fields.filter((f) => f.type === 'datetime' || f.type === 'date');
  const phoneFields = fields.filter((f) => f.type === 'phone' || f.slug.includes('phone') || f.slug.includes('טלפון'));
  const textFields = fields.filter((f) => f.type === 'text' || f.type === 'string');
  const canCreate = datetimeFields.length > 0;

  async function createNew() {
    setError(null);
    // Auto-suggest field mapping
    const settings = table.settings || {};
    const mapping: Record<string, string> = {
      datetime_field_slug: settings.datetime_field_slug || datetimeFields[0]?.slug || '',
    };
    if (phoneFields[0]) mapping.phone_field_slug = phoneFields[0].slug;
    const titleField = textFields.find((f) => f.slug.includes('title') || f.slug.includes('כותרת') || f.slug === 'name');
    if (titleField) mapping.title_field_slug = titleField.slug;
    const nameField = textFields.find((f) => f.slug.includes('name') || f.slug.includes('שם'));
    if (nameField && nameField.slug !== mapping.title_field_slug) mapping.name_field_slug = nameField.slug;

    setCreating(true);
    try {
      const res = await fetch('/api/booking-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: table.workspace_id,
          table_id: table.id,
          title: `קבע פגישה — ${table.name}`,
          field_mapping: mapping,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setPages([d.page, ...pages]);
      setEditing(d.page);
    } catch (e: any) {
      setError(e?.message || 'שגיאה ביצירה');
    } finally {
      setCreating(false);
    }
  }

  async function toggleEnabled(p: BookingPage) {
    try {
      const res = await fetch(`/api/booking-pages/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !p.enabled }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setPages(pages.map((x) => x.id === p.id ? d.page : x));
    } catch (e: any) {
      setError(e?.message);
    }
  }

  async function deletePage(p: BookingPage) {
    if (!confirm(`למחוק את לינק השיתוף "${p.title}"?\nהלינק יפסיק לעבוד מיידית.`)) return;
    try {
      const res = await fetch(`/api/booking-pages/${p.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('failed');
      setPages(pages.filter((x) => x.id !== p.id));
    } catch (e: any) {
      setError(e?.message || 'שגיאה במחיקה');
    }
  }

  if (loading) return <Center><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></Center>;

  return (
    <div className="space-y-6">
      {/* Empty state / intro */}
      {pages.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/50 p-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-violet-100 flex items-center justify-center mb-3">
            <Share2 className="h-6 w-6 text-violet-600" />
          </div>
          <h3 className="font-semibold text-slate-900">צור לינק לקביעת פגישות</h3>
          <p className="mt-1 text-sm text-slate-600 max-w-sm mx-auto">
            קבל URL ציבורי שתשלח ללקוחות. הם יבחרו זמן פנוי, ימלאו פרטים, וזה ייכנס אוטומטית לטבלה.
          </p>
          {!canCreate ? (
            <div className="mt-4 inline-flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800 max-w-md text-right">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>הטבלה צריכה לפחות שדה תאריך/שעה אחד כדי לאפשר שיתוף יומן. <a href={`/dashboard/${table.id}`} className="underline font-medium">הוסף שדה</a></span>
            </div>
          ) : (
            <button
              onClick={createNew}
              disabled={creating || disabled}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              צור לינק שיתוף
            </button>
          )}
        </div>
      )}

      {pages.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">לינקי שיתוף ({pages.length})</h2>
            <button
              onClick={createNew}
              disabled={creating || disabled || !canCreate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              חדש
            </button>
          </div>

          <div className="space-y-2">
            {pages.map((p) => (
              <PageCard
                key={p.id}
                page={p}
                disabled={disabled}
                onEdit={() => setEditing(p)}
                onToggle={() => toggleEnabled(p)}
                onDelete={() => deletePage(p)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Editor overlay */}
      {editing && (
        <PageEditor
          page={editing}
          fields={fields}
          tableSettings={table.settings || {}}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setPages(pages.map((x) => x.id === updated.id ? updated : x));
            setEditing(null);
          }}
          setError={setError}
        />
      )}
    </div>
  );
}

// ─── Page Card ──────────────────────────────────────────────────────────────
function PageCard({
  page, disabled, onEdit, onToggle, onDelete,
}: {
  page: BookingPage;
  disabled: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/book/${page.slug}`
    : `/book/${page.slug}`;

  function copyUrl() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Working days summary
  const enabledDays = (page.working_hours || [])
    .map((wh: any, i: number) => wh.enabled ? HE_DAY_NAMES[i] : null)
    .filter(Boolean);

  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${page.enabled ? 'border-slate-200' : 'border-slate-200 opacity-70'}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
          page.enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
        }`}>
          <Share2 className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium text-slate-900">{page.title}</div>
              {page.description && <div className="text-xs text-slate-500 mt-0.5">{page.description}</div>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={onToggle} disabled={disabled} title={page.enabled ? 'השבת' : 'הפעל'}
                className={`flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-50 ${
                  page.enabled ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}>
                <Power className="h-3.5 w-3.5" />
              </button>
              <button onClick={onEdit} disabled={disabled} title="ערוך"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50">
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              <button onClick={onDelete} disabled={disabled} title="מחק"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* The link box */}
          <div className="mt-3 flex items-stretch gap-1 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
            <code className="flex-1 px-3 py-2 text-xs text-slate-700 font-mono truncate" dir="ltr">
              {url}
            </code>
            <button onClick={copyUrl} title="העתק"
              className="px-3 border-r border-slate-200 hover:bg-slate-100 text-slate-600">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
            <a href={url} target="_blank" rel="noopener" title="פתח בכרטיסיה חדשה"
              className="px-3 border-r border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center">
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          {/* Stats */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {page.duration_minutes} דק׳
            </span>
            <span className="inline-flex items-center gap-1">
              <CalIcon className="h-3 w-3" /> {enabledDays.length} ימים בשבוע
            </span>
            {page.view_count > 0 && (
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" /> {page.view_count} צפיות
              </span>
            )}
            {page.booking_count > 0 && (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <BookOpen className="h-3 w-3" /> {page.booking_count} פגישות נקבעו
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page Editor ────────────────────────────────────────────────────────────
function PageEditor({
  page, fields, tableSettings, onClose, onSaved, setError,
}: {
  page: BookingPage;
  fields: FieldData[];
  tableSettings: any;
  onClose: () => void;
  onSaved: (p: BookingPage) => void;
  setError: (m: string | null) => void;
}) {
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [description, setDescription] = useState(page.description || '');
  const [duration, setDuration] = useState(page.duration_minutes);
  const [buffer, setBuffer] = useState(page.buffer_minutes);
  const [advanceNotice, setAdvanceNotice] = useState(page.advance_notice_days);
  const [minLead, setMinLead] = useState(page.min_lead_time_hours);
  const [confMsg, setConfMsg] = useState(page.confirmation_message || '');
  const [workingHours, setWorkingHours] = useState<any[]>(page.working_hours || []);
  const [mapping, setMapping] = useState<Record<string, string>>(page.field_mapping || {});
  const [saving, setSaving] = useState(false);

  const datetimeFields = fields.filter((f) => f.type === 'datetime' || f.type === 'date');
  const phoneFields = fields.filter((f) => f.type === 'phone' || f.slug.toLowerCase().includes('phone') || f.slug.includes('טלפון'));
  const textFields = fields.filter((f) => f.type === 'text' || f.type === 'string');
  const allFields = fields;

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const body: any = {
        title, slug, description,
        duration_minutes: duration,
        buffer_minutes: buffer,
        advance_notice_days: advanceNotice,
        min_lead_time_hours: minLead,
        confirmation_message: confMsg,
        working_hours: workingHours,
        field_mapping: mapping,
      };
      const res = await fetch(`/api/booking-pages/${page.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onSaved(d.page);
    } catch (e: any) {
      setError(e?.message || 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  }

  function setDay(i: number, patch: Partial<{ enabled: boolean; start: string; end: string }>) {
    const next = [...workingHours];
    next[i] = { ...next[i], ...patch };
    setWorkingHours(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-slate-900">עריכת לינק שיתוף</h3>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Basic */}
          <Section title="פרטי הלינק">
            <Field label="כותרת" hint="מוצג בראש הדף הציבורי">
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500" />
            </Field>

            <Field label="כתובת הלינק (slug)" hint="האותיות שיופיעו ב-URL: /book/your-slug. רק אותיות אנגליות, מספרים ומקפים.">
              <div className="flex items-stretch rounded-lg border border-slate-300 overflow-hidden">
                <span className="px-3 py-2 text-sm text-slate-500 bg-slate-50 border-l border-slate-300 font-mono" dir="ltr">/book/</span>
                <input value={slug} onChange={(e) => setSlug(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm font-mono focus:outline-none" dir="ltr" />
              </div>
            </Field>

            <Field label="תיאור (אופציונלי)" hint="מוצג מתחת לכותרת">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 resize-none" />
            </Field>
          </Section>

          {/* Duration */}
          <Section title="משך וזמינות">
            <div className="grid grid-cols-2 gap-3">
              <Field label="משך פגישה (דק׳)">
                <input type="number" min="5" max="480" value={duration} onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </Field>
              <Field label="הפסקה בין פגישות (דק׳)">
                <input type="number" min="0" max="120" value={buffer} onChange={(e) => setBuffer(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </Field>
              <Field label="עד כמה ימים קדימה">
                <input type="number" min="1" max="365" value={advanceNotice} onChange={(e) => setAdvanceNotice(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </Field>
              <Field label="זמן מינימלי לפני (שעות)">
                <input type="number" min="0" max="168" value={minLead} onChange={(e) => setMinLead(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </Field>
            </div>
          </Section>

          {/* Working hours */}
          <Section title="שעות עבודה">
            <div className="space-y-2">
              {workingHours.map((wh: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <label className="flex items-center gap-2 w-24 cursor-pointer">
                    <input type="checkbox" checked={wh.enabled} onChange={(e) => setDay(i, { enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                    <span className="text-sm text-slate-700">יום {HE_DAY_NAMES[i]}</span>
                  </label>
                  <input type="time" value={wh.start} disabled={!wh.enabled} onChange={(e) => setDay(i, { start: e.target.value })}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-400" />
                  <span className="text-slate-400">—</span>
                  <input type="time" value={wh.end} disabled={!wh.enabled} onChange={(e) => setDay(i, { end: e.target.value })}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-400" />
                </div>
              ))}
            </div>
          </Section>

          {/* Field mapping */}
          <Section title="קישור לשדות הטבלה" description="אילו שדות בטבלה ימולאו מנתוני המבקר">
            <Field label="שדה תאריך/שעה (חובה)" hint="לכאן תיכנס השעה שהמבקר בחר">
              <select value={mapping.datetime_field_slug || ''} onChange={(e) => setMapping({ ...mapping, datetime_field_slug: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
                <option value="">— בחר שדה —</option>
                {datetimeFields.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}
              </select>
            </Field>

            <Field label="שדה כותרת (אופציונלי)" hint="ייווצר אוטומטית: 'הכותרת של הלינק — שם המבקר'">
              <select value={mapping.title_field_slug || ''} onChange={(e) => setMapping({ ...mapping, title_field_slug: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
                <option value="">— ללא —</option>
                {textFields.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}
              </select>
            </Field>

            <Field label="שדה שם המבקר">
              <select value={mapping.name_field_slug || ''} onChange={(e) => setMapping({ ...mapping, name_field_slug: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
                <option value="">— ללא —</option>
                {textFields.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}
              </select>
            </Field>

            <Field label="שדה טלפון (לתזכורות WhatsApp)">
              <select value={mapping.phone_field_slug || ''} onChange={(e) => setMapping({ ...mapping, phone_field_slug: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
                <option value="">— ללא —</option>
                {phoneFields.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}
              </select>
            </Field>

            <Field label="שדה הערות">
              <select value={mapping.notes_field_slug || ''} onChange={(e) => setMapping({ ...mapping, notes_field_slug: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white">
                <option value="">— ללא —</option>
                {allFields.filter((f) => f.type === 'text' || f.type === 'string' || f.type === 'longtext').map((f) =>
                  <option key={f.slug} value={f.slug}>{f.name}</option>
                )}
              </select>
            </Field>
          </Section>

          {/* Confirmation message */}
          <Section title="הודעת אישור">
            <Field label="טקסט שהמבקר רואה אחרי הקביעה">
              <textarea value={confMsg} onChange={(e) => setConfMsg(e.target.value)} rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 resize-none" />
            </Field>
          </Section>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 sticky bottom-0 bg-white">
          <a href={`/book/${page.slug}`} target="_blank" rel="noopener"
            className="inline-flex items-center gap-1 text-sm text-violet-600 hover:text-violet-800">
            <Eye className="h-3.5 w-3.5" />
            תצוגה מקדימה
          </a>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">בטל</button>
            <button onClick={save} disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              שמור
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="py-12 flex justify-center">{children}</div>;
}
