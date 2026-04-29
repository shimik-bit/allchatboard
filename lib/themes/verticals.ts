/**
 * Vertical enum - mirrors the Postgres workspace_vertical type.
 *
 * Keep this in sync with the DB enum:
 *   ALTER TYPE workspace_vertical ADD VALUE 'newvertical';
 * AND add the corresponding theme object in /lib/themes/index.ts.
 */
export type Vertical =
  | 'general'
  | 'beauty'
  | 'finance'
  | 'construction'
  | 'restaurant'
  | 'legal';

export const VERTICAL_VALUES: Vertical[] = [
  'general', 'beauty', 'finance', 'construction', 'restaurant', 'legal',
];

/** Type guard for incoming string from DB */
export function isVertical(v: any): v is Vertical {
  return typeof v === 'string' && VERTICAL_VALUES.includes(v as Vertical);
}
