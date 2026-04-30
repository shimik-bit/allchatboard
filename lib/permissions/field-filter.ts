/**
 * Field-level permission filtering
 *
 * Resolves which fields a given user can see in a given table, then provides
 * helpers to apply that resolution to fields[] and records[] arrays.
 *
 * The data model:
 *   - table_member_permissions row may have hidden_fields (deny-list) or
 *     visible_fields (allow-list). Both NULL = no field restrictions.
 *   - hidden_fields takes precedence over visible_fields (the UI prevents
 *     setting both anyway).
 *   - Users without a row in table_member_permissions for the table have
 *     no restrictions (subject to workspace role - admins/owners always see all).
 *
 * Why filter server-side: even if we hide columns in the UI, the data was
 * sent to the browser and could be read in DevTools. So we strip the field
 * values from records.data BEFORE sending them, and we strip the field
 * definitions from fields[] so they don't even render columns/headers.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

interface FieldRestriction {
  hidden_fields: string[] | null;
  visible_fields: string[] | null;
}

export type FieldVisibilityResolution =
  | { mode: 'all' }
  | { mode: 'hide'; slugs: Set<string> }
  | { mode: 'show-only'; slugs: Set<string> };

/**
 * Resolve which fields the user is allowed to see for the given table.
 * Always returns 'all' for workspace owners/admins because they manage
 * the table.
 */
export async function resolveFieldVisibility(
  supabase: SupabaseClient,
  userId: string,
  tableId: string,
  workspaceId: string
): Promise<FieldVisibilityResolution> {
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('id, role')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .single();

  // No direct membership = agency user (no field restrictions yet) or
  // shouldn't be here. Either way, no filtering.
  if (!membership) return { mode: 'all' };

  if (membership.role === 'owner' || membership.role === 'admin') {
    return { mode: 'all' };
  }

  const { data: perm } = await supabase
    .from('table_member_permissions')
    .select('hidden_fields, visible_fields')
    .eq('table_id', tableId)
    .eq('member_id', membership.id)
    .maybeSingle();

  if (!perm) return { mode: 'all' };

  const restriction = perm as FieldRestriction;

  // hidden_fields takes precedence (matches DB comment)
  if (restriction.hidden_fields && restriction.hidden_fields.length > 0) {
    return { mode: 'hide', slugs: new Set(restriction.hidden_fields) };
  }

  if (restriction.visible_fields && restriction.visible_fields.length > 0) {
    return { mode: 'show-only', slugs: new Set(restriction.visible_fields) };
  }

  return { mode: 'all' };
}

/** Filter the fields[] array to only those the user should see. */
export function filterFields<F extends { slug: string }>(
  fields: F[],
  resolution: FieldVisibilityResolution
): F[] {
  if (resolution.mode === 'all') return fields;
  if (resolution.mode === 'hide') {
    return fields.filter((f) => !resolution.slugs.has(f.slug));
  }
  return fields.filter((f) => resolution.slugs.has(f.slug));
}

/**
 * Strip restricted field values from each record's `data` jsonb. Top-level
 * record fields (id, notes, status, etc.) are never touched — only the
 * dynamic per-field data.
 */
export function filterRecords<R extends { data?: Record<string, any> | null }>(
  records: R[],
  resolution: FieldVisibilityResolution
): R[] {
  if (resolution.mode === 'all') return records;

  return records.map((r) => {
    if (!r.data || typeof r.data !== 'object') return r;
    const filtered: Record<string, any> = {};
    for (const [k, v] of Object.entries(r.data)) {
      if (resolution.mode === 'hide') {
        if (!resolution.slugs.has(k)) filtered[k] = v;
      } else {
        // show-only
        if (resolution.slugs.has(k)) filtered[k] = v;
      }
    }
    return { ...r, data: filtered };
  });
}
