'use client';

/**
 * Renders a public form based on its schema.
 *
 * Why client-side?
 *   - Conditional logic (show/hide fields based on other answers)
 *   - Multi-step navigation
 *   - localStorage draft persistence
 *   - All inputs need to be controlled
 *
 * The server passes a snapshot of:
 *   - form: full FormRow including theme, branding, field_settings
 *   - fields: the list of Field rows for this table that are exposed
 *
 * We never refetch on the client — if the schema changes, the user reloads.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Lock,
  Loader2,
  Sparkles,
  Star,
} from 'lucide-react';
import type { FormRow, FormSection } from '@/lib/forms/types';
import { isFieldVisible } from '@/lib/forms/types';

type Field = {
  id: string;
  name: string;
  slug: string;
  type: string;
  is_required: boolean;
  is_primary: boolean;
  position: number | null;
  config: any;
};

type Props = {
  form: FormRow;
  fields: Field[];
  isClosed?: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

// ----------------------------------------------------------------------------
// Theme palettes (mirrors the diagnostic page when 'cream' is selected)
// ----------------------------------------------------------------------------

const THEMES: Record<
  string,
  {
    bg: string;
    ink: string;
    accent: string;
    accentText: string;
    cardBg: string;
    border: string;
    headerBg: string;
    primaryBtn: string;
    secondaryBtn: string;
  }
> = {
  cream: {
    bg: 'bg-[#FBF8F3]',
    ink: 'text-slate-900',
    accent: 'bg-amber-500',
    accentText: 'text-amber-600',
    cardBg: 'bg-white',
    border: 'border-slate-200/80',
    headerBg: 'bg-[#FBF8F3]/80',
    primaryBtn: 'bg-slate-900 hover:bg-slate-800 text-white',
    secondaryBtn: 'text-slate-600 hover:bg-slate-100',
  },
  purple: {
    bg: 'bg-gradient-to-b from-purple-50 to-white',
    ink: 'text-gray-900',
    accent: 'bg-purple-600',
    accentText: 'text-purple-600',
    cardBg: 'bg-white',
    border: 'border-gray-200',
    headerBg: 'bg-white/80',
    primaryBtn: 'bg-purple-600 hover:bg-purple-700 text-white',
    secondaryBtn: 'text-gray-600 hover:bg-gray-100',
  },
  dark: {
    bg: 'bg-slate-950',
    ink: 'text-slate-100',
    accent: 'bg-cyan-500',
    accentText: 'text-cyan-400',
    cardBg: 'bg-slate-900',
    border: 'border-slate-800',
    headerBg: 'bg-slate-950/80',
    primaryBtn: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950',
    secondaryBtn: 'text-slate-400 hover:bg-slate-800',
  },
  minimal: {
    bg: 'bg-white',
    ink: 'text-gray-900',
    accent: 'bg-gray-900',
    accentText: 'text-gray-900',
    cardBg: 'bg-gray-50',
    border: 'border-gray-200',
    headerBg: 'bg-white/80',
    primaryBtn: 'bg-gray-900 hover:bg-gray-800 text-white',
    secondaryBtn: 'text-gray-600 hover:bg-gray-100',
  },
};

// ============================================================================
// Main component
// ============================================================================
export default function PublicFormClient({
  form,
  fields,
  isClosed,
  utmSource,
  utmMedium,
  utmCampaign,
}: Props) {
  const theme = THEMES[form.theme] ?? THEMES.cream;
  const storageKey = `taskflow.form.${form.id}.draft.v1`;

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactName, setContactName] = useState('');
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [didSubmit, setDidSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // --- Restore draft ---
  useEffect(() => {
    if (typeof window === 'undefined' || !form.allow_multiple_submissions) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setAnswers(parsed.answers ?? {});
        setContactPhone(parsed.contactPhone ?? '');
        setContactEmail(parsed.contactEmail ?? '');
        setContactName(parsed.contactName ?? '');
        if (parsed.submissionId) setSubmissionId(parsed.submissionId);
      }
    } catch {}
  }, [storageKey, form.allow_multiple_submissions]);

  // --- Persist locally ---
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ answers, contactPhone, contactEmail, contactName, submissionId }),
      );
    } catch {}
  }, [answers, contactPhone, contactEmail, contactName, submissionId, storageKey]);

  // --- Sections setup ---
  const sections = useMemo(() => {
    const s = [...(form.sections ?? [])].sort((a, b) => a.position - b.position);
    if (s.length === 0) {
      // Single virtual section containing everything
      return [
        {
          id: '__all__',
          title: '',
          description: '',
          position: 0,
        } as FormSection,
      ];
    }
    return s;
  }, [form.sections]);

  // Group fields by section
  const fieldsBySection = useMemo(() => {
    const grouped = new Map<string, Field[]>();
    for (const section of sections) {
      grouped.set(section.id, []);
    }

    for (const f of fields) {
      const settings = form.field_settings[f.id];
      const sectionId = settings?.section_id ?? sections[0].id;
      const target = grouped.get(sectionId) ?? grouped.get(sections[0].id)!;
      target.push(f);
    }

    // Sort each section's fields
    for (const [, arr] of grouped) {
      arr.sort((a, b) => {
        const ap = form.field_settings[a.id]?.position ?? a.position ?? 999;
        const bp = form.field_settings[b.id]?.position ?? b.position ?? 999;
        return ap - bp;
      });
    }
    return grouped;
  }, [fields, sections, form.field_settings]);

  // For conditional rule evaluation, we keep a quick lookup
  const fieldsByKey = useMemo(() => {
    const m = new Map<string, { id: string; type: string }>();
    fields.forEach((f) => m.set(f.id, { id: f.id, type: f.type }));
    return m;
  }, [fields]);

  const TOTAL_STEPS = 1 + sections.length + 1; // hero + sections + contact/submit
  const isHero = step === 0;
  const isContactStep = step === TOTAL_STEPS - 1;
  const currentSection = !isHero && !isContactStep ? sections[step - 1] : null;

  const handleNext = () => {
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handlePrev = () => {
    setStep((s) => Math.max(0, s - 1));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateAnswer = (fieldId: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/forms/${form.slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submissionId,
          answers,
          contact_phone: contactPhone || null,
          contact_email: contactEmail || null,
          contact_name: contactName || null,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(
          data.message ?? data.error ?? 'שליחה נכשלה. נסה שוב או צור איתנו קשר.',
        );
        return;
      }

      setDidSubmit(true);
      try {
        window.localStorage.removeItem(storageKey);
      } catch {}

      // Optional redirect
      if (form.success_redirect_url) {
        setTimeout(() => {
          window.location.href = form.success_redirect_url!;
        }, 2000);
      }
    } catch {
      setSubmitError('שגיאת רשת. נסה שוב.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Render closed state ----
  if (isClosed) {
    return (
      <div dir="rtl" className={`min-h-screen ${theme.bg} ${theme.ink}`}>
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-6">
            <Lock className="w-7 h-7 text-slate-600" />
          </div>
          <h1 className="text-3xl font-bold mb-3">השאלון סגור</h1>
          <p className="text-slate-600">השאלון הזה אינו מקבל יותר תגובות.</p>
        </div>
      </div>
    );
  }

  if (didSubmit) {
    return (
      <div dir="rtl" className={`min-h-screen ${theme.bg} ${theme.ink}`}>
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 mb-8">
            <CheckCircle2 className="w-10 h-10 text-amber-600" />
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            {form.thank_you_title}
          </h1>
          {form.thank_you_message && (
            <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-xl mx-auto">
              {form.thank_you_message}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className={`min-h-screen ${theme.bg} ${theme.ink}`}>
      {/* Header */}
      <header className={`relative z-10 border-b ${theme.border} ${theme.headerBg} backdrop-blur sticky top-0`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {form.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logo_url} alt="" className="h-8 w-auto object-contain" />
            )}
            <div className="font-bold tracking-tight">{form.title}</div>
          </div>
          {!isHero && form.show_progress_bar && (
            <div className="text-xs sm:text-sm text-slate-500 font-medium">
              שלב <span className="font-bold">{step}</span> מתוך {TOTAL_STEPS - 1}
            </div>
          )}
        </div>
        {!isHero && form.show_progress_bar && (
          <div className="h-1 bg-slate-200/60 overflow-hidden">
            <div
              className={`h-full ${theme.accent} transition-all duration-500 ease-out`}
              style={{ width: `${(step / (TOTAL_STEPS - 1)) * 100}%` }}
            />
          </div>
        )}
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
        {isHero ? (
          <HeroStep form={form} theme={theme} onStart={handleNext} />
        ) : isContactStep ? (
          <ContactStep
            form={form}
            theme={theme}
            contactName={contactName}
            setContactName={setContactName}
            contactPhone={contactPhone}
            setContactPhone={setContactPhone}
            contactEmail={contactEmail}
            setContactEmail={setContactEmail}
            onPrev={handlePrev}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitError={submitError}
          />
        ) : (
          <SectionStep
            section={currentSection!}
            fields={fieldsBySection.get(currentSection!.id) ?? []}
            answers={answers}
            updateAnswer={updateAnswer}
            theme={theme}
            fieldSettings={form.field_settings}
            fieldsByKey={fieldsByKey}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        )}
      </main>

      <footer className={`relative z-10 border-t ${theme.border} mt-16`}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-slate-500">
          Powered by <a href="https://taskflow-ai.com" className="hover:underline">TaskFlow AI</a>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// Hero step
// ============================================================================
function HeroStep({
  form,
  theme,
  onStart,
}: {
  form: FormRow;
  theme: typeof THEMES.cream;
  onStart: () => void;
}) {
  return (
    <div className="text-center max-w-2xl mx-auto pt-8 pb-12">
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.1] mb-6">
        {form.hero_title ?? form.title}
      </h1>
      {form.hero_subtitle && (
        <p className="text-lg sm:text-xl text-slate-600 leading-relaxed mb-10">
          {form.hero_subtitle}
        </p>
      )}
      <button
        onClick={onStart}
        className={`group inline-flex items-center gap-2 px-7 py-4 ${theme.primaryBtn} rounded-xl text-base font-bold transition shadow-lg`}
      >
        {form.cta_label}
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition" />
      </button>
    </div>
  );
}

// ============================================================================
// Section step (one per form section)
// ============================================================================
function SectionStep({
  section,
  fields,
  answers,
  updateAnswer,
  theme,
  fieldSettings,
  fieldsByKey,
  onPrev,
  onNext,
}: {
  section: FormSection;
  fields: Field[];
  answers: Record<string, any>;
  updateAnswer: (fieldId: string, value: any) => void;
  theme: typeof THEMES.cream;
  fieldSettings: Record<string, any>;
  fieldsByKey: Map<string, { id: string; type: string }>;
  onPrev: () => void;
  onNext: () => void;
}) {
  // Filter fields by conditional visibility (live)
  const visibleFields = fields.filter((f) =>
    isFieldVisible(f.id, fieldSettings, answers, fieldsByKey),
  );

  return (
    <div className="max-w-3xl mx-auto">
      {section.title && (
        <div className="mb-8">
          <h2 className="text-3xl sm:text-4xl font-black leading-tight mb-3">
            {section.title}
          </h2>
          {section.description && (
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              {section.description}
            </p>
          )}
        </div>
      )}

      <div className={`${theme.cardBg} border ${theme.border} rounded-2xl p-6 sm:p-8 shadow-sm`}>
        <div className="space-y-6">
          {visibleFields.map((f) => (
            <FieldRenderer
              key={f.id}
              field={f}
              settings={fieldSettings[f.id]}
              value={answers[f.id]}
              onChange={(v) => updateAnswer(f.id, v)}
              theme={theme}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={onPrev}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm rounded-lg transition font-medium ${theme.secondaryBtn}`}
        >
          <ArrowRight className="w-4 h-4" />
          חזור
        </button>
        <button
          onClick={onNext}
          className={`group inline-flex items-center gap-2 px-6 py-3 ${theme.primaryBtn} rounded-xl text-sm font-bold transition shadow-md`}
        >
          המשך
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Contact + submit step
// ============================================================================
function ContactStep({
  form,
  theme,
  contactName,
  setContactName,
  contactPhone,
  setContactPhone,
  contactEmail,
  setContactEmail,
  onPrev,
  onSubmit,
  isSubmitting,
  submitError,
}: {
  form: FormRow;
  theme: typeof THEMES.cream;
  contactName: string;
  setContactName: (v: string) => void;
  contactPhone: string;
  setContactPhone: (v: string) => void;
  contactEmail: string;
  setContactEmail: (v: string) => void;
  onPrev: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  submitError: string | null;
}) {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl sm:text-4xl font-black leading-tight mb-3">פרטי קשר</h2>
        <p className="text-base sm:text-lg text-slate-600">
          איך נחזור אליך?
        </p>
      </div>

      <div className={`${theme.cardBg} border ${theme.border} rounded-2xl p-6 sm:p-8 shadow-sm space-y-4`}>
        <div>
          <label className="block text-sm font-semibold mb-1.5">שם מלא</label>
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1.5">
            טלפון{form.require_phone && <span className="text-red-500"> *</span>}
          </label>
          <input
            type="tel"
            dir="ltr"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="050-0000000"
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1.5">
            אימייל{form.require_email && <span className="text-red-500"> *</span>}
          </label>
          <input
            type="email"
            dir="ltr"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="name@company.com"
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
          />
        </div>
      </div>

      {submitError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {submitError}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={onPrev}
          className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm rounded-lg transition font-medium ${theme.secondaryBtn}`}
          disabled={isSubmitting}
        >
          <ArrowRight className="w-4 h-4" />
          חזור
        </button>
        <button
          onClick={onSubmit}
          disabled={
            isSubmitting ||
            (form.require_phone && !contactPhone) ||
            (form.require_email && !contactEmail)
          }
          className={`inline-flex items-center gap-2 px-6 py-3 ${theme.primaryBtn} rounded-xl text-sm font-bold transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              שולח...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              שלח
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Field renderer - dispatches by field.type
// ============================================================================
function FieldRenderer({
  field,
  settings,
  value,
  onChange,
  theme,
}: {
  field: Field;
  settings: any;
  value: any;
  onChange: (v: any) => void;
  theme: typeof THEMES.cream;
}) {
  const label = settings?.label_override || field.name;
  const placeholder = settings?.placeholder || '';
  const helpText = settings?.help_text;
  const required = settings?.required_override ?? field.is_required;

  // Some field types render their own label inline (scale, checkbox).
  // Others get a standard label header.
  const showStandardLabel = !['checkbox', 'rating'].includes(field.type);

  return (
    <div>
      {showStandardLabel && (
        <label className="block text-sm font-semibold mb-1.5">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}

      {(() => {
        switch (field.type) {
          case 'text':
          case 'url':
            return (
              <input
                type={field.type === 'url' ? 'url' : 'text'}
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
                dir={field.type === 'url' ? 'ltr' : undefined}
              />
            );

          case 'email':
            return (
              <input
                type="email"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                dir="ltr"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
              />
            );

          case 'phone':
            return (
              <input
                type="tel"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || '050-0000000'}
                dir="ltr"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
              />
            );

          case 'number':
          case 'currency':
            return (
              <input
                type="number"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
                placeholder={placeholder}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
              />
            );

          case 'longtext':
            return (
              <textarea
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={4}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition resize-none"
              />
            );

          case 'date':
            return (
              <input
                type="date"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
              />
            );

          case 'datetime':
            return (
              <input
                type="datetime-local"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
              />
            );

          case 'select':
          case 'status': {
            const options = field.config?.options ?? [];
            return (
              <div className="flex flex-wrap gap-2">
                {options.map((opt: any) => {
                  const optValue = opt.value ?? opt.label ?? opt;
                  const optLabel = opt.label ?? opt.value ?? opt;
                  return (
                    <button
                      key={optValue}
                      type="button"
                      onClick={() => onChange(optValue)}
                      className={`px-4 py-2 text-sm rounded-lg border transition ${
                        value === optValue
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {optLabel}
                    </button>
                  );
                })}
              </div>
            );
          }

          case 'multiselect': {
            const options = field.config?.options ?? [];
            const current = Array.isArray(value) ? value : [];
            return (
              <div className="flex flex-wrap gap-2">
                {options.map((opt: any) => {
                  const optValue = opt.value ?? opt.label ?? opt;
                  const optLabel = opt.label ?? opt.value ?? opt;
                  const selected = current.includes(optValue);
                  return (
                    <button
                      key={optValue}
                      type="button"
                      onClick={() => {
                        if (selected) {
                          onChange(current.filter((v: any) => v !== optValue));
                        } else {
                          onChange([...current, optValue]);
                        }
                      }}
                      className={`px-4 py-2 text-sm rounded-lg border transition ${
                        selected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      {optLabel}
                    </button>
                  );
                })}
              </div>
            );
          }

          case 'checkbox':
            return (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!value}
                  onChange={(e) => onChange(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm">
                  {label}
                  {required && <span className="text-red-500"> *</span>}
                </span>
              </label>
            );

          case 'rating': {
            const max = field.config?.max ?? 5;
            return (
              <div>
                <div className="mb-2 text-sm font-semibold">
                  {label}
                  {required && <span className="text-red-500"> *</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: max }).map((_, i) => {
                    const n = i + 1;
                    const filled = (value ?? 0) >= n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => onChange(n)}
                        className={`transition ${filled ? 'text-amber-500' : 'text-slate-300'} hover:text-amber-400`}
                      >
                        <Star className="w-7 h-7" fill={filled ? 'currentColor' : 'none'} />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }

          case 'city':
            return (
              <input
                type="text"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || 'עיר'}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
              />
            );

          default:
            return (
              <div className="text-xs text-red-500">
                שדה מסוג &ldquo;{field.type}&rdquo; אינו נתמך עדיין.
              </div>
            );
        }
      })()}

      {helpText && (
        <p className="mt-1.5 text-xs text-slate-500">{helpText}</p>
      )}
    </div>
  );
}
