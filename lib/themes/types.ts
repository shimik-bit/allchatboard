/**
 * Theme system types
 *
 * A theme is a complete visual + textual identity for a vertical.
 * It defines:
 *   - colors (resolved via CSS variables at runtime)
 *   - typography (font family + display font for headings)
 *   - shape (border radius, shadows)
 *   - microcopy (greetings, empty states, action labels)
 *
 * Themes are *applied at the workspace level*. When a user opens
 * a workspace with vertical='beauty', the dashboard wraps in
 * <ThemeProvider theme={beautyTheme}> which sets CSS vars and
 * exposes microcopy via context.
 */

import type { Vertical } from './verticals';

export interface ThemeColors {
  /** Primary brand color - used for CTAs, links, badges */
  primary: string;
  /** Slightly darker primary - hover states */
  primaryDark: string;
  /** Soft tint of primary - backgrounds, borders */
  primaryTint: string;
  /** Secondary accent - secondary CTAs, highlights */
  accent: string;
  /** Text on primary backgrounds */
  primaryText: string;
  /** Page background base - usually neutral but verticals can shift */
  background: string;
  /** Card/surface background */
  surface: string;
  /** Body text */
  textBody: string;
  /** Muted text (helpers, labels) */
  textMuted: string;
  /** Border color */
  border: string;
}

export interface ThemeTypography {
  /** Display font for headings - the personality marker */
  displayFont: string;
  /** Body font - readable, neutral */
  bodyFont: string;
  /** Optional mono font for numbers (mainly finance) */
  monoFont?: string;
  /** Google Fonts URL to load */
  fontsUrl: string;
}

export interface ThemeShape {
  /** Border radius for cards and large containers */
  radiusLarge: string;
  /** Border radius for buttons and small elements */
  radiusSmall: string;
  /** Shadow style: 'soft' | 'sharp' | 'none' */
  shadowStyle: 'soft' | 'sharp' | 'none';
}

export interface ThemeMicrocopy {
  /** Greeting in dashboard header. {name} is replaced with user name */
  greeting: (name: string) => string;
  /** Subgreeting / context line */
  subgreeting?: (data: { hour: number; appointmentsToday?: number }) => string;
  /** Generic empty state for tables */
  emptyTable: string;
  /** Empty state for the records list */
  emptyRecords: string;
  /** What to call "records" in this vertical (for buttons, headers) */
  recordsLabel: { singular: string; plural: string };
  /** Generic "create new" CTA */
  createNew: string;
}

export interface Theme {
  vertical: Vertical;
  /** Display name shown in settings dropdown */
  displayName: string;
  /** Short tagline for the picker UI */
  tagline: string;
  /** Emoji that represents this vertical */
  icon: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  shape: ThemeShape;
  microcopy: ThemeMicrocopy;
}
