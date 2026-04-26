/**
 * Super-admin authorization for AllChatBoard
 * ============================================
 * A super-admin is an email address listed in the gg_super_admins table.
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
import { createAdminClient } from '@/lib/supabase/server';


/**
 * Returns the list of super-admin emails from the DB.
 * Empty array if none configured or query failed.
 */
export async function getSuperAdminEmails(): Promise<string[]> {
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('gg_super_admins')
      .select('email');

    if (error || !data) {
      console.error('[GG][admin] failed to load super_admins:', error);
      return [];
    }

    return data.map((r: { email: string }) => r.email.toLowerCase());
  } catch (err) {
    console.error('[GG][admin] super_admins lookup failed:', err);
    return [];
  }
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

  const admins = await getSuperAdminEmails();
  if (admins.length === 0) {
    // Failsafe: if no admins configured, deny everyone
    console.warn('[GG][admin] No super_admins configured in gg_super_admins table - all admin access denied');
    return null;
  }

  const userEmail = user.email.toLowerCase();
  if (!admins.includes(userEmail)) return null;

  return { id: user.id, email: user.email };
}
