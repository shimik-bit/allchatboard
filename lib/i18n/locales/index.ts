import { he } from './he';
import { en } from './en';

export type Locale = 'he' | 'en';

export const LOCALES = { he, en } as const;

export const LOCALE_INFO: Record<Locale, { name: string; nativeName: string; dir: 'rtl' | 'ltr'; flag: string }> = {
  he: { name: 'Hebrew', nativeName: 'עברית', dir: 'rtl', flag: '🇮🇱' },
  en: { name: 'English', nativeName: 'English', dir: 'ltr', flag: '🇬🇧' },
};

export const DEFAULT_LOCALE: Locale = 'he';

export function isValidLocale(s: string | null | undefined): s is Locale {
  return s === 'he' || s === 'en';
}

export { he, en };
