import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Short link for a single record. Used in the WhatsApp assignee
 * notification — short enough to paste cleanly in chat, while resolving
 * to a deep view in the dashboard.
 *
 * Flow:
 *   1. Look up the record (just need its table_id)
 *   2. If not found → 404
 *   3. If user not authenticated → /auth/login (next.js handles return-to)
 *   4. If authenticated but not a member of the workspace → /dashboard
 *   5. Otherwise redirect to /dashboard/<tableId>?focus=<recordId>
 *      — TableClient will scroll to and highlight the row.
 */
export default async function ShortRecordLink({
  params,
}: {
  params: { recordId: string };
}) {
  const supabase = createClient();

  // 1 — find which table the record belongs to. Use service-side client
  // (RLS will reject if user isn't a member of the workspace anyway).
  const { data: record } = await supabase
    .from('records')
    .select('id, table_id, workspace_id')
    .eq('id', params.recordId)
    .maybeSingle();

  if (!record) notFound();

  // 2 — check auth. If not logged in, send to login (after which the user
  // can refresh this URL — auth callback returns to original URL).
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/auth/login?next=/r/${params.recordId}`);
  }

  // 3 — verify membership. RLS on records would also reject, but checking
  // membership explicitly gives us a friendlier redirect than 404.
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', record.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    redirect('/dashboard');
  }

  // 4 — deep link with focus param so TableClient can highlight the row.
  redirect(`/dashboard/${record.table_id}?focus=${params.recordId}`);
}
