'use client';

import { useContext, useCallback } from 'react';
import { LanguageContext } from './provider';
import { LOCALES, Locale } from './locales';

/**
 * useT - the main translation hook for client components.
 *
 * Usage:
 *   const { t, locale, dir } = useT();
 *   <button>{t('common.save')}</button>
 *   <h1>{t('records.showing', { n: 42 })}</h1>
 *
 * Path is dot-notated (namespace.key). Missing keys return the path itself
 * so the missing string is visible in the UI rather than silently breaking.
 *
 * Placeholders use {name} syntax. Pass values as the second arg.
 */
export function useT() {
  const { locale, dir } = useContext(LanguageContext);
  const dict = LOCALES[locale];

  const t = useCallback((path: string, vars?: Record<string, string | number>): string => {
    const value = getNestedValue(dict, path);
    if (typeof value !== 'string') {
      // Fall back to the key path so missing translations are obvious in dev
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.warn(`[i18n] Missing translation: "${path}" for locale "${locale}"`);
      }
      return path;
    }
    return interpolate(value, vars);
  }, [dict, locale]);

  return { t, locale, dir };
}

/**
 * Lighter hook for components that only need the locale (not the t function).
 */
export function useLocale(): Locale {
  return useContext(LanguageContext).locale;
}

// ─────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────

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
