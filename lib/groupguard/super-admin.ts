/**
 * Super-admin authorization for AllChatBoard
 * ============================================
 * A super-admin is an email address listed in the GROUPGUARD_SUPER_ADMINS
 * env variable (comma-separated).
 *
 * Super-admins can:
 *   - View the global spam blocklist (cross-workspace)
 *   - Manually confirm/un-confirm phones in the blocklist
 *   - Add/remove phones from the blocklist
 *   - View aggregated stats across all workspaces
 *
 * Regular workspace members cannot access any of this.
 */

import type { SupabaseClient } from '@supabase/supabase-js';


/**
 * Returns the list of super-admin emails from env.
 * Empty array if not configured.
 */
export function getSuperAdminEmails(): string[] {
  const raw = process.env.GROUPGUARD_SUPER_ADMINS || '';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}


/**
 * Checks if the currently authenticated user is a super-admin.
 * Returns the user object if yes, null if no.
 */
export async function requireSuperAdmin(
  supabase: SupabaseClient,
): Promise<{ id: string; email: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return null;

  const admins = getSuperAdminEmails();
  if (admins.length === 0) {
    // Failsafe: if no admins configured, deny everyone
    console.warn('[GG][admin] GROUPGUARD_SUPER_ADMINS env var not set - all admin access denied');
    return null;
  }

  const userEmail = user.email.toLowerCase();
  if (!admins.includes(userEmail)) return null;

  return { id: user.id, email: user.email };
}
