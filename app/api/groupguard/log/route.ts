import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/groupguard/log?workspace_id=xxx&limit=50&group_id=optional
 *   Returns recent action log entries + 7-day summary stats.
 */

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  const groupId = searchParams.get('group_id');
  const limit = Math.min(200, Number(searchParams.get('limit') || 50));

  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();
  if (!membership) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // Recent log entries
  let logQuery = supabase
    .from('gg_actions_log')
    .select(`
      id,
      group_id,
      target_phone,
      target_name,
      action_type,
      trigger_source,
      trigger_details,
      was_successful,
      error_message,
      created_at
    `)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (groupId) {
    logQuery = logQuery.eq('group_id', groupId);
  }

  const { data: log, error: logErr } = await logQuery;
  if (logErr) return NextResponse.json({ error: logErr.message }, { status: 500 });

  // 7-day summary
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: weekActions } = await supabase
    .from('gg_actions_log')
    .select('action_type, trigger_source, was_successful, created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', sevenDaysAgo);

  const summary = {
    total: weekActions?.length || 0,
    kicks: 0,
    deletes: 0,
    warns: 0,
    failed: 0,
    by_source: {
      ai: 0,
      manual_report: 0,
      phone_prefix: 0,
      global_blocklist: 0,
      whitelist: 0,
    } as Record<string, number>,
  };

  for (const a of weekActions || []) {
    if (!a.was_successful) summary.failed++;
    if (a.action_type === 'kick') summary.kicks++;
    else if (a.action_type === 'delete_message') summary.deletes++;
    else if (a.action_type === 'warn') summary.warns++;

    if (a.trigger_source && summary.by_source[a.trigger_source] !== undefined) {
      summary.by_source[a.trigger_source]++;
    }
  }

  // Group names lookup
  const groupIds = Array.from(new Set((log || []).map((l) => l.group_id)));
  const { data: groups } = groupIds.length
    ? await supabase
        .from('whatsapp_groups')
        .select('id, group_name, green_api_chat_id')
        .in('id', groupIds)
    : { data: [] };

  const groupMap: Record<string, string> = {};
  for (const g of groups || []) {
    groupMap[g.id] = g.group_name || g.green_api_chat_id;
  }

  return NextResponse.json({
    log: (log || []).map((l) => ({
      ...l,
      group_name: groupMap[l.group_id] || l.group_id,
    })),
    summary,
  });
}
