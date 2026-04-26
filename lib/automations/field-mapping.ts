/**
 * Smart Field Mapping
 *
 * Given a source table's fields and a target table's fields, produce a
 * suggested mapping. Used by the "Move Record" UI and by Workflow's
 * "create_record" action.
 *
 * Matching priority:
 *   1. Identical slug ("phone" → "phone")
 *   2. Identical name (Hebrew or English)
 *   3. Same type + similar name ("שם" ↔ "שם מלא" ↔ "name")
 *   4. Type-only fallback (e.g., source primary text field → target primary text field)
 */

export type FieldMin = {
  id: string;
  name: string;
  slug: string;
  type: string;
  is_primary?: boolean;
};

export type FieldMapping = Record<string, string | null>;
// source_slug → target_slug (or null = don't map)

/**
 * Build a suggested mapping. Source fields that don't match anything return null.
 */
export function suggestFieldMapping(
  sourceFields: FieldMin[],
  targetFields: FieldMin[]
): FieldMapping {
  const mapping: FieldMapping = {};
  const usedTargetSlugs = new Set<string>();

  // Pass 1: exact slug match
  for (const sf of sourceFields) {
    const exact = targetFields.find((tf) => tf.slug === sf.slug && !usedTargetSlugs.has(tf.slug));
    if (exact) {
      mapping[sf.slug] = exact.slug;
      usedTargetSlugs.add(exact.slug);
    }
  }

  // Pass 2: exact name match (case-insensitive, trimmed)
  for (const sf of sourceFields) {
    if (mapping[sf.slug]) continue;
    const norm = sf.name.toLowerCase().trim();
    const match = targetFields.find(
      (tf) => tf.name.toLowerCase().trim() === norm && !usedTargetSlugs.has(tf.slug)
    );
    if (match) {
      mapping[sf.slug] = match.slug;
      usedTargetSlugs.add(match.slug);
    }
  }

  // Pass 3: same type + name contains/contained
  for (const sf of sourceFields) {
    if (mapping[sf.slug]) continue;
    const norm = sf.name.toLowerCase().trim();
    const match = targetFields.find((tf) => {
      if (usedTargetSlugs.has(tf.slug)) return false;
      if (tf.type !== sf.type) return false;
      const tnorm = tf.name.toLowerCase().trim();
      return tnorm.includes(norm) || norm.includes(tnorm);
    });
    if (match) {
      mapping[sf.slug] = match.slug;
      usedTargetSlugs.add(match.slug);
    }
  }

  // Pass 4: primary field fallback (source primary → target primary)
  const sourcePrimary = sourceFields.find((f) => f.is_primary);
  const targetPrimary = targetFields.find((f) => f.is_primary);
  if (sourcePrimary && targetPrimary && !mapping[sourcePrimary.slug] && !usedTargetSlugs.has(targetPrimary.slug)) {
    mapping[sourcePrimary.slug] = targetPrimary.slug;
    usedTargetSlugs.add(targetPrimary.slug);
  }

  // Fill in null for unmapped source fields
  for (const sf of sourceFields) {
    if (!(sf.slug in mapping)) mapping[sf.slug] = null;
  }

  return mapping;
}

/**
 * Apply a mapping to source data → produce target data.
 */
export function applyFieldMapping(
  sourceData: Record<string, any>,
  mapping: FieldMapping
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [sourceSlug, targetSlug] of Object.entries(mapping)) {
    if (!targetSlug) continue;  // skip unmapped fields
    if (sourceData[sourceSlug] !== undefined && sourceData[sourceSlug] !== null) {
      result[targetSlug] = sourceData[sourceSlug];
    }
  }
  return result;
}

/**
 * Render a message template by substituting {{slug}} placeholders with
 * values from the record's data.
 *
 * Example: "שלום {{name}}!" + { name: 'דניאל' } → "שלום דניאל!"
 */
export function renderTemplate(
  template: string,
  data: Record<string, any>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = data?.[key];
    if (value === undefined || value === null) return `[${key}]`;  // unfilled placeholder
    return String(value);
  });
}
