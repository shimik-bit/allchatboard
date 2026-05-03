/**
 * Duplicate detection for dynamic table records.
 *
 * Strategy: any table that has a field of type `phone` or `email` is a candidate
 * for duplicate detection. We group records by normalized values of those fields
 * and flag any group with 2+ members. A single record can appear in multiple
 * groups (e.g. shares a phone with one record and an email with another) — the
 * UI dedupes these into "duplicate clusters" before presenting them.
 *
 * Names are deliberately NOT used for matching in v1: name similarity is hard
 * (typos, RTL/LTR, nicknames, multi-word ordering) and false positives are
 * worse than false negatives for a destructive action like merging.
 */
import type { Field, RecordRow } from '@/lib/types/database';

/** Normalize a phone for comparison.
 *  - strip everything that isn't a digit
 *  - 0XXXXXXXX (Israeli local) → 972XXXXXXXX
 *  - returns null for values too short to be a real phone (<7 digits)
 */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let n = raw.replace(/\D/g, '');
  if (!n) return null;
  if (n.startsWith('0')) n = '972' + n.slice(1);
  if (n.length < 7) return null;
  return n;
}

/** Normalize an email: lowercase + trim. Returns null for empty/invalid. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  if (!e || !e.includes('@') || !e.includes('.')) return null;
  return e;
}

export type DuplicateGroup = {
  /** Stable key — `${field_slug}:${normalized_value}` */
  key: string;
  /** The field that links these records (phone or email) */
  field: Pick<Field, 'slug' | 'name' | 'type'>;
  /** The normalized value all records share */
  value: string;
  /** A friendly label of one of the original (un-normalized) values, for display */
  displayValue: string;
  /** The records that share this value (≥2). Sorted oldest-first so the
   *  oldest naturally becomes the suggested primary. */
  records: RecordRow[];
};

/** Find all duplicate groups in a list of records.
 *  Returns groups with 2+ members, sorted by group size descending.
 *
 *  This is O(records × dedup-fields), runs in <1ms for hundreds of rows.
 */
export function findDuplicateGroups(
  records: RecordRow[],
  fields: Field[]
): DuplicateGroup[] {
  // Pick the fields we know how to dedup on.
  const dedupFields = fields.filter(
    (f) => f.type === 'phone' || f.type === 'email'
  );
  if (dedupFields.length === 0 || records.length < 2) return [];

  // Bucket: key = `${slug}:${normalized}` → records sharing that value
  const buckets = new Map<
    string,
    { field: Field; value: string; displayValue: string; records: RecordRow[] }
  >();

  for (const record of records) {
    const data = record.data || {};
    for (const field of dedupFields) {
      const raw = data[field.slug];
      const normalized =
        field.type === 'phone' ? normalizePhone(raw) : normalizeEmail(raw);
      if (!normalized) continue;

      const key = `${field.slug}:${normalized}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.records.push(record);
      } else {
        buckets.set(key, {
          field,
          value: normalized,
          displayValue: typeof raw === 'string' ? raw : normalized,
          records: [record],
        });
      }
    }
  }

  // Keep only buckets with 2+ records, sort each by oldest first (= suggested primary)
  const groups: DuplicateGroup[] = [];
  for (const [key, bucket] of buckets) {
    if (bucket.records.length < 2) continue;
    const sorted = [...bucket.records].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    groups.push({
      key,
      field: { slug: bucket.field.slug, name: bucket.field.name, type: bucket.field.type },
      value: bucket.value,
      displayValue: bucket.displayValue,
      records: sorted,
    });
  }

  // Most-duplicated groups first — easier to address big problems
  groups.sort((a, b) => b.records.length - a.records.length);
  return groups;
}

/** Total count of records involved in any duplicate group (deduped: a record
 *  appearing in 2 groups is counted once). Used for the banner copy. */
export function countAffectedRecords(groups: DuplicateGroup[]): number {
  const seen = new Set<string>();
  for (const g of groups) for (const r of g.records) seen.add(r.id);
  return seen.size;
}

/** Build a preview of what the merged record's `data` will look like.
 *  Rule: primary's value wins; for empty/null primary fields, fill from
 *  duplicates in order. This is non-destructive — primary's existing values
 *  are NEVER overwritten. */
export function previewMergedData(
  primary: RecordRow,
  duplicates: RecordRow[]
): { data: Record<string, any>; filledFromDuplicate: Record<string, string> } {
  const merged: Record<string, any> = { ...(primary.data || {}) };
  // Map of slug → record_id where the value came from (for UI hints)
  const filledFromDuplicate: Record<string, string> = {};

  for (const dup of duplicates) {
    const dupData = dup.data || {};
    for (const slug of Object.keys(dupData)) {
      const current = merged[slug];
      const isEmpty =
        current === null || current === undefined || current === '';
      if (isEmpty && dupData[slug] !== null && dupData[slug] !== undefined && dupData[slug] !== '') {
        merged[slug] = dupData[slug];
        filledFromDuplicate[slug] = dup.id;
      }
    }
  }

  return { data: merged, filledFromDuplicate };
}
