import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/groupguard/groups/[id]/summaries?limit=14
 *
 * Returns the most recent summaries for a group, newest first.
 * Default limit 14 = roughly 2 weeks.
 *
 * Auth: workspace member (enforced via RLS — workspace_members_read_summaries
 * policy on gg_group_summaries restricts SELECT to the user's workspaces).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const limit = Math.min(60, Math.max(1, Number(new URL(req.url).searchParams.get('limit') || 14)));

  const { data, error } = await supabase
    .from('gg_group_summaries')
    .select(`
      id, summary_date, headline, bullets,
      message_count, participant_count,
      triggered_by, whatsapp_sent_at, whatsapp_send_error,
      created_at
    `)
    .eq('group_id', params.id)
    .order('summary_date', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, summaries: data || [] });
}
