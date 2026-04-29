/**
 * Grid sort utility
 *
 * Click cycle on a column header:
 *   no sort → asc → desc → no sort
 *
 * Multi-column sort is NOT supported here - keeping it simple, like Sheets.
 * If users hold shift later, we can add a secondary key.
 *
 * Type-aware comparison:
 *   - text: locale-aware (Hebrew handled), case-insensitive
 *   - number/currency: numeric
 *   - date/datetime: chronological
 *   - select/status: by option position (not alphabetical) - matches user intent
 *   - checkbox: false < true
 *   - empty values always sort last regardless of direction
 */

import type { Field, RecordRow } from '@/lib/types/database';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  fieldSlug: string;
  direction: SortDirection;
}

/**
 * Cycle through sort states on a header click.
 *   undefined → asc
 *   asc       → desc
 *   desc      → undefined (clears sort)
 */
export function cycleSortState(
  current: SortState | null,
  fieldSlug: string
): SortState | null {
  if (!current || current.fieldSlug !== fieldSlug) {
    return { fieldSlug, direction: 'asc' };
  }
  if (current.direction === 'asc') {
    return { fieldSlug, direction: 'desc' };
  }
  // desc → clear
  return null;
}

/**
 * Apply a sort to records. Returns a new array; does not mutate.
 */
export function applySort(
  records: RecordRow[],
  sort: SortState | null,
  fields: Field[]
): RecordRow[] {
  if (!sort) return records;
  const field = fields.find((f) => f.slug === sort.fieldSlug);
  if (!field) return records;

  const direction = sort.direction === 'asc' ? 1 : -1;

  // Pre-compute the option index map for select/status fields. This avoids
  // doing the lookup in the hot path of the sort comparator.
  let optionOrder: Map<string, number> | null = null;
  if (field.type === 'select' || field.type === 'status' || field.type === 'multiselect') {
    optionOrder = new Map();
    (field.config?.options || []).forEach((opt: any, idx: number) => {
      optionOrder!.set(opt.value, idx);
    });
  }

  return [...records].sort((a, b) => {
    const va = a.data?.[sort.fieldSlug];
    const vb = b.data?.[sort.fieldSlug];

    // Null/empty handling: empties always go last regardless of direction
    const aEmpty = va === null || va === undefined || va === '';
    const bEmpty = vb === null || vb === undefined || vb === '';
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;

    let cmp = 0;
    switch (field.type) {
      case 'number':
      case 'currency':
      case 'rating':
        cmp = Number(va) - Number(vb);
        break;

      case 'date':
      case 'datetime':
        cmp = new Date(va).getTime() - new Date(vb).getTime();
        break;

      case 'checkbox':
        // false < true. Coerce to boolean to handle "true"/"false" strings.
        cmp = (va === true || va === 'true' ? 1 : 0) - (vb === true || vb === 'true' ? 1 : 0);
        break;

      case 'select':
      case 'status':
      case 'multiselect': {
        // Sort by the option's defined position so that e.g. "ממתין → מאושר → שולם"
        // sorts in the configured order rather than alphabetically.
        const ai = optionOrder!.get(String(va)) ?? 99999;
        const bi = optionOrder!.get(String(vb)) ?? 99999;
        cmp = ai - bi;
        break;
      }

      default:
        // Locale-aware string compare. 'he' handles Hebrew correctly.
        cmp = String(va).localeCompare(String(vb), 'he', { numeric: true, sensitivity: 'base' });
    }

    return cmp * direction;
  });
}
