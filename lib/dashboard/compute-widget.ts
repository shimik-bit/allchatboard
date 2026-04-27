/**
 * Compute widget data from records.
 * Each widget type has its own data shape for Recharts.
 */

import type { Field, RecordRow } from '@/lib/types/database';
import type { DefaultWidget } from './default-widgets';

export type ComputedKpi = {
  type: 'kpi';
  title: string;
  value: string;
  raw: number;
  delta?: number; // % change vs previous period (TODO: when filtering by date range)
  hint?: string;
};

export type ComputedSeries = {
  type: 'line' | 'bar' | 'area' | 'pie' | 'donut';
  title: string;
  data: Array<{ name: string; value: number; color?: string }>;
  totalValue?: number;
};

export type ComputedWidget = ComputedKpi | ComputedSeries;

// ─── Helpers ────────────────────────────────────────────────────────────────

function toNumber(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatNum(n: number, currency?: string): string {
  const formatted = new Intl.NumberFormat('he-IL', {
    maximumFractionDigits: n < 100 ? 2 : 0,
  }).format(n);
  return currency ? `${currency} ${formatted}` : formatted;
}

function getDateValue(record: RecordRow, dateField: string): Date | null {
  let raw: any;
  if (dateField === '__created_at__') {
    raw = record.created_at;
  } else {
    raw = record.data?.[dateField];
  }
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function bucketDate(d: Date, period: 'day' | 'week' | 'month'): string {
  if (period === 'day') {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  }
  if (period === 'month') {
    return d.toISOString().slice(0, 7); // YYYY-MM
  }
  // week - Monday-based
  const monday = new Date(d);
  const day = (d.getDay() + 6) % 7; // 0 = Mon
  monday.setDate(d.getDate() - day);
  return monday.toISOString().slice(0, 10);
}

function formatBucketLabel(bucket: string, period: 'day' | 'week' | 'month'): string {
  if (period === 'month') {
    const [y, m] = bucket.split('-');
    const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
  }
  // day or week
  const d = new Date(bucket);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ─── Color palette for chart segments ───────────────────────────────────────

const COLORS = [
  '#7B3FE4', '#FF2D8A', '#FFB800', '#06B6D4', '#10B981',
  '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6',
];

// ─── Main API ───────────────────────────────────────────────────────────────

export function computeWidget(
  widget: DefaultWidget | { id: string; type: string; title: string; config: any },
  records: RecordRow[],
  fields: Field[]
): ComputedWidget | null {
  const config = widget.config || {};
  const type = widget.type as any;

  // ─── KPI ───
  if (type === 'kpi') {
    const agg = config.aggregation || 'count';
    let value = 0;
    let formatted = '';
    let hint: string | undefined;

    if (agg === 'count') {
      value = records.length;
      formatted = formatNum(value);
      hint = 'סך רשומות';
    } else {
      const slug = config.field_slug;
      const field = fields.find(f => f.slug === slug);
      const nums = records
        .map(r => toNumber(r.data?.[slug]))
        .filter((n): n is number => n !== null);
      const currency = field?.type === 'currency' ? (field.config?.currency || '₪') : undefined;
      
      if (nums.length === 0) {
        return { type: 'kpi', title: widget.title, value: '—', raw: 0 };
      }
      
      switch (agg) {
        case 'sum':
          value = nums.reduce((a, b) => a + b, 0);
          formatted = formatNum(value, currency);
          hint = `${nums.length} ערכים`;
          break;
        case 'avg':
          value = nums.reduce((a, b) => a + b, 0) / nums.length;
          formatted = formatNum(value, currency);
          hint = `מ-${nums.length} ערכים`;
          break;
        case 'min':
          value = Math.min(...nums);
          formatted = formatNum(value, currency);
          break;
        case 'max':
          value = Math.max(...nums);
          formatted = formatNum(value, currency);
          break;
      }
    }

    return { type: 'kpi', title: widget.title, value: formatted, raw: value, hint };
  }

  // ─── Time series (line / area / bar with dates) ───
  if ((type === 'line' || type === 'area') && config.date_field) {
    const period = config.period || 'day';
    const buckets = new Map<string, number>();
    
    for (const record of records) {
      const date = getDateValue(record, config.date_field);
      if (!date) continue;
      const bucket = bucketDate(date, period);
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    }
    
    // Fill missing buckets with 0 for last 30 periods (if any data)
    const sortedKeys = Array.from(buckets.keys()).sort();
    if (sortedKeys.length === 0) {
      return { type: type as any, title: widget.title, data: [] };
    }
    
    const data = sortedKeys.map(key => ({
      name: formatBucketLabel(key, period),
      value: buckets.get(key) || 0,
    }));

    return {
      type: type as any,
      title: widget.title,
      data,
      totalValue: data.reduce((a, b) => a + b.value, 0),
    };
  }

  // ─── Distribution (pie / donut / bar by group_by) ───
  if ((type === 'pie' || type === 'donut' || type === 'bar') && config.group_by) {
    const slug = config.group_by;
    const field = fields.find(f => f.slug === slug);
    const counts = new Map<string, number>();
    
    for (const record of records) {
      const v = record.data?.[slug];
      if (v === null || v === undefined || v === '') continue;
      const values = Array.isArray(v) ? v : [v];
      for (const val of values) {
        const key = String(val);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    
    // Resolve labels from field options if available
    const options = field?.config?.options || [];
    const labelFor = (val: string) =>
      options.find(o => o.value === val)?.label || val;
    const colorFor = (val: string, idx: number) =>
      options.find(o => o.value === val)?.color || COLORS[idx % COLORS.length];
    
    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const data = sorted.slice(0, 10).map(([val, count], idx) => ({
      name: labelFor(val),
      value: count,
      color: colorFor(val, idx),
    }));
    
    // If more than 10, group rest as "אחר"
    if (sorted.length > 10) {
      const rest = sorted.slice(10).reduce((sum, [_, n]) => sum + n, 0);
      data.push({ name: 'אחר', value: rest, color: '#9CA3AF' });
    }
    
    return {
      type: type as any,
      title: widget.title,
      data,
      totalValue: Array.from(counts.values()).reduce((a, b) => a + b, 0),
    };
  }

  return null;
}
