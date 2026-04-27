/**
 * Field aggregation system - calculates summary values for table footer rows.
 *
 * Each field type has:
 *   - A default aggregation (used if user hasn't picked one)
 *   - A list of available aggregations (shown in picker)
 *
 * The compute function takes the field config + array of record values and
 * returns a formatted display string + raw value for tooltip/sorting.
 */

import type { Field, FieldType, RecordRow } from '@/lib/types/database';

export type AggregationType =
  | 'none'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'           // total count of records
  | 'count_filled'    // count where value is non-empty
  | 'count_empty'     // count where value is empty
  | 'count_filled_pct' // % filled
  | 'count_unique'    // unique values
  | 'range'           // min - max (for dates)
  | 'distribution'    // "5 active, 3 pending, 1 done"
  | 'most_common';    // most frequent value

export type AggregationResult = {
  display: string;        // "₪ 12,450" or "5 פעילים"
  detail?: string;        // Tooltip detail
  raw?: number | string;  // Underlying value
};

// ─── Field type → default + available aggregations ──────────────────────────

export const AGGREGATIONS_BY_TYPE: Record<FieldType, {
  default: AggregationType;
  available: AggregationType[];
}> = {
  number:      { default: 'sum',          available: ['sum', 'avg', 'min', 'max', 'count_filled', 'none'] },
  currency:    { default: 'sum',          available: ['sum', 'avg', 'min', 'max', 'count_filled', 'none'] },
  rating:      { default: 'avg',          available: ['avg', 'sum', 'min', 'max', 'count_filled', 'none'] },
  date:        { default: 'range',        available: ['range', 'min', 'max', 'count_filled', 'none'] },
  datetime:    { default: 'range',        available: ['range', 'min', 'max', 'count_filled', 'none'] },
  text:        { default: 'count_filled', available: ['count_filled', 'count_empty', 'count_unique', 'none'] },
  longtext:    { default: 'count_filled', available: ['count_filled', 'count_empty', 'none'] },
  email:       { default: 'count_filled', available: ['count_filled', 'count_unique', 'count_filled_pct', 'none'] },
  phone:       { default: 'count_filled', available: ['count_filled', 'count_unique', 'count_filled_pct', 'none'] },
  url:         { default: 'count_filled', available: ['count_filled', 'count_unique', 'none'] },
  city:        { default: 'most_common',  available: ['most_common', 'count_unique', 'count_filled', 'none'] },
  select:      { default: 'distribution', available: ['distribution', 'most_common', 'count_unique', 'none'] },
  multiselect: { default: 'distribution', available: ['distribution', 'count_unique', 'none'] },
  status:      { default: 'distribution', available: ['distribution', 'most_common', 'none'] },
  checkbox:    { default: 'count_filled', available: ['count_filled', 'count_empty', 'count_filled_pct', 'none'] },
  user:        { default: 'count_unique', available: ['count_unique', 'most_common', 'none'] },
  attachment:  { default: 'count_filled', available: ['count_filled', 'count_filled_pct', 'none'] },
  relation:    { default: 'count_filled', available: ['count_filled', 'count_unique', 'none'] },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isEmpty(v: any): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return true;
  return false;
}

function toNumber(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatNumber(n: number, locale: string = 'he-IL'): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: n < 100 ? 2 : 0,
  }).format(n);
}

function formatCurrency(n: number, currency: string = '₪'): string {
  return `${currency} ${formatNumber(n)}`;
}

function formatDate(s: string | null): string {
  if (!s) return '';
  try {
    return new Date(s).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch { return s; }
}

// ─── Main API ────────────────────────────────────────────────────────────────

/**
 * Get the effective aggregation for a field (user's choice or default).
 */
export function getEffectiveAggregation(field: Field): AggregationType {
  const userChoice = (field as any).summary_aggregation as AggregationType | null | undefined;
  if (userChoice) return userChoice;
  return AGGREGATIONS_BY_TYPE[field.type]?.default || 'none';
}

/**
 * Get all available aggregations for a field type (for the picker).
 */
export function getAvailableAggregations(fieldType: FieldType): AggregationType[] {
  return AGGREGATIONS_BY_TYPE[fieldType]?.available || ['none'];
}

/**
 * Human label for an aggregation type (in Hebrew - i18n later if needed).
 */
export const AGGREGATION_LABELS: Record<AggregationType, string> = {
  none: 'ללא',
  sum: 'סכום',
  avg: 'ממוצע',
  min: 'מינימום',
  max: 'מקסימום',
  count: 'ספירה',
  count_filled: 'מלאים',
  count_empty: 'ריקים',
  count_filled_pct: '% מלאים',
  count_unique: 'ייחודיים',
  range: 'טווח',
  distribution: 'פילוג',
  most_common: 'הנפוץ ביותר',
};

/**
 * Compute the aggregation for a field across all records.
 */
export function computeAggregation(
  field: Field,
  records: RecordRow[],
  aggregation?: AggregationType
): AggregationResult | null {
  const agg = aggregation || getEffectiveAggregation(field);
  if (agg === 'none') return null;

  const values = records.map(r => r.data?.[field.slug]);
  const total = values.length;

  switch (agg) {
    case 'count':
      return { display: formatNumber(total), raw: total };

    case 'count_filled': {
      const filled = values.filter(v => !isEmpty(v)).length;
      return { display: formatNumber(filled), detail: `${filled}/${total}`, raw: filled };
    }

    case 'count_empty': {
      const empty = values.filter(isEmpty).length;
      return { display: formatNumber(empty), detail: `${empty}/${total}`, raw: empty };
    }

    case 'count_filled_pct': {
      if (total === 0) return { display: '0%', raw: 0 };
      const filled = values.filter(v => !isEmpty(v)).length;
      const pct = Math.round((filled / total) * 100);
      return { display: `${pct}%`, detail: `${filled}/${total}`, raw: pct };
    }

    case 'count_unique': {
      const filled = values.filter(v => !isEmpty(v));
      // For multi-value fields (multiselect, relation many), flatten
      const flat = filled.flatMap(v => Array.isArray(v) ? v : [v]);
      const unique = new Set(flat.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)));
      return { display: formatNumber(unique.size), detail: `מתוך ${total} רשומות`, raw: unique.size };
    }

    case 'sum': {
      const nums = values.map(toNumber).filter((n): n is number => n !== null);
      if (nums.length === 0) return { display: '—', raw: 0 };
      const sum = nums.reduce((a, b) => a + b, 0);
      const formatted = field.type === 'currency'
        ? formatCurrency(sum, field.config?.currency || '₪')
        : formatNumber(sum);
      return { display: formatted, detail: `${nums.length} ערכים`, raw: sum };
    }

    case 'avg': {
      const nums = values.map(toNumber).filter((n): n is number => n !== null);
      if (nums.length === 0) return { display: '—', raw: 0 };
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      const formatted = field.type === 'currency'
        ? formatCurrency(avg, field.config?.currency || '₪')
        : formatNumber(avg);
      return { display: formatted, detail: `מ-${nums.length} ערכים`, raw: avg };
    }

    case 'min': {
      if (field.type === 'date' || field.type === 'datetime') {
        const dates = values.filter((v): v is string => typeof v === 'string' && v !== '');
        if (dates.length === 0) return { display: '—' };
        const sorted = [...dates].sort();
        return { display: formatDate(sorted[0]), raw: sorted[0] };
      }
      const nums = values.map(toNumber).filter((n): n is number => n !== null);
      if (nums.length === 0) return { display: '—' };
      const min = Math.min(...nums);
      return { display: field.type === 'currency' ? formatCurrency(min, field.config?.currency) : formatNumber(min), raw: min };
    }

    case 'max': {
      if (field.type === 'date' || field.type === 'datetime') {
        const dates = values.filter((v): v is string => typeof v === 'string' && v !== '');
        if (dates.length === 0) return { display: '—' };
        const sorted = [...dates].sort();
        return { display: formatDate(sorted[sorted.length - 1]), raw: sorted[sorted.length - 1] };
      }
      const nums = values.map(toNumber).filter((n): n is number => n !== null);
      if (nums.length === 0) return { display: '—' };
      const max = Math.max(...nums);
      return { display: field.type === 'currency' ? formatCurrency(max, field.config?.currency) : formatNumber(max), raw: max };
    }

    case 'range': {
      // Date range: "15/3/26 → 22/3/26"
      const dates = values.filter((v): v is string => typeof v === 'string' && v !== '');
      if (dates.length === 0) return { display: '—' };
      const sorted = [...dates].sort();
      const min = sorted[0];
      const max = sorted[sorted.length - 1];
      if (min === max) return { display: formatDate(min) };
      return {
        display: `${formatDate(min)} ← ${formatDate(max)}`,
        detail: `${dates.length} תאריכים`,
      };
    }

    case 'distribution': {
      // For select / multiselect / status: "5 פעילים · 3 ממתינים · 1 בוצע"
      const filled = values.filter(v => !isEmpty(v));
      const flat = filled.flatMap(v => Array.isArray(v) ? v : [v]);
      const counts = new Map<string, number>();
      for (const v of flat) {
        const key = String(v);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      // Resolve labels from field config options
      const options = field.config?.options || [];
      const labelFor = (val: string) =>
        options.find(o => o.value === val)?.label || val;
      const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      if (sorted.length === 0) return { display: '—' };
      const display = sorted.slice(0, 3)
        .map(([v, n]) => `${n} ${labelFor(v)}`)
        .join(' · ');
      const more = sorted.length > 3 ? ` (+${sorted.length - 3})` : '';
      return { display: display + more, detail: `סך ${flat.length}` };
    }

    case 'most_common': {
      const filled = values.filter(v => !isEmpty(v));
      const flat = filled.flatMap(v => Array.isArray(v) ? v : [v]);
      const counts = new Map<string, number>();
      for (const v of flat) {
        const key = String(v);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
      if (counts.size === 0) return { display: '—' };
      const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
      const [topVal, topCount] = sorted[0];
      const options = field.config?.options || [];
      const label = options.find(o => o.value === topVal)?.label || topVal;
      return { display: label, detail: `${topCount} מתוך ${flat.length}`, raw: topVal };
    }

    default:
      return null;
  }
}
