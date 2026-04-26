'use client';

import { createContext, ReactNode } from 'react';
import { Locale, LOCALES, DEFAULT_LOCALE } from './locales';

export type LanguageContextValue = {
  locale: Locale;
  dir: 'rtl' | 'ltr';
};

export const LanguageContext = createContext<LanguageContextValue>({
  locale: DEFAULT_LOCALE,
  dir: 'rtl',
});

/**
 * LanguageProvider - wrap the app root with this. Reads the workspace locale
 * from the server (via prop), and exposes it to all client components via
 * useT()/useLocale() hooks.
 *
 * For now, locale is fixed per render - to change locale, the workspace
 * setting is updated server-side and the page reloads.
 */
export function LanguageProvider({
  locale, children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  return (
    <LanguageContext.Provider value={{ locale, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}
