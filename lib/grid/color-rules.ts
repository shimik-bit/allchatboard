/**
 * Conditional formatting for table cells.
 *
 * A field's config can include `color_rules` — an ordered list of conditions.
 * The first matching rule wins. Each rule has:
 *   - operator: how to compare the cell value
 *   - value (or value2 for between): comparison operand(s)
 *   - bg / text: colors to apply
 *
 * Stored on `fields.config.color_rules`. Evaluated in pure code so it works
 * on the server, in tests, and in any view (Grid / Kanban / Gallery / etc.).
 */

export type ColorRuleOperator =
  | 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq'
  | 'between'
  | 'contains' | 'not_contains'
  | 'starts_with' | 'ends_with'
  | 'is_empty' | 'is_not_empty'
  | 'is_true' | 'is_false';

export interface ColorRule {
  operator: ColorRuleOperator;
  value?: string | number | boolean | null;
  value2?: string | number | null; // only for 'between'
  bg?: string;   // tailwind-friendly hex, e.g. '#dcfce7' (green-100)
  text?: string; // optional text color
  /** Optional rule label, shown in the editor UI. */
  label?: string;
}

export interface ColorStyle {
  backgroundColor?: string;
  color?: string;
}

/** Coerce any cell value to a number where possible. Returns NaN if not. */
function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === '') return NaN;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
}

/** Lower-case string view of any value. */
function toStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).toLowerCase();
}

/**
 * Test a single rule against a value. Returns true if the rule matches.
 * Mismatched-type comparisons return false (rule simply does not apply),
 * never throw — color rules must never crash the grid.
 */
export function ruleMatches(rule: ColorRule, raw: unknown): boolean {
  const op = rule.operator;

  // Empty-checks work on any type
  if (op === 'is_empty')     return raw === null || raw === undefined || raw === '';
  if (op === 'is_not_empty') return !(raw === null || raw === undefined || raw === '');
  if (op === 'is_true')      return raw === true;
  if (op === 'is_false')     return raw === false;

  // Numeric ops
  if (op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte' || op === 'between') {
    const n = toNumber(raw);
    if (Number.isNaN(n)) return false;
    const a = toNumber(rule.value);
    if (Number.isNaN(a)) return false;
    if (op === 'gt')  return n >  a;
    if (op === 'gte') return n >= a;
    if (op === 'lt')  return n <  a;
    if (op === 'lte') return n <= a;
    // between
    const b = toNumber(rule.value2);
    if (Number.isNaN(b)) return false;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return n >= lo && n <= hi;
  }

  // Equality is type-agnostic — compare as strings to avoid false negatives
  // between number 5 and string "5" coming from select-options.
  if (op === 'eq')  return toStr(raw) === toStr(rule.value);
  if (op === 'neq') return toStr(raw) !== toStr(rule.value);

  // String containment ops (case-insensitive)
  if (op === 'contains')     return toStr(raw).includes(toStr(rule.value));
  if (op === 'not_contains') return !toStr(raw).includes(toStr(rule.value));
  if (op === 'starts_with')  return toStr(raw).startsWith(toStr(rule.value));
  if (op === 'ends_with')    return toStr(raw).endsWith(toStr(rule.value));

  return false;
}

/**
 * Walk the rules in order, return the first matching rule's style. Returns
 * an empty object if no rule matches (callers can spread with no effect).
 */
export function evalColorRules(rules: ColorRule[] | undefined, value: unknown): ColorStyle {
  if (!rules || rules.length === 0) return {};
  for (const rule of rules) {
    if (ruleMatches(rule, value)) {
      const out: ColorStyle = {};
      if (rule.bg)   out.backgroundColor = rule.bg;
      if (rule.text) out.color = rule.text;
      return out;
    }
  }
  return {};
}

/** Curated palette shown in the rule editor — wide enough to be useful, narrow
 *  enough to keep the UI from becoming a paint store. Each pair is bg/text
 *  pre-balanced for readability. */
export const COLOR_SWATCHES: { name: string; bg: string; text: string }[] = [
  { name: 'green',  bg: '#dcfce7', text: '#166534' },
  { name: 'amber',  bg: '#fef3c7', text: '#92400e' },
  { name: 'red',    bg: '#fee2e2', text: '#991b1b' },
  { name: 'blue',   bg: '#dbeafe', text: '#1e40af' },
  { name: 'purple', bg: '#f3e8ff', text: '#6b21a8' },
  { name: 'pink',   bg: '#fce7f3', text: '#9f1239' },
  { name: 'gray',   bg: '#f3f4f6', text: '#374151' },
  { name: 'cyan',   bg: '#cffafe', text: '#155e75' },
];

/** Operators that need a second value input (only between, today). */
export function operatorNeedsSecondValue(op: ColorRuleOperator): boolean {
  return op === 'between';
}

/** Operators that don't need any value input (is_empty / is_true / etc). */
export function operatorNeedsNoValue(op: ColorRuleOperator): boolean {
  return op === 'is_empty' || op === 'is_not_empty' || op === 'is_true' || op === 'is_false';
}

/** Group operators by which field types they make sense on. The editor uses
 *  this to filter the operator dropdown. */
export const OPERATORS_FOR_FIELD_TYPE: Record<string, ColorRuleOperator[]> = {
  number:    ['gt', 'gte', 'lt', 'lte', 'between', 'eq', 'neq', 'is_empty', 'is_not_empty'],
  currency:  ['gt', 'gte', 'lt', 'lte', 'between', 'eq', 'neq', 'is_empty', 'is_not_empty'],
  rating:    ['gt', 'gte', 'lt', 'lte', 'between', 'eq', 'neq', 'is_empty', 'is_not_empty'],
  text:      ['contains', 'not_contains', 'starts_with', 'ends_with', 'eq', 'neq', 'is_empty', 'is_not_empty'],
  longtext:  ['contains', 'not_contains', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty'],
  email:     ['contains', 'eq', 'neq', 'is_empty', 'is_not_empty'],
  url:       ['contains', 'eq', 'neq', 'is_empty', 'is_not_empty'],
  phone:     ['contains', 'eq', 'neq', 'is_empty', 'is_not_empty'],
  select:    ['eq', 'neq', 'is_empty', 'is_not_empty'],
  status:    ['eq', 'neq', 'is_empty', 'is_not_empty'],
  multiselect: ['contains', 'not_contains', 'is_empty', 'is_not_empty'],
  checkbox:  ['is_true', 'is_false'],
  date:      ['eq', 'neq', 'is_empty', 'is_not_empty'],
  datetime:  ['eq', 'neq', 'is_empty', 'is_not_empty'],
};

export function operatorsForFieldType(fieldType: string): ColorRuleOperator[] {
  return OPERATORS_FOR_FIELD_TYPE[fieldType] || ['eq', 'neq', 'is_empty', 'is_not_empty'];
}
