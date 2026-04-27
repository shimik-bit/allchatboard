'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight, ArrowLeft, Sparkles, Database, Users, MessageSquare, Lightbulb, Check } from 'lucide-react';
import { useT } from '@/lib/i18n/useT';

/**
 * OnboardingTour - First-run experience for new users
 *
 * Shows a welcome modal with 5 introductory steps explaining the core concepts.
 * Persists "seen" state in localStorage so it only appears on first login.
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

function buildSteps(t: (path: string, vars?: any) => string): Step[] {
  return [
    {
      icon: Sparkles,
      iconBg: 'bg-gradient-to-br from-purple-500 to-purple-700',
      iconColor: 'text-white',
      title: t('tour.step1_title'),
      body: (
        <>
          <p>{t('tour.step1_body1')}</p>
          <p className="mt-2">{t('tour.step1_body2')}</p>
        </>
      ),
      tip: t('tour.step1_tip'),
    },
    {
      icon: Database,
      iconBg: 'bg-gradient-to-br from-blue-500 to-blue-700',
      iconColor: 'text-white',
      title: t('tour.step2_title'),
      body: (
        <>
          <p dangerouslySetInnerHTML={{ __html: t('tour.step2_body1') }} />
          <p className="mt-2" dangerouslySetInnerHTML={{ __html: t('tour.step2_body2') }} />
        </>
      ),
      tip: t('tour.step2_tip'),
    },
    {
      icon: MessageSquare,
      iconBg: 'bg-gradient-to-br from-green-500 to-green-700',
      iconColor: 'text-white',
      title: t('tour.step3_title'),
      body: (
        <>
          <p>{t('tour.step3_body1')}</p>
          <p className="mt-2">{t('tour.step3_body2')}</p>
        </>
      ),
      actionLabel: t('tour.step3_action'),
      actionHref: '/dashboard/whatsapp',
      tip: t('tour.step3_tip'),
    },
    {
      icon: Users,
      iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
      iconColor: 'text-white',
      title: t('tour.step4_title'),
      body: (
        <>
          <p>{t('tour.step4_body1')}</p>
          <p className="mt-2" dangerouslySetInnerHTML={{ __html: t('tour.step4_body2') }} />
        </>
      ),
      actionLabel: t('tour.step4_action'),
      actionHref: '/dashboard/settings',
      tip: t('tour.step4_tip'),
    },
    {
      icon: Lightbulb,
      iconBg: 'bg-gradient-to-br from-pink-500 to-rose-600',
      iconColor: 'text-white',
      title: t('tour.step5_title'),
      body: (
        <>
          <p>{t('tour.step5_body')}</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>{t('tour.step5_action1')}</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>{t('tour.step5_action2')}</span>
            </li>
          </ul>
        </>
      ),
      tip: t('tour.step5_tip'),
    },
  ];
}

export default function OnboardingTour() {
  const { t, dir } = useT();
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        const tm = setTimeout(() => setShow(true), 800);
        return () => clearTimeout(tm);
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
    if (step < STEPS_COUNT - 1) setStep(step + 1);
    else close();
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  if (!show) return null;

  const STEPS = buildSteps(t);
  const STEPS_COUNT = STEPS.length;
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
        <div className="relative">
          <button
            onClick={close}
            className={`absolute top-4 ${dir === 'rtl' ? 'left-4' : 'right-4'} p-2 rounded-lg hover:bg-black/5 text-gray-400 hover:text-gray-600 z-10`}
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="pt-12 pb-6 px-6 text-center">
            <div className={`w-20 h-20 ${current.iconBg} rounded-2xl mx-auto mb-5 flex items-center justify-center shadow-lg`}>
              <Icon className={`w-10 h-10 ${current.iconColor}`} />
            </div>
            <h2 className="font-display font-black text-2xl mb-3 leading-tight">{current.title}</h2>
            <div className={`text-gray-600 text-sm leading-relaxed ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
              {current.body}
            </div>
          </div>
        </div>

        {current.tip && (
          <div className="mx-6 p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-900 flex gap-2 items-start">
            <Lightbulb className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>{current.tip}</span>
          </div>
        )}

        {current.actionLabel && current.actionHref && (
          <div className="px-6 mt-4">
            <a
              href={current.actionHref}
              onClick={() => { try { localStorage.setItem(STORAGE_KEY, '1'); } catch {} }}
              className="block w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white text-center rounded-xl font-semibold text-sm hover:shadow-lg transition-all"
            >
              {current.actionLabel} {dir === 'rtl' ? '←' : '→'}
            </a>
          </div>
        )}

        <div className="flex justify-center gap-1.5 mt-6">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-8 bg-purple-600' : 'w-1.5 bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={t('tour.go_to_step', { n: i + 1 })}
            />
          ))}
        </div>

        <div className="flex items-center justify-between px-6 py-5 mt-2">
          <button
            onClick={close}
            className="text-xs text-gray-500 hover:text-gray-700 font-medium"
          >
            {t('tour.skip')}
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={back}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                aria-label={t('common.back')}
              >
                {dir === 'rtl' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={next}
              className="px-5 py-2 bg-gray-900 text-white rounded-lg font-semibold text-sm hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              {isLast ? t('tour.lets_go') : t('common.next')}
              {!isLast && (dir === 'rtl' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
