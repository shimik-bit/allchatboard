'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Sparkles, Database, Users, MessageSquare, Lightbulb, Check } from 'lucide-react';

/**
 * OnboardingTour - First-run experience for new users
 *
 * Shows a welcome modal with 5 introductory steps explaining the core concepts.
 * Persists "seen" state in localStorage so it only appears on first login.
 *
 * Each step has:
 * - An icon and color
 * - A heading and friendly explanation
 * - Optional "tip" footer
 * - Optional "action" link to a relevant page
 *
 * Users can skip at any time via the X button or the "skip" link.
 */

const STORAGE_KEY = 'allchatboard:onboarding-seen-v1';

type Step = {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  body: React.ReactNode;
  tip?: string;
  actionLabel?: string;
  actionHref?: string;
};

const STEPS: Step[] = [
  {
    icon: Sparkles,
    iconBg: 'bg-gradient-to-br from-purple-500 to-purple-700',
    iconColor: 'text-white',
    title: 'ברוך הבא ל-AllChatBoard 👋',
    body: (
      <>
        <p>
          המערכת שלנו הופכת WhatsApp שלך ללוח ניהול חכם.
          כל הודעה שנכנסת — AI מסווג, מוציא פרטים, ושומר ברשומה.
        </p>
        <p className="mt-2">
          ההיכרות הקצרה הזאת תלמד אותך 4 דברים שכדאי לדעת לפני שמתחילים. שווה את 60 השניות.
        </p>
      </>
    ),
    tip: 'אפשר לדלג בכל שלב — תוכל לחזור למדריך מתפריט "עזרה" בכל זמן.',
  },
  {
    icon: Database,
    iconBg: 'bg-gradient-to-br from-blue-500 to-blue-700',
    iconColor: 'text-white',
    title: 'הכל מתחיל מטבלאות',
    body: (
      <>
        <p>
          סביבת העבודה שלך מורכבת מ<strong>טבלאות</strong>. כל טבלה היא קטגוריה של נתונים: לקוחות, תקלות, תורים, חיובים.
        </p>
        <p className="mt-2">
          בכל טבלה יש <strong>שדות</strong> (עמודות) ו<strong>רשומות</strong> (שורות).
          לחיצה על כל שורה פותחת תיק מלא עם כל הפרטים שלה.
        </p>
      </>
    ),
    tip: 'כבר בחרת תבנית? יופי - הטבלאות החשובות כבר מחכות לך מוכנות.',
  },
  {
    icon: MessageSquare,
    iconBg: 'bg-gradient-to-br from-green-500 to-green-700',
    iconColor: 'text-white',
    title: 'חבר את WhatsApp - זה הקסם',
    body: (
      <>
        <p>
          בלי WhatsApp - המערכת היא Excel חכם. עם WhatsApp - היא הופכת לעוזרת אישית 24/7.
        </p>
        <p className="mt-2">
          זמן החיבור: <strong>5 דקות</strong>. תקבל ספק (כמו Green API), תסרוק QR פעם אחת, תדביק את ה-Token. זהו.
        </p>
      </>
    ),
    actionLabel: 'חבר WhatsApp עכשיו',
    actionHref: '/dashboard/whatsapp',
    tip: 'אפשר גם להתחיל בלי WhatsApp ולחבר מאוחר יותר. הכל בקצב שלך.',
  },
  {
    icon: Users,
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
    iconColor: 'text-white',
    title: 'הזמן את הצוות',
    body: (
      <>
        <p>
          AllChatBoard נועד לעבודת צוות. הזמן עמיתים, הקצא להם תפקידים (בעלים / מנהל / עורך / צופה),
          ותן להם לעבוד יחד באותו מרחב.
        </p>
        <p className="mt-2">
          רוצה לתת רק קריאה לחלק מהטבלאות? יש <strong>הרשאות גרנולריות</strong> בכל טבלה בנפרד.
        </p>
      </>
    ),
    actionLabel: 'הזמן חברים',
    actionHref: '/dashboard/settings',
    tip: 'בלי חברים זה גם בסדר - אפשר לעבוד לבד עם המערכת.',
  },
  {
    icon: Lightbulb,
    iconBg: 'bg-gradient-to-br from-pink-500 to-rose-600',
    iconColor: 'text-white',
    title: 'מוכן? בוא נעוף 🚀',
    body: (
      <>
        <p>
          זהו - יש לך את כל מה שצריך כדי להתחיל. אנחנו ממליצים לעשות שני דברים עכשיו:
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <span>פתח טבלה כלשהי ולחץ על שורה - תראה איך נראה תיק מלא</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <span>לחץ "+ רשומה חדשה" ותכניס נתון אחד - כדי להתרגל</span>
          </li>
        </ul>
      </>
    ),
    tip: 'יש שאלה? פנייה ל-support@allchatboard.com או לחץ על "עזרה" בתפריט.',
  },
];

export default function OnboardingTour() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Check localStorage on mount
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        // Small delay so the rest of the page finishes rendering
        const t = setTimeout(() => setShow(true), 800);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage might be disabled
    }
  }, []);

  function close() {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    setShow(false);
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else close();
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  if (!show) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={close}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with icon */}
        <div className="relative">
          <button
            onClick={close}
            className="absolute top-4 left-4 p-2 rounded-lg hover:bg-black/5 text-gray-400 hover:text-gray-600 z-10"
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="pt-12 pb-6 px-6 text-center">
            <div className={`w-20 h-20 ${current.iconBg} rounded-2xl mx-auto mb-5 flex items-center justify-center shadow-lg`}>
              <Icon className={`w-10 h-10 ${current.iconColor}`} />
            </div>
            <h2 className="font-display font-black text-2xl mb-3 leading-tight">{current.title}</h2>
            <div className="text-gray-600 text-sm leading-relaxed text-right">
              {current.body}
            </div>
          </div>
        </div>

        {/* Tip */}
        {current.tip && (
          <div className="mx-6 p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-900 flex gap-2 items-start">
            <Lightbulb className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>{current.tip}</span>
          </div>
        )}

        {/* Action button (optional) */}
        {current.actionLabel && current.actionHref && (
          <div className="px-6 mt-4">
            <a
              href={current.actionHref}
              onClick={() => { try { localStorage.setItem(STORAGE_KEY, '1'); } catch {} }}
              className="block w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white text-center rounded-xl font-semibold text-sm hover:shadow-lg transition-all"
            >
              {current.actionLabel} ←
            </a>
          </div>
        )}

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mt-6">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-8 bg-purple-600' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`עבור לשלב ${i + 1}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 py-5 mt-2">
          <button
            onClick={close}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium"
          >
            דלג על המדריך
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={back}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                aria-label="קודם"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={next}
              className="px-5 py-2 bg-gray-900 text-white rounded-lg font-semibold text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              {isLast ? 'קדימה!' : 'המשך'}
              {!isLast && <ArrowLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
