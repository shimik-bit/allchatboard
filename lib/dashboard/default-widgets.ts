/**
 * Default widget generation for table dashboards.
 *
 * Looks at the field types of a table and proposes useful widgets:
 * - KPIs: count, sum (currency), avg (rating)
 * - Time series: records over time (if there's a date field)
 * - Distribution: pie/bar by status, select, user
 *
 * These are computed at render time - NOT stored in DB.
 * Users can add their own custom widgets via the "+" button.
 */

import type { Field } from '@/lib/types/database';

export type WidgetType = 'kpi' | 'line' | 'bar' | 'pie' | 'donut' | 'area';

export type DefaultWidget = {
  id: string;
  type: WidgetType;
  title: string;
  config: {
    field_slug?: string;
    aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
    group_by?: string;
    date_field?: string;
    period?: 'day' | 'week' | 'month';
  };
  isDefault: true;
};

export function getDefaultWidgets(fields: Field[], recordCount: number): DefaultWidget[] {
  const widgets: DefaultWidget[] = [];

  // 1. Total records KPI - always
  widgets.push({
    id: 'default:total',
    type: 'kpi',
    title: 'סך רשומות',
    config: { aggregation: 'count' },
    isDefault: true,
  });

  // 2. KPIs for currency / number fields (max 3)
  const numericFields = fields
    .filter(f => f.type === 'currency' || f.type === 'number')
    .slice(0, 3);
  for (const field of numericFields) {
    widgets.push({
      id: `default:sum:${field.slug}`,
      type: 'kpi',
      title: `סכום ${field.name}`,
      config: { field_slug: field.slug, aggregation: 'sum' },
      isDefault: true,
    });
  }

  // 3. KPI for rating field (avg)
  const ratingField = fields.find(f => f.type === 'rating');
  if (ratingField) {
    widgets.push({
      id: `default:avg:${ratingField.slug}`,
      type: 'kpi',
      title: `דירוג ממוצע`,
      config: { field_slug: ratingField.slug, aggregation: 'avg' },
      isDefault: true,
    });
  }

  // 4. Time series chart - records created over time
  const dateField = fields.find(f => f.type === 'date' || f.type === 'datetime');
  if (recordCount >= 5) {
    widgets.push({
      id: 'default:timeline',
      type: 'area',
      title: 'יצירת רשומות לאורך זמן',
      config: {
        date_field: dateField?.slug || '__created_at__',
        aggregation: 'count',
        period: 'day',
      },
      isDefault: true,
    });
  }

  // 5. Distribution donut chart for status / select (max 2)
  const distFields = fields
    .filter(f => f.type === 'status' || f.type === 'select')
    .slice(0, 2);
  for (const field of distFields) {
    widgets.push({
      id: `default:dist:${field.slug}`,
      type: 'donut',
      title: `פילוג לפי ${field.name}`,
      config: { group_by: field.slug, aggregation: 'count' },
      isDefault: true,
    });
  }

  // 6. Bar chart by city if exists
  const cityField = fields.find(f => f.type === 'city');
  if (cityField && recordCount >= 5) {
    widgets.push({
      id: `default:bar:${cityField.slug}`,
      type: 'bar',
      title: `התפלגות לפי ${cityField.name}`,
      config: { group_by: cityField.slug, aggregation: 'count' },
      isDefault: true,
    });
  }

  return widgets;
}
