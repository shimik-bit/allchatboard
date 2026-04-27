/**
 * Platform Super Admin authentication helpers.
 *
 * SEPARATE from regular workspace_members auth. Used for /admin/* routes
 * that show data across ALL workspaces (only for platform owner).
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export type PlatformAdmin = {
  id: string;
  email: string;
  user_id: string | null;
  can_view_all: boolean;
  can_impersonate: boolean;
  can_modify_workspaces: boolean;
  can_view_billing: boolean;
};

/**
 * Verify the current user is a platform admin. Redirects if not.
 * Returns admin record + the user.
 */
export async function requirePlatformAdmin(): Promise<{
  admin: PlatformAdmin;
  user: { id: string; email: string };
}> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect('/auth/login?next=/admin');
  }

  // Use service client to bypass RLS (we need to check across all admins)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: admin } = await serviceClient
    .from('platform_admins')
    .select('*')
    .eq('email', user.email)
    .maybeSingle();

  if (!admin) {
    redirect('/dashboard');
  }

  // Update user_id if it's not set yet (first login as admin)
  if (!admin.user_id) {
    await serviceClient
      .from('platform_admins')
      .update({ user_id: user.id })
      .eq('id', admin.id);
  }

  return {
    admin: admin as PlatformAdmin,
    user: { id: user.id, email: user.email! },
  };
}

/**
 * Get a service-role Supabase client for admin queries.
 * USE WITH CARE - bypasses ALL RLS.
 */
export function adminServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
