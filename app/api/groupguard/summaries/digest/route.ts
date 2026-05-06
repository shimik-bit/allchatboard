import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/groupguard/summaries/digest?workspace_id=xxx&date=YYYY-MM-DD
 *
 * Returns the daily summary for EVERY group in the workspace, joined with
 * group metadata, so the UI can render a 'what did I miss today' digest
 * page in a single request — no per-group round-trips.
 *
 * Why a dedicated endpoint:
 *   - The existing /summaries route is per-group (groups/[id]/summaries),
 *     which would mean N requests for N groups. With even a few dozen
 *     groups this turns the digest screen into a slow waterfall.
 *   - The shape returned here is also different — we don't want history
 *     for each group, only "today" per group. Smaller payload, simpler UI.
 *
 * Behavior:
 *   - Returns a list of group_summaries entries for the given date
 *   - Joins to whatsapp_groups for group_name + summary_enabled
 *   - Includes groups WITHOUT a summary too — empty placeholder so the
 *     UI can show 'no summary for today' instead of pretending the group
 *     doesn't exist. This matters because users might want to know which
 *     groups DIDN'T get summarized (low traffic? bot kicked out?).
 *
 * Defaults `date` to today (UTC) if not specified. Workspace timezone
 * handling is intentionally simple — same compromise as the rest of the
 * summary system uses today.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  const dateParam = searchParams.get('date'); // YYYY-MM-DD optional

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'workspace_id required' },
      { status: 400 },
    );
  }

  // Membership check
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Default to today, validate format if provided. The summaries are
  // stored with summary_date matching the END of the rolling 24h window,
  // so 'today's date' == the date stamped on the summary that ran today.
  const date = dateParam || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'date must be YYYY-MM-DD' },
      { status: 400 },
    );
  }

  // Pull all active groups in the workspace + LEFT JOIN to summaries.
  // We do this as two queries because PostgREST left-joins are awkward
  // when you also want to filter on the joined table. Explicit fan-out
  // is clearer.
  const { data: groups, error: groupsErr } = await supabase
    .from('whatsapp_groups')
    .select('id, group_name, green_api_chat_id, gg_enabled, summary_enabled, last_summary_at, gg_participants_count')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .order('group_name', { ascending: true });

  if (groupsErr) {
    return NextResponse.json({ error: groupsErr.message }, { status: 500 });
  }

  if (!groups || groups.length === 0) {
    return NextResponse.json({
      ok: true,
      date,
      groups: [],
    });
  }

  const { data: summaries, error: summariesErr } = await supabase
    .from('gg_group_summaries')
    .select(`
      id, group_id, summary_date, headline, context, bullets, key_decisions,
      message_count, participant_count, created_at
    `)
    .eq('workspace_id', workspaceId)
    .eq('summary_date', date);

  if (summariesErr) {
    return NextResponse.json({ error: summariesErr.message }, { status: 500 });
  }

  // Build summary lookup by group_id so we can attach in O(N) below
  const byGroup = new Map<string, (typeof summaries)[number]>();
  for (const s of summaries || []) {
    byGroup.set(s.group_id, s);
  }

  // Compose response: every group gets an entry, with summary attached
  // when one exists for the date. Groups without a summary get a null
  // summary + a status hint explaining why (best effort — could be
  // "summary not enabled" or "ran but skipped due to too few messages"
  // or "hasn't run yet").
  const result = groups.map((g) => {
    const summary = byGroup.get(g.id);
    let status: 'has_summary' | 'disabled' | 'not_run_yet';
    if (summary) {
      status = 'has_summary';
    } else if (g.summary_enabled === false) {
      status = 'disabled';
    } else {
      status = 'not_run_yet';
    }

    return {
      group_id: g.id,
      group_name: g.group_name || g.green_api_chat_id,
      gg_enabled: !!g.gg_enabled,
      summary_enabled: g.summary_enabled !== false, // default true
      participants_count: g.gg_participants_count || 0,
      last_summary_at: g.last_summary_at,
      status,
      summary: summary
        ? {
            id: summary.id,
            headline: summary.headline,
            context: summary.context,
            bullets: summary.bullets || [],
            key_decisions: summary.key_decisions || null,
            message_count: summary.message_count,
            participant_count: summary.participant_count,
            created_at: summary.created_at,
          }
        : null,
    };
  });

  // Roll-up stats so the UI can show "X groups, Y summaries, Z messages"
  // at the top without recomputing on the client.
  const stats = {
    total_groups: result.length,
    with_summary: result.filter((r) => r.status === 'has_summary').length,
    total_messages: result.reduce(
      (acc, r) => acc + (r.summary?.message_count || 0),
      0,
    ),
  };

  return NextResponse.json({ ok: true, date, stats, groups: result });
}
