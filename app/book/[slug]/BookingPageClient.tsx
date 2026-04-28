'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, ChevronRight, ChevronLeft, Loader2, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';

type FormField = {
  key: string;
  label: string;
  required: boolean;
  type: 'text' | 'phone' | 'email' | 'textarea';
};

type Page = {
  slug: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  form_fields: FormField[];
  confirmation_message: string | null;
};

type Slot = { iso: string; label: string };

type Step = 'date' | 'time' | 'form' | 'confirmed';

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HE_DAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export default function BookingPageClient({ page }: { page: Page }) {
  const [step, setStep] = useState<Step>('date');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available dates on mount
  useEffect(() => {
    fetch(`/api/bookings/${page.slug}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setAvailableDates(d.available_dates || []);
      })
      .catch((e) => setError(e?.message))
      .finally(() => setLoading(false));
  }, [page.slug]);

  // When date selected, load slots
  const loadSlots = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${page.slug}?date=${date}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setSlots(d.slots || []);
    } catch (e: any) {
      setError(e?.message || 'שגיאה בטעינת זמנים');
    } finally {
      setLoading(false);
    }
  }, [page.slug]);

  function pickDate(date: string) {
    setSelectedDate(date);
    setStep('time');
    loadSlots(date);
  }

  function pickSlot(slot: Slot) {
    setSelectedSlot(slot);
    setStep('form');
  }

  async function submit() {
    setError(null);
    // Validate required
    for (const f of page.form_fields) {
      if (f.required && !String(formData[f.key] || '').trim()) {
        setError(`חסר: ${f.label}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/bookings/${page.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selected_at: selectedSlot!.iso,
          form_data: formData,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'שגיאה');
      setStep('confirmed');
    } catch (e: any) {
      setError(e?.message || 'שגיאה בשליחה');
    } finally {
      setSubmitting(false);
    }
  }

  // ───────── Render ─────────
  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50">
      <div className="mx-auto max-w-2xl px-4 py-6 md:py-12">
        {/* Header */}
        <header className="mb-6 md:mb-10 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{page.title}</h1>
          {page.description && (
            <p className="mt-2 text-slate-600 max-w-md mx-auto">{page.description}</p>
          )}
          <div className="mt-3 inline-flex items-center gap-1.5 text-sm text-violet-700 bg-violet-100 px-3 py-1 rounded-full">
            <Clock className="h-3.5 w-3.5" />
            {page.duration_minutes} דקות
          </div>
        </header>

        {/* Steps indicator */}
        {step !== 'confirmed' && <StepsBar step={step} />}

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        {/* Step content */}
        <main className="rounded-2xl bg-white shadow-sm border border-slate-100 p-4 md:p-6">
          {step === 'date' && (
            <DateStep
              loading={loading}
              calendarMonth={calendarMonth}
              setCalendarMonth={setCalendarMonth}
              availableDates={availableDates}
              onPick={pickDate}
            />
          )}

          {step === 'time' && selectedDate && (
            <TimeStep
              loading={loading}
              date={selectedDate}
              slots={slots}
              onPick={pickSlot}
              onBack={() => setStep('date')}
            />
          )}

          {step === 'form' && selectedSlot && selectedDate && (
            <FormStep
              page={page}
              selectedDate={selectedDate}
              selectedSlot={selectedSlot}
              formData={formData}
              setFormData={setFormData}
              submitting={submitting}
              onSubmit={submit}
              onBack={() => setStep('time')}
            />
          )}

          {step === 'confirmed' && (
            <ConfirmedStep
              page={page}
              selectedDate={selectedDate!}
              selectedSlot={selectedSlot!}
              formData={formData}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="mt-6 text-center text-xs text-slate-400">
          מופעל על ידי{' '}
          <a href="https://taskflow-ai.com" target="_blank" rel="noopener" className="font-medium hover:text-violet-600">
            TaskFlow AI
          </a>
        </footer>
      </div>
    </div>
  );
}

// ─── Steps Bar ──────────────────────────────────────────────────────────────
function StepsBar({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'date', label: 'בחר תאריך' },
    { id: 'time', label: 'בחר שעה' },
    { id: 'form', label: 'פרטים' },
  ];
  const currentIdx = steps.findIndex((s) => s.id === step);
  return (
    <div className="mb-4 flex items-center justify-center gap-2">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2">
          <div className={`h-7 px-2.5 rounded-full text-xs font-medium flex items-center gap-1 ${
            i === currentIdx ? 'bg-violet-600 text-white'
              : i < currentIdx ? 'bg-violet-100 text-violet-700'
              : 'bg-slate-100 text-slate-500'
          }`}>
            <span className="w-4 h-4 rounded-full bg-white/30 inline-flex items-center justify-center text-[10px] font-bold">
              {i + 1}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < steps.length - 1 && <div className="w-3 h-px bg-slate-300" />}
        </div>
      ))}
    </div>
  );
}

// ─── Date Step ──────────────────────────────────────────────────────────────
function DateStep({
  loading, calendarMonth, setCalendarMonth, availableDates, onPick,
}: {
  loading: boolean;
  calendarMonth: Date;
  setCalendarMonth: (d: Date) => void;
  availableDates: string[];
  onPick: (date: string) => void;
}) {
  if (loading) return <Center><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></Center>;
  if (availableDates.length === 0) return <Center><p className="text-slate-500">אין תאריכים פנויים בקרוב</p></Center>;

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const availableSet = new Set(availableDates);
  const today = isoDate(new Date());

  // Build the calendar grid (start with offset cells before day 1)
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  const monthStr = `${HE_MONTHS[month]} ${year}`;
  const minMonth = new Date();
  const isMinMonth = year === minMonth.getFullYear() && month === minMonth.getMonth();

  return (
    <div>
      <h2 className="mb-3 font-semibold text-slate-900 flex items-center gap-2">
        <Calendar className="h-4 w-4 text-violet-600" />
        בחר תאריך
      </h2>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
          disabled={isMinMonth}
          className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30"
          aria-label="חודש קודם"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="font-semibold text-slate-900">{monthStr}</div>
        <button
          onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
          className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 hover:bg-slate-50"
          aria-label="חודש הבא"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1 text-center text-xs text-slate-500 font-medium">
        {HE_DAYS_SHORT.map((d) => <div key={d}>{d}</div>)}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
          const isAvail = availableSet.has(dateStr);
          const isToday = dateStr === today;
          return (
            <button
              key={i}
              onClick={() => isAvail && onPick(dateStr)}
              disabled={!isAvail}
              className={`aspect-square rounded-lg text-sm font-medium transition relative ${
                !isAvail
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'bg-violet-50 text-violet-800 hover:bg-violet-600 hover:text-white cursor-pointer'
              } ${isToday ? 'ring-2 ring-violet-400 ring-offset-1' : ''}`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Time Step ──────────────────────────────────────────────────────────────
function TimeStep({
  loading, date, slots, onPick, onBack,
}: {
  loading: boolean;
  date: string;
  slots: Slot[];
  onPick: (s: Slot) => void;
  onBack: () => void;
}) {
  const dateLabel = formatDateHe(date);

  return (
    <div>
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-violet-600 hover:text-violet-800">
        <ArrowRight className="h-3.5 w-3.5" />
        בחר תאריך אחר
      </button>

      <h2 className="mb-3 font-semibold text-slate-900 flex items-center gap-2">
        <Clock className="h-4 w-4 text-violet-600" />
        בחר שעה — {dateLabel}
      </h2>

      {loading ? (
        <Center><Loader2 className="h-6 w-6 animate-spin text-violet-500" /></Center>
      ) : slots.length === 0 ? (
        <Center><p className="text-slate-500">אין זמנים פנויים ביום זה</p></Center>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {slots.map((s) => (
            <button
              key={s.iso}
              onClick={() => onPick(s)}
              className="rounded-lg border border-violet-200 bg-white py-2 text-sm font-medium text-violet-800 hover:bg-violet-600 hover:text-white hover:border-violet-600 transition"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Form Step ──────────────────────────────────────────────────────────────
function FormStep({
  page, selectedDate, selectedSlot, formData, setFormData, submitting, onSubmit, onBack,
}: {
  page: Page;
  selectedDate: string;
  selectedSlot: Slot;
  formData: Record<string, string>;
  setFormData: (d: Record<string, string>) => void;
  submitting: boolean;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const dateLabel = formatDateHe(selectedDate);

  return (
    <div>
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-violet-600 hover:text-violet-800">
        <ArrowRight className="h-3.5 w-3.5" />
        בחר שעה אחרת
      </button>

      <div className="mb-4 rounded-lg bg-violet-50 border border-violet-200 px-3 py-2 text-sm text-violet-900">
        <div className="font-semibold">{dateLabel}</div>
        <div className="text-xs">{selectedSlot.label} · {page.duration_minutes} דק׳</div>
      </div>

      <h2 className="mb-3 font-semibold text-slate-900">פרטיך</h2>

      <div className="space-y-3">
        {page.form_fields.map((f) => (
          <div key={f.key}>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {f.label}
              {f.required && <span className="text-rose-500 mr-1">*</span>}
            </label>
            {f.type === 'textarea' ? (
              <textarea
                value={formData[f.key] || ''}
                onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 resize-none"
              />
            ) : (
              <input
                type={f.type === 'phone' ? 'tel' : f.type === 'email' ? 'email' : 'text'}
                value={formData[f.key] || ''}
                onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                dir={f.type === 'phone' || f.type === 'email' ? 'ltr' : 'rtl'}
              />
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onSubmit}
        disabled={submitting}
        className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        אשר את הפגישה
      </button>
    </div>
  );
}

// ─── Confirmed Step ─────────────────────────────────────────────────────────
function ConfirmedStep({
  page, selectedDate, selectedSlot, formData,
}: {
  page: Page;
  selectedDate: string;
  selectedSlot: Slot;
  formData: Record<string, string>;
}) {
  return (
    <div className="text-center py-4">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">הפגישה אושרה!</h2>
      <p className="text-slate-600 mb-4">
        {page.confirmation_message || 'נשלח אליך אישור.'}
      </p>

      <div className="inline-block rounded-xl bg-violet-50 border border-violet-200 px-5 py-3 text-right">
        <div className="text-sm text-violet-700 font-medium">{page.title}</div>
        <div className="text-lg font-bold text-violet-900 mt-1">{formatDateHe(selectedDate)}</div>
        <div className="text-sm text-violet-700">{selectedSlot.label} · {page.duration_minutes} דק׳</div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, '0'); }
function isoDate(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function formatDateHe(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `יום ${HE_DAYS[date.getDay()]}, ${d} ב${HE_MONTHS[m - 1]}`;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="py-12 flex justify-center">{children}</div>;
}
