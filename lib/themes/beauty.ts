import type { Theme } from './types';

/**
 * Beauty vertical theme - cosmeticians, salons, spas.
 *
 * Visual direction: soft + organic + feminine.
 * Palette: dusty rose primary with cream surface and lavender accent.
 * Typography: Fraunces (display) for warmth + Plus Jakarta Sans (body).
 *
 * The colors are deliberately desaturated — beauty professionals work
 * with skin tones and color all day, so we keep the *interface* calm.
 * Never use bright/saturated pinks; that reads as "fast-fashion app",
 * not "professional studio".
 *
 * Microcopy is warm and personal: "החמודות שלך", "היום שלך",
 * never the cold "records" / "items" / "data".
 */
export const beautyTheme: Theme = {
  vertical: 'beauty',
  displayName: 'יופי וקוסמטיקה',
  tagline: 'לקוסמטיקאיות, מעצבי שיער, וסטודיואים',
  icon: '💅',

  colors: {
    primary:     '#a8527a',  // dusty rose - mature, not fast-fashion
    primaryDark: '#8a3f63',
    primaryTint: '#fdf2ef',
    accent:      '#d987af',  // soft pink accent
    primaryText: '#ffffff',
    background:  '#fdf8f6',  // warm cream
    surface:     '#ffffff',
    textBody:    '#3d2535',  // deep wine, softer than black
    textMuted:   '#8a6b78',
    border:      '#f5e0d8',
  },

  typography: {
    // Fraunces with SOFT axis variation gives serif warmth without being stiff
    displayFont: '"Fraunces", Georgia, serif',
    bodyFont:    '"Plus Jakarta Sans", system-ui, sans-serif',
    fontsUrl:    'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,300..700,30..100&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
  },

  shape: {
    radiusLarge:  '1.5rem',   // 24px - very rounded, "soft"
    radiusSmall:  '0.875rem', // 14px
    shadowStyle:  'soft',
  },

  microcopy: {
    greeting: (name: string) => `שלום ${name}`,
    subgreeting: ({ hour, appointmentsToday }) => {
      const time = hour < 12 ? 'בוקר טוב' : hour < 18 ? 'צהריים טובים' : 'ערב טוב';
      if (appointmentsToday && appointmentsToday > 0) {
        return `${time} ✨ יש לך ${appointmentsToday} פגישות היום`;
      }
      return `${time} ✨`;
    },
    emptyTable:    'עוד אין כלום פה',
    emptyRecords:  'הטבלה מחכה להמלא בחמודות שלך 💖 לחצי על "חדש" להוספה.',
    recordsLabel:  { singular: 'פריט', plural: 'פריטים' },
    createNew:     'הוספה חדשה',
  },
};
