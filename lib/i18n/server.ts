/**
 * Server-side i18n helpers - used by server components, API routes,
 * cron jobs, and webhooks (anywhere there's no React Context).
 *
 * Pattern:
 *   import { getT } from '@/lib/i18n/server';
 *   const { t, locale } = getT(workspace.locale);
 *   const greeting = t('reports.greeting_morning');
 */

import { LOCALES, Locale, isValidLocale, DEFAULT_LOCALE } from './locales';

export type ServerT = {
  t: (path: string, vars?: Record<string, string | number>) => string;
  locale: Locale;
  dir: 'rtl' | 'ltr';
};

export function getT(locale: Locale | string | null | undefined): ServerT {
  const safe = isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  const dict = LOCALES[safe];

  return {
    t: (path: string, vars?: Record<string, string | number>) => {
      const value = getNestedValue(dict, path);
      if (typeof value !== 'string') return path;
      return interpolate(value, vars);
    },
    locale: safe,
    dir: safe === 'he' ? 'rtl' : 'ltr',
  };
}

function getNestedValue(obj: any, path: string): unknown {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = vars[key];
    return v !== undefined ? String(v) : `{${key}}`;
  });
}
