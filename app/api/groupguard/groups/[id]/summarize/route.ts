import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { summarizeGroup } from '@/lib/groupguard/group-summarizer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/groupguard/groups/[id]/summarize
 *
 * Generates (or regenerates with ?force=1) the daily summary for one group.
 * Used by the "Summarize now" button in the group settings UI.
 *
 * Auth: workspace member of the group's workspace.
 *
 * Returns:
 *   { ok: true, summary: {...}, summary_id: "..." }
 *   { ok: true, skipped: true, reason: "no_messages" | ... }
 *   { ok: false, error: "..." }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const groupId = params.id;
  const force = new URL(req.url).searchParams.get('force') === '1';

  // Look up the group + verify workspace membership before doing any work
  const admin = createAdminClient();
  const { data: group } = await admin
    .from('whatsapp_groups')
    .select('id, workspace_id, summary_enabled')
    .eq('id', groupId)
    .single();

  if (!group) {
    return NextResponse.json({ error: 'group_not_found' }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', group.workspace_id)
    .eq('user_id', user.id)
    .single();
  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Note: we DON'T require summary_enabled=true for manual triggers — users
  // should be able to try a summary before enabling it. The toggle only
  // gates the auto-cron path.

  const result = await summarizeGroup(admin, groupId, {
    triggeredBy: 'manual',
    triggeredByUserId: user.id,
    force,
  });

  return NextResponse.json(result);
}
