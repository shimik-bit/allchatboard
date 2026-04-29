import type { Theme } from './types';

/**
 * Default neutral theme. Used for workspaces with vertical='general'
 * (no vertical specified) — the existing product UI.
 *
 * Colors picked to match the existing brand-purple identity that's
 * already throughout the app, so general workspaces look unchanged.
 */
export const generalTheme: Theme = {
  vertical: 'general',
  displayName: 'כללי',
  tagline: 'מערכת גמישה לכל סוג עסק',
  icon: '✨',

  colors: {
    primary:     '#7c3aed',  // brand purple
    primaryDark: '#6d28d9',
    primaryTint: '#f3eafe',
    accent:      '#ec4899',  // pink accent
    primaryText: '#ffffff',
    background:  '#fafafa',
    surface:     '#ffffff',
    textBody:    '#1f2937',
    textMuted:   '#6b7280',
    border:      '#e5e7eb',
  },

  typography: {
    displayFont: '"Assistant", system-ui, sans-serif',
    bodyFont:    '"Assistant", system-ui, sans-serif',
    fontsUrl:    'https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;500;600;700;800&display=swap',
  },

  shape: {
    radiusLarge:  '0.75rem',  // 12px
    radiusSmall:  '0.5rem',   // 8px
    shadowStyle:  'soft',
  },

  microcopy: {
    greeting: (name: string) => `שלום ${name}`,
    subgreeting: ({ hour }) => {
      if (hour < 12) return 'בוקר טוב';
      if (hour < 18) return 'צהריים טובים';
      return 'ערב טוב';
    },
    emptyTable:    'אין רשומות עדיין',
    emptyRecords:  'הטבלה ריקה. לחץ על "חדש" להוספת הרשומה הראשונה.',
    recordsLabel:  { singular: 'רשומה', plural: 'רשומות' },
    createNew:     'חדש',
  },
};
