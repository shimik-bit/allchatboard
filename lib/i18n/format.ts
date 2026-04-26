/**
 * Locale-aware formatters.
 *
 * These work on both client and server (no React imports). Pass the locale
 * explicitly so they can be used in cron jobs / webhooks without context.
 */

import type { Locale } from './locales';

// ─────────────────────────────────────────────────────────────────────────
// Day & Month names
// ─────────────────────────────────────────────────────────────────────────

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_HE_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const DAYS_EN_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function dayName(date: Date, locale: Locale, short = false): string {
  const arr = locale === 'he'
    ? (short ? DAYS_HE_SHORT : DAYS_HE)
    : (short ? DAYS_EN_SHORT : DAYS_EN);
  return arr[date.getDay()];
}

export function monthName(date: Date, locale: Locale): string {
  const arr = locale === 'he' ? MONTHS_HE : MONTHS_EN;
  return arr[date.getMonth()];
}

// ─────────────────────────────────────────────────────────────────────────
// Date formatters
// ─────────────────────────────────────────────────────────────────────────

export function formatDate(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-US', {
    day: 'numeric',
    month: 'numeric',
    year: '2-digit',
  }).format(d);
}

export function formatDateLong(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (locale === 'he') {
    return `${d.getDate()} ${monthName(d, 'he')} ${d.getFullYear()}`;
  }
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(d);
}

export function formatTime(date: Date | string, locale: Locale): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: locale === 'en',
  }).format(d);
}

export function formatDateTime(date: Date | string, locale: Locale): string {
  return `${formatDate(date, locale)} ${formatTime(date, locale)}`;
}

/**
 * "Today, 14:30" / "Yesterday, 09:15" / "5 min ago" — locale aware
 */
export function formatRelativeTime(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (locale === 'he') {
    if (diffSec < 60) return 'עכשיו';
    if (diffMin < 5) return 'לפני רגע';
    if (diffMin < 60) return `לפני ${diffMin} דק׳`;
    if (diffHr === 1) return 'לפני שעה';
    if (diffHr === 2) return 'לפני שעתיים';
    if (diffHr < 12) return `לפני ${diffHr} שעות`;
  } else {
    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 12) return `${diffHr}h ago`;
  }

  const time = formatTime(d, locale);
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return locale === 'he' ? `היום, ${time}` : `Today, ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return locale === 'he' ? `אתמול, ${time}` : `Yesterday, ${time}`;
  }

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    const day = dayName(d, locale);
    return locale === 'he' ? `${day}, ${time}` : `${day}, ${time}`;
  }

  return formatDate(d, locale);
}

// ─────────────────────────────────────────────────────────────────────────
// Greeting
// ─────────────────────────────────────────────────────────────────────────

export function getGreeting(locale: Locale, date = new Date()): string {
  const hour = date.getHours();
  if (locale === 'he') {
    if (hour < 12) return '🌅 בוקר טוב';
    if (hour < 17) return '☀️ צהריים טובים';
    if (hour < 20) return '🌇 ערב טוב';
    return '🌙 לילה טוב';
  } else {
    if (hour < 12) return '🌅 Good morning';
    if (hour < 17) return '☀️ Good afternoon';
    if (hour < 20) return '🌇 Good evening';
    return '🌙 Good night';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Numbers, currency
// ─────────────────────────────────────────────────────────────────────────

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-US').format(n);
}

export function formatCurrency(amount: number, locale: Locale, symbol?: string): string {
  const sym = symbol || (locale === 'he' ? '₪' : '$');
  // For ILS we put symbol after, for USD before
  const formatted = formatNumber(amount, locale);
  if (sym === '₪' || locale === 'he') {
    return `${sym}${formatted}`;
  }
  return `${sym}${formatted}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Phone numbers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Format a phone number for display. Locale determines the expected format.
 *  - he: 0501234567 → 050-123-4567
 *  - en: 5551234567 → +1 (555) 123-4567 (assumes US default for now)
 */
export function formatPhone(phone: string, locale: Locale): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return phone;

  if (locale === 'he') {
    // Israeli mobile: 0501234567 → 050-123-4567
    if (digits.length === 10 && digits.startsWith('0')) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    // International: 972501234567 → 050-123-4567
    if (digits.startsWith('972') && digits.length === 12) {
      const local = '0' + digits.slice(3);
      return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
    }
    return phone;
  }

  // English: try to format US-style if 10 or 11 digits
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

// ─────────────────────────────────────────────────────────────────────────
// Day labels for schedule UI ("Sun, Mon, Tue ...")
// ─────────────────────────────────────────────────────────────────────────

export function formatScheduleDays(dayIndices: number[], locale: Locale): string {
  if (dayIndices.length === 7) return locale === 'he' ? 'כל יום' : 'Every day';
  if (dayIndices.length === 5 && [0,1,2,3,4].every(d => dayIndices.includes(d))) {
    return locale === 'he' ? 'א-ה' : 'Sun-Thu';
  }
  if (dayIndices.length === 6 && [0,1,2,3,4,5].every(d => dayIndices.includes(d))) {
    return locale === 'he' ? 'א-ו' : 'Sun-Fri';
  }
  return dayIndices.map(d => dayName(new Date(2024, 0, 7 + d), locale, true)).join(', ');
}
