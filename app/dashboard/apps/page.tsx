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
  if (!user) redirect('/login');

  // Resolve active workspace from cookie (same convention as the rest of the app)
  const wsId = cookies().get('tf_active_workspace')?.value;
  if (!wsId) redirect('/dashboard');

  const { data: ws } = await supabase
    .from('workspaces')
    .select('id, name, locale')
    .eq('id', wsId)
    .maybeSingle();
  if (!ws) redirect('/dashboard');

  const wsRow = ws as { id: string; name: string; locale: string | null };

  return <AppsClient workspaceId={wsRow.id} workspaceName={wsRow.name} />;
}
