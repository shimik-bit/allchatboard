/**
 * Theme registry
 *
 * Central place to map vertical → theme object. Add new themes here
 * after creating their definition file.
 *
 * Usage:
 *   import { getTheme } from '@/lib/themes';
 *   const theme = getTheme(workspace.vertical);
 */

import type { Vertical } from './verticals';
import type { Theme } from './types';
import { generalTheme } from './general';
import { beautyTheme } from './beauty';

const REGISTRY: Record<Vertical, Theme> = {
  general:      generalTheme,
  beauty:       beautyTheme,
  // Pending implementations - they fall back to general for now.
  // Each gets its own file when we onboard the vertical.
  finance:      generalTheme,
  construction: generalTheme,
  restaurant:   generalTheme,
  legal:        generalTheme,
};

/**
 * Get the theme object for a given vertical.
 * Falls back to general if the vertical isn't registered yet.
 */
export function getTheme(vertical: Vertical | string | null | undefined): Theme {
  if (!vertical || !(vertical in REGISTRY)) {
    return generalTheme;
  }
  return REGISTRY[vertical as Vertical];
}

export type { Theme, ThemeColors, ThemeMicrocopy } from './types';
export type { Vertical } from './verticals';
export { isVertical, VERTICAL_VALUES } from './verticals';
