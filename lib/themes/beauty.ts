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
    // Tailwind brand palette - dusty rose family.
    // Each shade is the equivalent saturation/lightness step of the primary
    // color so existing brand-50/brand-700 etc. all read as a coherent rose
    // ramp. Generated via HSL adjustment, not just darken/lighten of one hex.
    brandPalette: {
      '50':  '253 242 239', // #fdf2ef - barely tinted cream
      '100': '251 228 221', // #fbe4dd - very soft blush
      '400': '201 113 149', // #c97195 - mid rose
      '500': '168 82 122',  // #a8527a - the primary
      '600': '138 63 99',   // #8a3f63 - hover state
      '700': '106 47 76',   // #6a2f4c - deep wine rose
      '900': '60 23 41',    // #3c1729 - near-black wine
    },
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
