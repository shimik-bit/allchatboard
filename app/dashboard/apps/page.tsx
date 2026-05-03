// app/dashboard/apps/page.tsx
// Apps marketplace — install / uninstall apps for the current workspace.
// Server component just resolves workspace_id; the actual UI is client-side
// to support optimistic install / uninstall.

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import AppsClient from './AppsClient';

export const dynamic = 'force-dynamic';

export default async function AppsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Resolve active workspace from cookie. Fall back to the user's first
  // membership rather than redirecting away — a brand-new workspace might
  // be set as the active one but somehow the cookie didn't get refreshed.
  let wsId = cookies().get('tf_active_workspace')?.value;

  // Verify the cookie value points at a workspace this user can see
  if (wsId) {
    const { data: check } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', wsId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!check) wsId = undefined;
  }

  // Fall back to the first workspace this user belongs to
  if (!wsId) {
    const { data: firstMembership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .limit(1)
      .maybeSingle();
    wsId = (firstMembership as { workspace_id: string } | null)?.workspace_id;
  }

  if (!wsId) {
    // No memberships at all → onboarding
    redirect('/onboarding');
  }

  const { data: ws } = await supabase
    .from('workspaces')
    .select('id, name, locale')
    .eq('id', wsId)
    .maybeSingle();

  if (!ws) {
    // Membership exists but workspace row is gone — extremely unlikely,
    // but render an empty state instead of an infinite loop.
    return (
      <div className="max-w-md mx-auto p-6 mt-12 text-center" dir="rtl">
        <div className="text-5xl mb-3">🤔</div>
        <h1 className="text-lg font-bold text-gray-900 mb-2">לא נמצא workspace</h1>
        <p className="text-sm text-gray-500">נסה לרענן או חזור לדף הבית.</p>
      </div>
    );
  }

  const wsRow = ws as { id: string; name: string; locale: string | null };

  return <AppsClient workspaceId={wsRow.id} workspaceName={wsRow.name} />;
}
