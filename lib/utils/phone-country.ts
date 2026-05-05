/**
 * Phone country resolver
 * =======================
 * Maps a phone number (without leading + or 00) to its country.
 *
 * The phone numbers we get from Green API arrive in E.164-without-plus format,
 * e.g. "972556691165". We need to identify the country code at the start of
 * the string in order to display a flag + country name beside the phone.
 *
 * Implementation note: country codes are NOT a fixed length — most are 1-3
 * digits, but some are 4 (e.g. 1264 for Anguilla which shares "1" with the US
 * and Canada). The right way to do this is longest-prefix-match: try the
 * 4-digit prefix first, then 3, then 2, then 1.
 *
 * We don't ship the full ITU-T E.164 list (300+ entries) — we keep the most
 * common prefixes a typical Israeli WhatsApp business workspace will see,
 * with a fallback to "Unknown" for unrecognized prefixes. Adding more is a
 * one-line change here.
 */

export type PhoneCountry = {
  code: string;       // The matched dialing prefix (e.g. "972")
  name: string;       // Localized country name in Hebrew
  nameEn: string;     // English country name
  flag: string;       // Emoji flag
};

// Most-common prefixes for an Israeli/Middle-East WhatsApp business context.
// Ordered roughly by likelihood — but lookup is via the table below, not order.
const COUNTRIES: PhoneCountry[] = [
  // Israel and immediate neighbors
  { code: '972',  name: 'ישראל',           nameEn: 'Israel',          flag: '🇮🇱' },
  { code: '970',  name: 'הרשות הפלסטינית',  nameEn: 'Palestinian Authority', flag: '🇵🇸' },
  { code: '20',   name: 'מצרים',            nameEn: 'Egypt',           flag: '🇪🇬' },
  { code: '962',  name: 'ירדן',             nameEn: 'Jordan',          flag: '🇯🇴' },
  { code: '961',  name: 'לבנון',            nameEn: 'Lebanon',         flag: '🇱🇧' },
  { code: '963',  name: 'סוריה',            nameEn: 'Syria',           flag: '🇸🇾' },

  // North America (note: 1 is the longest "single-digit" prefix and many
  // territories use 1+3-digit area codes, but for country identification "1"
  // is enough here — we don't need to distinguish Canada from US for display)
  { code: '1',    name: 'ארה"ב / קנדה',     nameEn: 'USA / Canada',    flag: '🇺🇸' },

  // Europe — common business diaspora destinations
  { code: '44',   name: 'בריטניה',          nameEn: 'United Kingdom',  flag: '🇬🇧' },
  { code: '33',   name: 'צרפת',             nameEn: 'France',          flag: '🇫🇷' },
  { code: '49',   name: 'גרמניה',           nameEn: 'Germany',         flag: '🇩🇪' },
  { code: '34',   name: 'ספרד',             nameEn: 'Spain',           flag: '🇪🇸' },
  { code: '39',   name: 'איטליה',           nameEn: 'Italy',           flag: '🇮🇹' },
  { code: '31',   name: 'הולנד',            nameEn: 'Netherlands',     flag: '🇳🇱' },
  { code: '32',   name: 'בלגיה',            nameEn: 'Belgium',         flag: '🇧🇪' },
  { code: '41',   name: 'שווייץ',           nameEn: 'Switzerland',     flag: '🇨🇭' },
  { code: '43',   name: 'אוסטריה',          nameEn: 'Austria',         flag: '🇦🇹' },
  { code: '46',   name: 'שוודיה',           nameEn: 'Sweden',          flag: '🇸🇪' },
  { code: '47',   name: 'נורווגיה',         nameEn: 'Norway',          flag: '🇳🇴' },
  { code: '45',   name: 'דנמרק',            nameEn: 'Denmark',         flag: '🇩🇰' },
  { code: '358',  name: 'פינלנד',           nameEn: 'Finland',         flag: '🇫🇮' },
  { code: '7',    name: 'רוסיה',            nameEn: 'Russia',          flag: '🇷🇺' },
  { code: '380',  name: 'אוקראינה',         nameEn: 'Ukraine',         flag: '🇺🇦' },
  { code: '48',   name: 'פולין',            nameEn: 'Poland',          flag: '🇵🇱' },
  { code: '420',  name: 'צ\'כיה',           nameEn: 'Czech Republic',  flag: '🇨🇿' },
  { code: '30',   name: 'יוון',             nameEn: 'Greece',          flag: '🇬🇷' },
  { code: '90',   name: 'טורקיה',           nameEn: 'Turkey',          flag: '🇹🇷' },

  // Gulf / Middle East business hubs
  { code: '971',  name: 'איחוד האמירויות',   nameEn: 'UAE',             flag: '🇦🇪' },
  { code: '966',  name: 'ערב הסעודית',       nameEn: 'Saudi Arabia',    flag: '🇸🇦' },
  { code: '974',  name: 'קטאר',             nameEn: 'Qatar',           flag: '🇶🇦' },
  { code: '973',  name: 'בחריין',           nameEn: 'Bahrain',         flag: '🇧🇭' },
  { code: '965',  name: 'כווית',            nameEn: 'Kuwait',          flag: '🇰🇼' },
  { code: '968',  name: 'עומאן',            nameEn: 'Oman',            flag: '🇴🇲' },
  { code: '964',  name: 'עיראק',            nameEn: 'Iraq',            flag: '🇮🇶' },
  { code: '98',   name: 'איראן',            nameEn: 'Iran',            flag: '🇮🇷' },

  // Asia
  { code: '86',   name: 'סין',              nameEn: 'China',           flag: '🇨🇳' },
  { code: '81',   name: 'יפן',              nameEn: 'Japan',           flag: '🇯🇵' },
  { code: '82',   name: 'דרום קוריאה',      nameEn: 'South Korea',     flag: '🇰🇷' },
  { code: '91',   name: 'הודו',             nameEn: 'India',           flag: '🇮🇳' },
  { code: '62',   name: 'אינדונזיה',        nameEn: 'Indonesia',       flag: '🇮🇩' },
  { code: '66',   name: 'תאילנד',           nameEn: 'Thailand',        flag: '🇹🇭' },
  { code: '84',   name: 'וייטנאם',          nameEn: 'Vietnam',         flag: '🇻🇳' },
  { code: '60',   name: 'מלזיה',            nameEn: 'Malaysia',        flag: '🇲🇾' },
  { code: '65',   name: 'סינגפור',          nameEn: 'Singapore',       flag: '🇸🇬' },
  { code: '63',   name: 'הפיליפינים',       nameEn: 'Philippines',     flag: '🇵🇭' },

  // Latin America
  { code: '52',   name: 'מקסיקו',           nameEn: 'Mexico',          flag: '🇲🇽' },
  { code: '55',   name: 'ברזיל',            nameEn: 'Brazil',          flag: '🇧🇷' },
  { code: '54',   name: 'ארגנטינה',         nameEn: 'Argentina',       flag: '🇦🇷' },
  { code: '56',   name: 'צ\'ילה',           nameEn: 'Chile',           flag: '🇨🇱' },
  { code: '57',   name: 'קולומביה',         nameEn: 'Colombia',        flag: '🇨🇴' },

  // Africa
  { code: '27',   name: 'דרום אפריקה',      nameEn: 'South Africa',    flag: '🇿🇦' },
  { code: '254',  name: 'קניה',             nameEn: 'Kenya',           flag: '🇰🇪' },
  { code: '234',  name: 'ניגריה',           nameEn: 'Nigeria',         flag: '🇳🇬' },
  { code: '212',  name: 'מרוקו',            nameEn: 'Morocco',         flag: '🇲🇦' },
  { code: '216',  name: 'תוניסיה',          nameEn: 'Tunisia',         flag: '🇹🇳' },

  // Oceania
  { code: '61',   name: 'אוסטרליה',         nameEn: 'Australia',       flag: '🇦🇺' },
  { code: '64',   name: 'ניו זילנד',        nameEn: 'New Zealand',     flag: '🇳🇿' },
];

// Pre-build lookup maps by prefix length, so we can do O(1) longest-prefix-match.
// Note: max prefix length we currently handle is 3.
const BY_LENGTH: Map<number, Map<string, PhoneCountry>> = (() => {
  const m = new Map<number, Map<string, PhoneCountry>>();
  for (const c of COUNTRIES) {
    const len = c.code.length;
    if (!m.has(len)) m.set(len, new Map());
    m.get(len)!.set(c.code, c);
  }
  return m;
})();

const SORTED_LENGTHS: number[] = [...BY_LENGTH.keys()].sort((a, b) => b - a);

/**
 * Resolve a phone number to its country. Phone should be a digit-only string
 * (e.g. "972556691165"). Returns null if no prefix matches.
 *
 * Longest-prefix-match: tries 4-digit prefix first, then 3, then 2, then 1.
 * This matters for cases like "1XXX" (US/Canada) vs "1264" (Anguilla) — if
 * we ever add 4-digit codes the algorithm already supports them correctly.
 */
export function resolvePhoneCountry(phone: string | null | undefined): PhoneCountry | null {
  if (!phone) return null;
  // Keep digits only — defensive in case the caller forgot to strip "+"
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return null; // too short to have country code + a real number

  for (const len of SORTED_LENGTHS) {
    const prefix = digits.slice(0, len);
    const match = BY_LENGTH.get(len)?.get(prefix);
    if (match) return match;
  }

  return null;
}
