'use client';

/**
 * Diagnostic survey landing page.
 *
 * Design direction: editorial/refined with a construction-industry feel.
 * - Warm neutrals (cream/ivory backgrounds) instead of the usual SaaS white
 * - Deep slate ink with single accent color (warm orange — the construction
 *   safety jacket / blueprint marker hue) — distinct from the rest of
 *   TaskFlow's purple, signalling this is a focused diagnostic tool
 * - Display serif (Frank Ruhl Libre via Google Fonts CDN, loaded inline)
 *   for headings, default UI sans for body — Hebrew-friendly pairing
 * - 5-step wizard: hero CTA → business details → financial X-ray →
 *   tech & ops → summary. Progress bar at top.
 * - Auto-save on every section transition. Survives accidental reload via
 *   localStorage cache of the draft id.
 *
 * Why a separate page (not inside dashboard)? This is a marketing
 * funnel — visitors land here from outreach. They're not logged in. The
 * tone is salesy/consultative, not utility-software.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Cog,
  HardHat,
  Loader2,
  Sparkles,
  Stethoscope,
  Target,
} from 'lucide-react';

const TOTAL_STEPS = 5; // 0=hero, 1=business, 2=financial, 3=tech, 4=summary
const STORAGE_KEY = 'taskflow.diagnostic.draft.v1';

type FormState = Record<string, string | number>;

type Props = {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
};

export default function DiagnosticClient({ utmSource, utmMedium, utmCampaign }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({});
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [didSubmit, setDidSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ---- Restore draft on mount ----
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.id) setSubmissionId(parsed.id);
        if (parsed.form && typeof parsed.form === 'object') setForm(parsed.form);
      }
    } catch {
      // Ignore — start fresh
    }
  }, []);

  // ---- Persist locally on every change ----
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ id: submissionId, form }),
      );
    } catch {}
  }, [submissionId, form]);

  const updateField = (name: string, value: string | number) => {
    setForm((f) => ({ ...f, [name]: value }));
  };

  // ---- Server save (called on next/prev navigation) ----
  const saveDraft = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/diagnostic/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          id: submissionId,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          ...form,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.id && !submissionId) setSubmissionId(data.id);
      }
    } catch {
      // Silent — user can still navigate, retry on next step
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = async () => {
    // Save quietly in background before moving on
    saveDraft();
    setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    setStep((s) => Math.max(0, s - 1));
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/diagnostic/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          id: submissionId,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          ...form,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSubmitError(
          data.error
            ? `שגיאה: ${data.error}. נסה שוב או צור איתנו קשר.`
            : 'שליחה נכשלה. נסה שוב.',
        );
        return;
      }
      setDidSubmit(true);
      // Clear draft after successful submit
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {}
    } catch {
      setSubmitError('שגיאת רשת. נסה שוב.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#FBF8F3] text-slate-900 selection:bg-amber-200">
      {/* Inline @font-face for serif headings — keeps it self-contained */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700;900&family=Heebo:wght@300;400;500;600;700&display=swap');
        .font-serif-heb {
          font-family: 'Frank Ruhl Libre', 'Heebo', serif;
        }
        .font-sans-heb {
          font-family: 'Heebo', system-ui, sans-serif;
        }
        body {
          font-family: 'Heebo', system-ui, sans-serif;
        }
      `}</style>

      {/* Construction-blueprint grid backdrop */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#0f172a 1px, transparent 1px), linear-gradient(90deg, #0f172a 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Header */}
      <header className="relative z-10 border-b border-slate-200/60 bg-[#FBF8F3]/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <a href="https://taskflow-ai.com" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center transition group-hover:rotate-3">
              <HardHat className="w-5 h-5 text-amber-400" />
            </div>
            <div className="font-serif-heb text-lg font-bold tracking-tight">
              TaskFlow <span className="text-amber-600">·</span> אבחון
            </div>
          </a>
          {step > 0 && !didSubmit && (
            <div className="text-xs sm:text-sm text-slate-500 font-medium">
              שלב <span className="text-slate-900 font-bold">{step}</span> מתוך{' '}
              {TOTAL_STEPS - 1}
            </div>
          )}
        </div>
        {/* Progress bar */}
        {step > 0 && !didSubmit && (
          <div className="h-1 bg-slate-200/60 overflow-hidden">
            <div
              className="h-full bg-gradient-to-l from-amber-500 to-amber-600 transition-all duration-500 ease-out"
              style={{ width: `${(step / (TOTAL_STEPS - 1)) * 100}%` }}
            />
          </div>
        )}
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
        {didSubmit ? (
          <ThankYouScreen />
        ) : step === 0 ? (
          <HeroStep onStart={() => setStep(1)} />
        ) : (
          <FormStep
            step={step}
            form={form}
            updateField={updateField}
            onPrev={handlePrev}
            onNext={handleNext}
            onSubmit={handleFinalSubmit}
            isSaving={isSaving}
            isSubmitting={isSubmitting}
            submitError={submitError}
            isLast={step === TOTAL_STEPS - 1}
          />
        )}
      </main>

      <footer className="relative z-10 border-t border-slate-200/60 mt-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 text-center text-xs text-slate-500">
          © TaskFlow AI · <a href="https://taskflow-ai.com" className="hover:text-slate-900 transition">חזרה לאתר</a> · <a href="/privacy" className="hover:text-slate-900 transition">פרטיות</a>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// Step 0: Hero
// ============================================================================
function HeroStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center max-w-3xl mx-auto pt-8 pb-12">
      {/* Eyebrow */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold uppercase tracking-wider mb-6">
        <ClipboardList className="w-3.5 h-3.5" />
        שאלון מיפוי ראשוני · בנייה ותשתיות
      </div>

      {/* Headline */}
      <h1 className="font-serif-heb text-4xl sm:text-5xl md:text-6xl font-black leading-[1.1] mb-6">
        איפה דולף הכסף
        <br />
        <span className="text-amber-600">ואיפה נשבר התהליך?</span>
      </h1>

      <p className="text-lg sm:text-xl text-slate-600 leading-relaxed mb-10 max-w-2xl mx-auto">
        שני שלבים. עשרים שאלות. בסופן — אבחון מסודר של הנקודות שמדממות לך כסף וזמן בעסק.
        סוגרים את הברזים, בונים את המנוע.
      </p>

      {/* Three pillars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12 text-right">
        <Pillar
          icon={<Stethoscope className="w-5 h-5" />}
          title="רנטגן פיננסי"
          text="תזרים, תשלומים, רווחיות, חשיפות וביטוחים — כל מה שלא רואים מהמסך."
        />
        <Pillar
          icon={<Cog className="w-5 h-5" />}
          title="סיסטם עבודה"
          text="התוכנות, התהליכים, ההצעות מחיר, והחומר שגוזל זמן מהשטח."
        />
        <Pillar
          icon={<Target className="w-5 h-5" />}
          title="תוכנית פעולה"
          text="שלוש נקודות שצריך לטפל בהן ראשונות — לפי תקציב ולוחות זמנים שלך."
        />
      </div>

      {/* CTA */}
      <button
        onClick={onStart}
        className="group inline-flex items-center gap-2 px-7 py-4 bg-slate-900 text-white rounded-xl text-base font-bold hover:bg-slate-800 transition shadow-lg shadow-slate-900/20 hover:shadow-xl"
      >
        בואו נתחיל
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition" />
      </button>

      <div className="mt-6 text-sm text-slate-500">
        ⏱️ זמן מילוי משוער: 12-15 דקות · ניתן לשמור ולחזור
      </div>
    </div>
  );
}

function Pillar({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 hover:border-amber-300 transition">
      <div className="w-10 h-10 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="font-serif-heb font-bold text-lg mb-1">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
    </div>
  );
}

// ============================================================================
// Form step router — delegates to the right section based on `step`
// ============================================================================
function FormStep({
  step,
  form,
  updateField,
  onPrev,
  onNext,
  onSubmit,
  isSaving,
  isSubmitting,
  submitError,
  isLast,
}: {
  step: number;
  form: FormState;
  updateField: (name: string, value: string | number) => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  isSaving: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  isLast: boolean;
}) {
  const sections = [
    null, // step 0 handled separately
    {
      eyebrow: 'שלב 1',
      icon: <Building2 className="w-4 h-4" />,
      title: 'פרטי העסק',
      subtitle: 'נכיר אותך לפני שנצלול. כל השדות אופציונליים — מלא מה שמתאים.',
      content: <SectionBusiness form={form} updateField={updateField} />,
    },
    {
      eyebrow: 'שלב 2 · רנטגן פיננסי',
      icon: <Stethoscope className="w-4 h-4" />,
      title: 'איפה דולף הכסף',
      subtitle: 'תזרים, תשלומים, חשיפות וביטוחים. ענה ביושר — זה לעיניינו בלבד.',
      content: <SectionFinancial form={form} updateField={updateField} />,
    },
    {
      eyebrow: 'שלב 3 · סיסטם עבודה',
      icon: <Cog className="w-4 h-4" />,
      title: 'המערכת שמפעילה את העסק',
      subtitle: 'התהליכים, התוכנות, וההרגלים. גם אם אין סדר — בוא נראה את התמונה.',
      content: <SectionTech form={form} updateField={updateField} />,
    },
    {
      eyebrow: 'שלב 4 · סיכום',
      icon: <Target className="w-4 h-4" />,
      title: 'מה הכי בוער',
      subtitle: 'התכלית של השאלון. מה דחוף, כמה תקציב, ומתי מתחילים.',
      content: <SectionSummary form={form} updateField={updateField} />,
    },
  ];

  const section = sections[step];
  if (!section) return null;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-amber-400 text-xs font-bold uppercase tracking-wider mb-4">
          {section.icon}
          {section.eyebrow}
        </div>
        <h2 className="font-serif-heb text-3xl sm:text-4xl font-black leading-tight mb-3">
          {section.title}
        </h2>
        <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
          {section.subtitle}
        </p>
      </div>

      {/* Body */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm">
        {section.content}
      </div>

      {/* Footer nav */}
      {submitError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {submitError}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-3 flex-wrap">
        <button
          onClick={onPrev}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition font-medium"
        >
          <ArrowRight className="w-4 h-4" />
          חזור
        </button>

        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              שומר...
            </span>
          )}
          {isLast ? (
            <button
              onClick={onSubmit}
              disabled={isSubmitting}
              className="group inline-flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  שולח...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  שלח את האבחון
                </>
              )}
            </button>
          ) : (
            <button
              onClick={onNext}
              className="group inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition shadow-md"
            >
              המשך
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Section: Business details
// ============================================================================
function SectionBusiness({
  form,
  updateField,
}: {
  form: FormState;
  updateField: (name: string, value: string | number) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="שם החברה"
          name="company_name"
          value={form.company_name as string}
          onChange={updateField}
          placeholder="לדוגמה: איתנים השבחת נדל״ן"
        />
        <Input
          label="ח.פ."
          name="company_id"
          value={form.company_id as string}
          onChange={updateField}
          placeholder="9 ספרות"
        />
        <Input
          label="ותק בענף"
          name="years_in_industry"
          value={form.years_in_industry as string}
          onChange={updateField}
          placeholder="כמה שנים?"
        />
        <Input
          label="מס׳ עובדים (משרד + שטח)"
          name="team_size"
          value={form.team_size as string}
          onChange={updateField}
          placeholder="לדוגמה: 5 משרד + 30 שטח"
        />
        <Input
          label="מחזור שנתי משוער"
          name="annual_revenue"
          value={form.annual_revenue as string}
          onChange={updateField}
          placeholder="לדוגמה: 12 מיליון ₪"
        />
        <Input
          label="מס׳ פרויקטים פעילים"
          name="active_projects"
          value={form.active_projects as string}
          onChange={updateField}
          placeholder="כמה פרויקטים רצים בו זמנית?"
        />
      </div>

      <SelectGroup
        label="סוג פעילות"
        name="activity_type"
        value={form.activity_type as string}
        onChange={updateField}
        options={[
          { value: 'residential', label: 'מגורים' },
          { value: 'commercial', label: 'מסחרי' },
          { value: 'infrastructure', label: 'תשתיות' },
          { value: 'renovation', label: 'שיפוצים' },
          { value: 'mixed', label: 'מגוון' },
        ]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
        <Input
          label="איש קשר"
          name="contact_name"
          value={form.contact_name as string}
          onChange={updateField}
          placeholder="שם פרטי + משפחה"
        />
        <Input
          label="טלפון"
          name="contact_phone"
          value={form.contact_phone as string}
          onChange={updateField}
          placeholder="050-0000000"
          type="tel"
          dir="ltr"
        />
        <Input
          label="אימייל"
          name="contact_email"
          value={form.contact_email as string}
          onChange={updateField}
          placeholder="name@company.com"
          type="email"
          dir="ltr"
        />
      </div>
    </div>
  );
}

// ============================================================================
// Section: Financial X-ray
// ============================================================================
function SectionFinancial({
  form,
  updateField,
}: {
  form: FormState;
  updateField: (name: string, value: string | number) => void;
}) {
  return (
    <div className="space-y-6">
      <Textarea
        label="1. איפה ואיך מתנהל מעקב התזרים מזומנים?"
        name="q_cashflow_tracking"
        value={form.q_cashflow_tracking as string}
        onChange={updateField}
        placeholder="Excel, תוכנה ייעודית, רואה חשבון, או בכלל לא..."
      />
      <Textarea
        label="2. תנאי תשלום — מועדים וצורת גבייה?"
        name="q_payment_terms"
        value={form.q_payment_terms as string}
        onChange={updateField}
        placeholder="שוטף + X ימים? איך גובים? איך פותרים פיגורים?"
      />
      <Textarea
        label="3. איך מתבצע מעקב תשלומים?"
        name="q_payment_followup"
        value={form.q_payment_followup as string}
        onChange={updateField}
        placeholder="מי אחראי, באיזו תכיפות, ועם איזה כלי..."
      />
      <Textarea
        label="4. האם נמדדת רווחיות לכל פרויקט? מה הסטייה הממוצעת מהתקציב?"
        name="q_project_profitability"
        value={form.q_project_profitability as string}
        onChange={updateField}
      />
      <Textarea
        label="5. מסגרות אשראי בנקאי — סך הכל וניצול ממוצע?"
        name="q_credit_lines"
        value={form.q_credit_lines as string}
        onChange={updateField}
      />
      <Textarea
        label="6. שלוש חשיפות פיננסיות שאתה כבר מודע אליהן"
        name="q_known_exposures"
        value={form.q_known_exposures as string}
        onChange={updateField}
        placeholder="פיגורים, חובות, ערבויות פתוחות, התחייבויות עתידיות..."
        rows={3}
      />
      <Textarea
        label="7. ביטוחי עבודות קבלניות, צד ג׳ וחבות מעבידים — קיימים? עודכנו השנה?"
        name="q_insurance"
        value={form.q_insurance as string}
        onChange={updateField}
      />
      <Textarea
        label="8. חשיפה לתביעות — תביעות פתוחות, סכסוכים פעילים, או חשיפות לא ממומשות"
        name="q_litigation_exposure"
        value={form.q_litigation_exposure as string}
        onChange={updateField}
        placeholder="ליקויים, איחורים, תאונות, או תביעות פוטנציאליות..."
        rows={3}
      />
      <Textarea
        label="9. האם יש לך סיסטם מסודר למניעת תביעות?"
        name="q_prevention_system"
        value={form.q_prevention_system as string}
        onChange={updateField}
        placeholder="חוזים, סיורי קבלה, תיעוד, פרוטוקולים..."
      />
      <Textarea
        label="10. כיסוי משפטי — עו״ד קבוע? ביטוח אחריות מקצועית? בדיקה משפטית לחוזים?"
        name="q_legal_coverage"
        value={form.q_legal_coverage as string}
        onChange={updateField}
      />
      <ScaleSelect
        label="11. דירוג כללי לבריאות הפיננסית של העסק"
        name="q_financial_health_score"
        value={form.q_financial_health_score as number}
        onChange={(n, v) => updateField(n, v)}
        leftLabel="קריטי"
        rightLabel="מצוין"
      />
    </div>
  );
}

// ============================================================================
// Section: Tech & operations
// ============================================================================
function SectionTech({
  form,
  updateField,
}: {
  form: FormState;
  updateField: (name: string, value: string | number) => void;
}) {
  return (
    <div className="space-y-6">
      <Textarea
        label="1. אילו תוכנות בשימוש היום?"
        name="q_software_used"
        value={form.q_software_used as string}
        onChange={updateField}
        placeholder="הצעות מחיר / פרויקטים / הנהלת חשבונות / שטח..."
        rows={3}
      />
      <Textarea
        label="2. כמה זמן לוקח להפיק הצעת מחיר ממוצעת?"
        name="q_quote_time"
        value={form.q_quote_time as string}
        onChange={updateField}
        placeholder="שעה? יום? שבוע?"
      />
      <Textarea
        label="3. איך מדווחת התקדמות מהשטח ואיפה היא נשמרת?"
        name="q_field_reporting"
        value={form.q_field_reporting as string}
        onChange={updateField}
        placeholder="WhatsApp, אפליקציה, יומן עבודה, או טלפונים..."
      />
      <Textarea
        label="4. איפה חיים החוזים, התוכניות והמסמכים?"
        name="q_document_storage"
        value={form.q_document_storage as string}
        onChange={updateField}
        placeholder="Drive / WhatsApp / מגירה / קלסר..."
      />
      <Textarea
        label="5. שלושה תהליכים ידניים שגוזלים הכי הרבה זמן"
        name="q_manual_processes"
        value={form.q_manual_processes as string}
        onChange={updateField}
        placeholder="הזנה כפולה, דיווחים, הצעות מחיר, חישובים..."
        rows={3}
      />
      <Textarea
        label="6. איזה דאשבורד או דוח אתה רואה כל בוקר?"
        name="q_morning_dashboard"
        value={form.q_morning_dashboard as string}
        onChange={updateField}
        placeholder="או — אילו נתונים היית רוצה לראות כל בוקר?"
      />
      <ScaleSelect
        label="7. במידה 1-10 — כמה העסק תלוי באנשים ספציפיים (כולל בך)?"
        name="q_people_dependency"
        value={form.q_people_dependency as number}
        onChange={(n, v) => updateField(n, v)}
        leftLabel="לא תלוי"
        rightLabel="לחלוטין תלוי"
      />
      <Textarea
        label="8. אם היית מקבל עוזר אישי אחד — איזה תהליך היית מעביר לו ראשון?"
        name="q_first_delegate"
        value={form.q_first_delegate as string}
        onChange={updateField}
        placeholder="מה הכי גוזל לך זמן או אנרגיה?"
      />
    </div>
  );
}

// ============================================================================
// Section: Summary
// ============================================================================
function SectionSummary({
  form,
  updateField,
}: {
  form: FormState;
  updateField: (name: string, value: string | number) => void;
}) {
  return (
    <div className="space-y-6">
      <Textarea
        label="שלושת הדברים שהייתי רוצה לטפל בהם מיד"
        name="q_top_three_priorities"
        value={form.q_top_three_priorities as string}
        onChange={updateField}
        placeholder="הכי בוער, הכי כואב, הכי חשוב..."
        rows={4}
      />
      <ScaleSelect
        label="רמת דחיפות"
        name="q_urgency"
        value={form.q_urgency as number}
        onChange={(n, v) => updateField(n, v)}
        leftLabel="לא דחוף"
        rightLabel="בוער"
      />
      <Textarea
        label="תקציב משוער להשקעה בתהליך"
        name="q_budget"
        value={form.q_budget as string}
        onChange={updateField}
        placeholder="טווח חודשי או חד-פעמי..."
      />
      <SelectGroup
        label="מתי נכון להתחיל?"
        name="q_when_to_start"
        value={form.q_when_to_start as string}
        onChange={updateField}
        options={[
          { value: 'immediately', label: 'מיידית' },
          { value: 'this_month', label: 'החודש' },
          { value: 'next_month', label: 'בחודש הבא' },
          { value: 'this_quarter', label: 'ברבעון הקרוב' },
          { value: 'exploring', label: 'בבחינה' },
        ]}
      />

      <div className="mt-8 p-5 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-slate-700 leading-relaxed">
            <strong className="text-slate-900">מה קורה אחרי שתשלח?</strong>
            <p className="mt-1">
              נחזור אליך תוך 24 שעות עם סיכום ראשוני של 3 הנקודות החזקות ביותר
              שזיהינו, ו-2 הצעות פעולה מיידיות. ללא התחייבות.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Thank-you screen
// ============================================================================
function ThankYouScreen() {
  return (
    <div className="text-center max-w-2xl mx-auto py-16">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 mb-8">
        <CheckCircle2 className="w-10 h-10 text-amber-600" />
      </div>
      <h1 className="font-serif-heb text-4xl sm:text-5xl font-black leading-tight mb-4">
        השאלון נקלט אצלנו
      </h1>
      <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-xl mx-auto">
        תודה. אנחנו ניצור איתך קשר תוך 24 שעות עם סיכום ראשוני של הנקודות
        החזקות ביותר שזיהינו, וצעדים מיידיים שאפשר לעשות.
      </p>
      <a
        href="https://taskflow-ai.com"
        className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition"
      >
        <ChevronLeft className="w-4 h-4" />
        חזרה לאתר TaskFlow
      </a>
    </div>
  );
}

// ============================================================================
// Small reusable inputs (keeping them inline so the file is self-contained)
// ============================================================================
function Input({
  label,
  name,
  value,
  onChange,
  placeholder,
  type = 'text',
  dir,
}: {
  label: string;
  name: string;
  value: string | undefined;
  onChange: (name: string, value: string) => void;
  placeholder?: string;
  type?: string;
  dir?: 'rtl' | 'ltr';
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</span>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        dir={dir}
        className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition placeholder:text-slate-400"
      />
    </label>
  );
}

function Textarea({
  label,
  name,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  label: string;
  name: string;
  value: string | undefined;
  onChange: (name: string, value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</span>
      <textarea
        value={value ?? ''}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3.5 py-2.5 text-sm bg-slate-50/60 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition placeholder:text-slate-400 resize-none"
      />
    </label>
  );
}

function SelectGroup({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  name: string;
  value: string | undefined;
  onChange: (name: string, value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <span className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(name, o.value)}
            className={`px-4 py-2 text-sm rounded-lg border transition ${
              value === o.value
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScaleSelect({
  label,
  name,
  value,
  onChange,
  leftLabel,
  rightLabel,
}: {
  label: string;
  name: string;
  value: number | undefined;
  onChange: (name: string, value: number) => void;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <div>
      <span className="block text-sm font-semibold text-slate-700 mb-2">{label}</span>
      <div className="flex items-center gap-1.5 sm:gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(name, n)}
            className={`flex-1 h-10 text-sm font-bold rounded-md border transition ${
              value === n
                ? 'bg-amber-500 text-white border-amber-500 scale-105 shadow-md'
                : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300 hover:bg-amber-50'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-slate-500 mt-1.5">
        <span>{rightLabel}</span>
        <span>{leftLabel}</span>
      </div>
    </div>
  );
}
