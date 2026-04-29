'use client';

/**
 * ThemeProvider - applies a vertical theme to the dashboard
 *
 * Two responsibilities:
 *   1. Inject CSS variables for colors/shape so any component can read them
 *      (e.g. var(--theme-primary), var(--theme-radius-large))
 *   2. Load the theme's Google Fonts URL via a <link> tag
 *   3. Expose the full theme object via React context so components can
 *      read microcopy/icons programmatically
 *
 * To use:
 *   <ThemeProvider theme={beautyTheme}>
 *     <YourDashboardContent />
 *   </ThemeProvider>
 *
 * Then components can do:
 *   const { theme, microcopy } = useTheme();
 *   <h1>{microcopy.greeting('שימי')}</h1>
 *   <button style={{ background: 'var(--theme-primary)' }}>...</button>
 */

import { createContext, useContext, useEffect } from 'react';
import type { Theme } from './types';
import { generalTheme } from './general';

const ThemeContext = createContext<Theme>(generalTheme);

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * Convenience: just the microcopy. Most components only need the strings.
 */
export function useMicrocopy() {
  return useContext(ThemeContext).microcopy;
}

interface ThemeProviderProps {
  theme: Theme;
  children: React.ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  // Inject the Google Fonts <link> for this theme's fonts. We add a
  // <link> tag dynamically so we don't have to load every theme's fonts
  // on every page.
  useEffect(() => {
    const id = `theme-fonts-${theme.vertical}`;
    if (document.getElementById(id)) return; // already loaded

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = theme.typography.fontsUrl;
    document.head.appendChild(link);

    // Fonts persist across navigation - we deliberately don't remove on unmount
    // because re-loading them on every workspace switch would be wasteful.
  }, [theme]);

  // Compose CSS variables for the theme. These are inherited by all
  // descendants so any component can read them via var(--theme-X).
  const cssVars: React.CSSProperties = {
    // Colors
    ['--theme-primary' as any]:        theme.colors.primary,
    ['--theme-primary-dark' as any]:   theme.colors.primaryDark,
    ['--theme-primary-tint' as any]:   theme.colors.primaryTint,
    ['--theme-accent' as any]:         theme.colors.accent,
    ['--theme-primary-text' as any]:   theme.colors.primaryText,
    ['--theme-background' as any]:     theme.colors.background,
    ['--theme-surface' as any]:        theme.colors.surface,
    ['--theme-text-body' as any]:      theme.colors.textBody,
    ['--theme-text-muted' as any]:     theme.colors.textMuted,
    ['--theme-border' as any]:         theme.colors.border,
    // Shape
    ['--theme-radius-large' as any]:   theme.shape.radiusLarge,
    ['--theme-radius-small' as any]:   theme.shape.radiusSmall,
    // Typography
    ['--theme-font-display' as any]:   theme.typography.displayFont,
    ['--theme-font-body' as any]:      theme.typography.bodyFont,
    fontFamily: theme.typography.bodyFont,
  };

  return (
    <ThemeContext.Provider value={theme}>
      <div style={cssVars} className="theme-root contents">
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
