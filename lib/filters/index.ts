/**
 * Table Filter Logic
 *
 * Defines the filter data model + a client-side evaluator that applies
 * filters to record arrays. The filters jsonb format is designed to also
 * be translatable to SQL (in a future migration) for server-side filtering
 * on large tables.
 *
 * Filter format (stored in views.filters jsonb):
 *
 *   {
 *     "operator": "and",            // top-level AND/OR (always "and" for now)
 *     "conditions": [
 *       {
 *         "field_slug": "amount",
 *         "operator": "greater_than",
 *         "value": 100
 *       },
 *       {
 *         "field_slug": "status",
 *         "operator": "is_any_of",
 *         "value": ["approved", "paid"]
 *       },
 *       {
 *         "field_slug": "date",
 *         "operator": "is_this_month"
 *         // some operators don't need a value
 *       }
 *     ]
 *   }
 */

import type { FieldType, RecordRow } from '@/lib/types/database';

// ============================================================================
// Operator catalog — which operators are available for each field type
// ============================================================================
export type FilterOperator =
  // text
  | 'contains' | 'not_contains' | 'equals' | 'not_equals'
  | 'starts_with' | 'ends_with'
  | 'is_empty' | 'is_not_empty'
  // select / status / relation
  | 'is_any_of' | 'is_none_of'
  // numeric
  | 'greater_than' | 'less_than'
  | 'greater_or_equal' | 'less_or_equal'
  | 'between'
  // date
  | 'on' | 'before' | 'after' | 'date_between'
  | 'is_today' | 'is_yesterday' | 'is_tomorrow'
  | 'is_this_week' | 'is_this_month' | 'is_this_year'
  | 'is_last_week' | 'is_last_month'
  | 'is_in_next_days' | 'is_in_last_days'
  // boolean
  | 'is_checked' | 'is_unchecked';

export interface FilterCondition {
  field_slug: string;
  operator: FilterOperator;
  // Some operators don't need a value (e.g. is_empty, is_today).
  // Some need a single value, others need an array (between, is_any_of).
  value?: any;
}

export interface FilterGroup {
  operator: 'and' | 'or';
  conditions: FilterCondition[];
}

// ============================================================================
// Operators available per field type — used by the UI to show only relevant
// operators in the dropdown
// ============================================================================
const OPERATORS_BY_TYPE: Record<string, FilterOperator[]> = {
  text:       ['contains', 'not_contains', 'equals', 'not_equals', 'starts_with', 'ends_with', 'is_empty', 'is_not_empty'],
  longtext:   ['contains', 'not_contains', 'is_empty', 'is_not_empty'],
  email:      ['contains', 'equals', 'not_equals', 'is_empty', 'is_not_empty'],
  phone:      ['contains', 'equals', 'is_empty', 'is_not_empty'],
  url:        ['contains', 'equals', 'is_empty', 'is_not_empty'],
  city:       ['equals', 'not_equals', 'is_empty', 'is_not_empty'],

  number:     ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal', 'between', 'is_empty', 'is_not_empty'],
  currency:   ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_or_equal', 'less_or_equal', 'between', 'is_empty', 'is_not_empty'],
  rating:     ['equals', 'greater_than', 'less_than', 'is_empty'],

  select:       ['is_any_of', 'is_none_of', 'is_empty', 'is_not_empty'],
  status:       ['is_any_of', 'is_none_of', 'is_empty', 'is_not_empty'],
  multiselect:  ['is_any_of', 'is_none_of', 'is_empty', 'is_not_empty'],
  relation:     ['is_any_of', 'is_none_of', 'is_empty', 'is_not_empty'],
  user:         ['is_any_of', 'is_none_of', 'is_empty', 'is_not_empty'],

  date:       ['on', 'before', 'after', 'date_between', 'is_today', 'is_yesterday', 'is_tomorrow', 'is_this_week', 'is_this_month', 'is_this_year', 'is_last_week', 'is_last_month', 'is_in_next_days', 'is_in_last_days', 'is_empty', 'is_not_empty'],
  datetime:   ['on', 'before', 'after', 'date_between', 'is_today', 'is_yesterday', 'is_tomorrow', 'is_this_week', 'is_this_month', 'is_this_year', 'is_last_week', 'is_last_month', 'is_in_next_days', 'is_in_last_days', 'is_empty', 'is_not_empty'],

  checkbox:   ['is_checked', 'is_unchecked'],

  attachment: ['is_empty', 'is_not_empty'],
};

export function getOperatorsForType(type: FieldType): FilterOperator[] {
  return OPERATORS_BY_TYPE[type] || ['equals', 'not_equals', 'is_empty', 'is_not_empty'];
}

// ============================================================================
// Hebrew labels for operators (for UI display)
// ============================================================================
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains:         'מכיל',
  not_contains:     'לא מכיל',
  equals:           'שווה ל',
  not_equals:       'לא שווה ל',
  starts_with:      'מתחיל ב',
  ends_with:        'מסתיים ב',
  is_empty:         'ריק',
  is_not_empty:     'לא ריק',

  is_any_of:        'הוא אחד מ',
  is_none_of:       'אינו אחד מ',

  greater_than:     'גדול מ',
  less_than:        'קטן מ',
  greater_or_equal: 'גדול או שווה',
  less_or_equal:    'קטן או שווה',
  between:          'בין',

  on:               'בתאריך',
  before:           'לפני',
  after:            'אחרי',
  date_between:     'בין תאריכים',
  is_today:         'היום',
  is_yesterday:     'אתמול',
  is_tomorrow:      'מחר',
  is_this_week:     'השבוע',
  is_this_month:    'החודש',
  is_this_year:     'השנה',
  is_last_week:     'שבוע שעבר',
  is_last_month:    'חודש שעבר',
  is_in_next_days:  'ב-X הימים הבאים',
  is_in_last_days:  'ב-X הימים האחרונים',

  is_checked:       'מסומן',
  is_unchecked:     'לא מסומן',
};

// Operators that don't need a value input
export const NO_VALUE_OPERATORS = new Set<FilterOperator>([
  'is_empty', 'is_not_empty',
  'is_today', 'is_yesterday', 'is_tomorrow',
  'is_this_week', 'is_this_month', 'is_this_year',
  'is_last_week', 'is_last_month',
  'is_checked', 'is_unchecked',
]);

// Operators that need an array value (multi-select)
export const ARRAY_VALUE_OPERATORS = new Set<FilterOperator>([
  'is_any_of', 'is_none_of', 'between', 'date_between',
]);

// ============================================================================
// Evaluator: apply a FilterGroup to a list of records
// ============================================================================
export function applyFilters(records: RecordRow[], filters: FilterGroup | null): RecordRow[] {
  if (!filters || !filters.conditions || filters.conditions.length === 0) {
    return records;
  }

  return records.filter((record) => evaluateGroup(record, filters));
}

function evaluateGroup(record: RecordRow, group: FilterGroup): boolean {
  if (group.conditions.length === 0) return true;

  if (group.operator === 'and') {
    return group.conditions.every((c) => evaluateCondition(record, c));
  } else {
    return group.conditions.some((c) => evaluateCondition(record, c));
  }
}

function evaluateCondition(record: RecordRow, cond: FilterCondition): boolean {
  const data = record.data || {};
  const fieldValue = data[cond.field_slug];

  switch (cond.operator) {
    // ===== Empty checks =====
    case 'is_empty':
      return isEmpty(fieldValue);
    case 'is_not_empty':
      return !isEmpty(fieldValue);

    // ===== Text =====
    case 'contains':
      return strIncludes(fieldValue, cond.value);
    case 'not_contains':
      return !strIncludes(fieldValue, cond.value);
    case 'equals':
      return strEqualsCi(fieldValue, cond.value);
    case 'not_equals':
      return !strEqualsCi(fieldValue, cond.value);
    case 'starts_with':
      return String(fieldValue ?? '').toLowerCase().startsWith(String(cond.value ?? '').toLowerCase());
    case 'ends_with':
      return String(fieldValue ?? '').toLowerCase().endsWith(String(cond.value ?? '').toLowerCase());

    // ===== Multi-value =====
    case 'is_any_of': {
      if (!Array.isArray(cond.value) || cond.value.length === 0) return true;
      // Field value can itself be an array (multiselect, relation many=true)
      if (Array.isArray(fieldValue)) {
        return fieldValue.some((v) => cond.value.includes(v));
      }
      return cond.value.includes(fieldValue);
    }
    case 'is_none_of': {
      if (!Array.isArray(cond.value) || cond.value.length === 0) return true;
      if (Array.isArray(fieldValue)) {
        return !fieldValue.some((v) => cond.value.includes(v));
      }
      return !cond.value.includes(fieldValue);
    }

    // ===== Numeric =====
    case 'greater_than':
      return Number(fieldValue) > Number(cond.value);
    case 'less_than':
      return Number(fieldValue) < Number(cond.value);
    case 'greater_or_equal':
      return Number(fieldValue) >= Number(cond.value);
    case 'less_or_equal':
      return Number(fieldValue) <= Number(cond.value);
    case 'between': {
      if (!Array.isArray(cond.value) || cond.value.length !== 2) return true;
      const n = Number(fieldValue);
      return n >= Number(cond.value[0]) && n <= Number(cond.value[1]);
    }

    // ===== Date =====
    case 'on':
      return sameDay(fieldValue, cond.value);
    case 'before':
      return parseDate(fieldValue) < parseDate(cond.value);
    case 'after':
      return parseDate(fieldValue) > parseDate(cond.value);
    case 'date_between': {
      if (!Array.isArray(cond.value) || cond.value.length !== 2) return true;
      const d = parseDate(fieldValue);
      return d >= parseDate(cond.value[0]) && d <= parseDate(cond.value[1]);
    }
    case 'is_today':
      return sameDay(fieldValue, new Date());
    case 'is_yesterday': {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return sameDay(fieldValue, y);
    }
    case 'is_tomorrow': {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      return sameDay(fieldValue, t);
    }
    case 'is_this_week': {
      const d = parseDate(fieldValue);
      const now = new Date();
      const startOfWeek = new Date(now);
      // Israel: week starts on Sunday
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      return d >= startOfWeek && d < endOfWeek;
    }
    case 'is_last_week': {
      const d = parseDate(fieldValue);
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() - 7);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      return d >= startOfWeek && d < endOfWeek;
    }
    case 'is_this_month': {
      const d = parseDate(fieldValue);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    case 'is_last_month': {
      const d = parseDate(fieldValue);
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return d.getFullYear() === lastMonth.getFullYear() && d.getMonth() === lastMonth.getMonth();
    }
    case 'is_this_year': {
      const d = parseDate(fieldValue);
      return d.getFullYear() === new Date().getFullYear();
    }
    case 'is_in_next_days': {
      const days = Number(cond.value) || 7;
      const now = new Date();
      const future = new Date(now);
      future.setDate(now.getDate() + days);
      const d = parseDate(fieldValue);
      return d >= now && d <= future;
    }
    case 'is_in_last_days': {
      const days = Number(cond.value) || 7;
      const now = new Date();
      const past = new Date(now);
      past.setDate(now.getDate() - days);
      const d = parseDate(fieldValue);
      return d >= past && d <= now;
    }

    // ===== Checkbox =====
    case 'is_checked':
      return fieldValue === true || fieldValue === 'true';
    case 'is_unchecked':
      return fieldValue !== true && fieldValue !== 'true';

    default:
      return true; // unknown operator - don't filter out
  }
}

// ============================================================================
// Helpers
// ============================================================================
function isEmpty(v: any): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function strIncludes(field: any, search: any): boolean {
  if (isEmpty(field) || isEmpty(search)) return false;
  return String(field).toLowerCase().includes(String(search).toLowerCase());
}

function strEqualsCi(a: any, b: any): boolean {
  return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
}

function parseDate(v: any): Date {
  if (v instanceof Date) return v;
  if (!v) return new Date(NaN);
  return new Date(v);
}

function sameDay(a: any, b: any): boolean {
  const d1 = parseDate(a);
  const d2 = parseDate(b);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}
