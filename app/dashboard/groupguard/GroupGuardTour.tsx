'use client';

/**
 * GroupGuardTour - סיור מודרך לפיצ'ר ניהול הקבוצות
 *
 * שימוש:
 *   <GroupGuardTour startSignal={tourSignal} />
 *
 * הסיור מתחיל אוטומטית בכניסה ראשונה לדף, או כשמעלים את startSignal.
 * נשמר ב-localStorage שהמשתמש עבר אותו, אז הוא לא יחזור לבד.
 */

import { useEffect, useMemo, useState } from 'react';
import { useT } from '@/lib/i18n/useT';

type TourStep = {
  id: string;
  target?: string; // CSS selector. אם אין - מראים במרכז המסך
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
};

const STEPS: TourStep[] = [
  { id: 'welcome', position: 'center' },
  { id: 'tabs', target: '[data-tour="gg-tabs"]', position: 'bottom' },
  { id: 'dashboard', target: '[data-tour="gg-tab-dashboard"]', position: 'bottom' },
  { id: 'broadcast', target: '[data-tour="gg-tab-broadcast"]', position: 'bottom' },
  { id: 'groups', target: '[data-tour="gg-tab-groups"]', position: 'bottom' },
  { id: 'members', target: '[data-tour="gg-tab-members"]', position: 'bottom' },
  { id: 'prefixes', target: '[data-tour="gg-tab-prefixes"]', position: 'bottom' },
  { id: 'whitelist', target: '[data-tour="gg-tab-whitelist"]', position: 'bottom' },
  { id: 'log', target: '[data-tour="gg-tab-log"]', position: 'bottom' },
  { id: 'help', target: '[data-tour="gg-help-btn"]', position: 'bottom' },
];

const STORAGE_KEY = 'taskflow.groupguard.tour.completed.v1';

type Props = {
  /** התחלה אוטומטית בכניסה ראשונה. ברירת מחדל: true */
  autoStart?: boolean;
  /** מספר שמשתנה כדי להפעיל ידנית מכפתור חיצוני */
  startSignal?: number;
  /** קולבק כשהסיור מסתיים או נדלג */
  onClose?: () => void;
};

export default function GroupGuardTour({
  autoStart = true,
  startSignal = 0,
  onClose,
}: Props) {
  const { t, dir } = useT();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  // השלבים — מועברים דרך i18n. אם הטאב לא קיים בדף (כמו broadcast למשתמש בלי canEdit),
  // נסנן אותם החוצה כדי לא להציג שלב על משהו שלא קיים.
  const visibleSteps = useMemo(() => {
    if (typeof document === 'undefined') return STEPS;
    return STEPS.filter((s) => {
      if (!s.target) return true;
      return !!document.querySelector(s.target);
    });
  }, [open]);

  const step = visibleSteps[stepIndex];
  const isLast = stepIndex === visibleSteps.length - 1;
  const isFirst = stepIndex === 0;

  // התחלה אוטומטית בכניסה ראשונה
  useEffect(() => {
    if (!autoStart) return;
    if (typeof window === 'undefined') return;
    const completed = window.localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [autoStart]);

  // הפעלה מכפתור חיצוני
  useEffect(() => {
    if (startSignal > 0) {
      setStepIndex(0);
      setOpen(true);
    }
  }, [startSignal]);

  // מציאת מיקום היעד בכל שינוי שלב או resize
  useEffect(() => {
    if (!open || !step?.target) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      const el = document.querySelector(step.target!);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    const t1 = setTimeout(updateRect, 200);
    const t2 = setTimeout(updateRect, 500);

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [open, step?.target, stepIndex]);

  // ניווט מקלדת
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip();
      else if (e.key === 'Enter') handleNext();
      // בעברית RTL — חצים הפוכים
      else if (e.key === 'ArrowLeft') dir === 'rtl' ? handleNext() : handlePrev();
      else if (e.key === 'ArrowRight') dir === 'rtl' ? handlePrev() : handleNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stepIndex, dir]);

  const handleNext = () => {
    if (isLast) handleFinish();
    else setStepIndex((i) => i + 1);
  };

  const handlePrev = () => {
    if (!isFirst) setStepIndex((i) => i - 1);
  };

  const handleSkip = () => {
    setOpen(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, 'skipped:' + Date.now());
    }
    onClose?.();
  };

  const handleFinish = () => {
    setOpen(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, 'completed:' + Date.now());
    }
    onClose?.();
  };

  const popoverPosition = useMemo(() => {
    if (!targetRect || step?.position === 'center' || !step?.target) {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const padding = 16;
    const popoverHeight = 220;
    const popoverWidth = 360;
    const pos = step.position || 'bottom';

    const styles: React.CSSProperties = { position: 'fixed' };

    if (pos === 'left') {
      styles.right = window.innerWidth - targetRect.left + padding;
      styles.top = Math.max(
        padding,
        Math.min(
          targetRect.top + targetRect.height / 2 - popoverHeight / 2,
          window.innerHeight - popoverHeight - padding,
        ),
      );
    } else if (pos === 'right') {
      styles.left = targetRect.right + padding;
      styles.top = Math.max(
        padding,
        Math.min(
          targetRect.top + targetRect.height / 2 - popoverHeight / 2,
          window.innerHeight - popoverHeight - padding,
        ),
      );
    } else if (pos === 'top') {
      styles.bottom = window.innerHeight - targetRect.top + padding;
      styles.left = Math.max(
        padding,
        Math.min(
          targetRect.left + targetRect.width / 2 - popoverWidth / 2,
          window.innerWidth - popoverWidth - padding,
        ),
      );
    } else {
      // bottom
      styles.top = targetRect.bottom + padding;
      styles.left = Math.max(
        padding,
        Math.min(
          targetRect.left + targetRect.width / 2 - popoverWidth / 2,
          window.innerWidth - popoverWidth - padding,
        ),
      );
    }

    return styles;
  }, [targetRect, step?.position, step?.target]);

  if (!open || !step) return null;

  const titleKey = `groupguardTour.steps.${step.id}.title`;
  const bodyKey = `groupguardTour.steps.${step.id}.body`;

  return (
    <div dir={dir} className="fixed inset-0 z-[9999] pointer-events-none">
      {/* אוברליי כהה עם חור ספוטלייט */}
      <div className="absolute inset-0 pointer-events-auto" onClick={handleSkip}>
        <svg className="w-full h-full">
          <defs>
            <mask id="gg-tour-mask">
              <rect width="100%" height="100%" fill="white" />
              {targetRect && (
                <rect
                  x={targetRect.left - 8}
                  y={targetRect.top - 8}
                  width={targetRect.width + 16}
                  height={targetRect.height + 16}
                  rx={12}
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(15, 23, 42, 0.72)"
            mask="url(#gg-tour-mask)"
          />
        </svg>
      </div>

      {/* מסגרת זוהרת מסביב ליעד */}
      {targetRect && (
        <div
          className="absolute pointer-events-none rounded-xl ring-2 ring-purple-400 ring-offset-2 ring-offset-transparent animate-pulse"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            boxShadow: '0 0 32px rgba(168, 85, 247, 0.5)',
          }}
        />
      )}

      {/* קופסת ההסבר */}
      <div
        className="pointer-events-auto bg-white rounded-2xl shadow-2xl border border-purple-100 p-6 w-[360px] max-w-[calc(100vw-32px)]"
        style={popoverPosition}
        onClick={(e) => e.stopPropagation()}
      >
        {/* מד התקדמות */}
        <div className="flex items-center gap-2 mb-4">
          {visibleSteps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${
                i === stepIndex
                  ? 'bg-purple-500'
                  : i < stepIndex
                    ? 'bg-purple-300'
                    : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* מספר שלב */}
        <div className="text-xs text-gray-400 mb-2">
          {t('groupguardTour.step_count', {
            current: stepIndex + 1,
            total: visibleSteps.length,
          })}
        </div>

        {/* כותרת */}
        <h3 className="text-lg font-bold text-gray-900 mb-2">{t(titleKey)}</h3>

        {/* גוף ההסבר */}
        <p className="text-sm text-gray-600 leading-relaxed mb-5">{t(bodyKey)}</p>

        {/* כפתורים */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSkip}
              className="text-xs text-gray-400 hover:text-gray-600 transition"
            >
              {t('groupguardTour.skip')}
            </button>
            <a
              href="/help/groupguard"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-purple-500 hover:text-purple-700 transition underline-offset-2 hover:underline"
            >
              {t('groupguardTour.read_full_guide')}
            </a>
          </div>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={handlePrev}
                className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                {t('groupguardTour.prev')}
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm transition"
            >
              {isLast ? t('groupguardTour.finish') : t('groupguardTour.next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * כפתור "?" שמפעיל את הסיור מחדש
 * שימוש: <GroupGuardHelpButton onStartTour={() => setSignal(s => s + 1)} />
 */
export function GroupGuardHelpButton({ onStartTour }: { onStartTour: () => void }) {
  const { t } = useT();
  return (
    <button
      onClick={onStartTour}
      data-tour="gg-help-btn"
      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-purple-50 hover:bg-purple-100 text-purple-600 transition border border-purple-200 text-base font-bold"
      title={t('groupguardTour.start_tour')}
      aria-label={t('groupguardTour.start_tour')}
    >
      ?
    </button>
  );
}
