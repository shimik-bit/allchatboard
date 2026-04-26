import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/groupguard/dashboard?workspace_id=xxx&days=7
 *   Returns aggregated stats for the dashboard:
 *   - daily_timeseries: actions per day (for line chart)
 *   - by_source: pie chart breakdown by trigger source
 *   - by_action: pie chart breakdown by action type
 *   - top_spammers: most reported phones
 *   - top_groups: groups with most actions
 *   - ai_categories: most common AI-detected categories
 */

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  const days = Math.min(90, Math.max(1, Number(searchParams.get('days') || 7)));

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();
  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sinceISO = since.toISOString();

  // Pull all actions in the window
  const { data: actions, error } = await supabase
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
      created_at
    `)
    .eq('workspace_id', workspaceId)
    .gte('created_at', sinceISO)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ----- Build daily timeseries -----
  const dailyMap = new Map<string, { date: string; total: number; kicks: number; deletes: number; warns: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { date: key, total: 0, kicks: 0, deletes: 0, warns: 0 });
  }

  for (const a of actions || []) {
    const day = a.created_at.slice(0, 10);
    const bucket = dailyMap.get(day);
    if (!bucket) continue;
    bucket.total++;
    if (a.action_type === 'kick') bucket.kicks++;
    else if (a.action_type === 'delete_message') bucket.deletes++;
    else if (a.action_type === 'warn') bucket.warns++;
  }
  const daily_timeseries = Array.from(dailyMap.values());

  // ----- Build breakdown by source -----
  const bySourceMap = new Map<string, number>();
  for (const a of actions || []) {
    bySourceMap.set(a.trigger_source, (bySourceMap.get(a.trigger_source) || 0) + 1);
  }
  const by_source = Array.from(bySourceMap.entries()).map(([source, count]) => ({ source, count }));

  // ----- Build breakdown by action -----
  const byActionMap = new Map<string, number>();
  for (const a of actions || []) {
    byActionMap.set(a.action_type, (byActionMap.get(a.action_type) || 0) + 1);
  }
  const by_action = Array.from(byActionMap.entries()).map(([action, count]) => ({ action, count }));

  // ----- Top spammers (only successful kicks/deletes) -----
  const spammerMap = new Map<string, { phone: string; name: string | null; count: number; sources: Set<string> }>();
  for (const a of actions || []) {
    if (!a.was_successful) continue;
    if (a.action_type !== 'kick' && a.action_type !== 'delete_message') continue;
    const existing = spammerMap.get(a.target_phone) || {
      phone: a.target_phone,
      name: a.target_name,
      count: 0,
      sources: new Set<string>(),
    };
    existing.count++;
    existing.sources.add(a.trigger_source);
    if (!existing.name && a.target_name) existing.name = a.target_name;
    spammerMap.set(a.target_phone, existing);
  }
  const top_spammers = Array.from(spammerMap.values())
    .map((s) => ({
      phone: s.phone,
      name: s.name,
      count: s.count,
      sources: Array.from(s.sources),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ----- Top groups (by activity) -----
  const groupMap = new Map<string, { group_id: string; count: number }>();
  for (const a of actions || []) {
    if (!a.was_successful) continue;
    const existing = groupMap.get(a.group_id) || { group_id: a.group_id, count: 0 };
    existing.count++;
    groupMap.set(a.group_id, existing);
  }
  const groupIds = Array.from(groupMap.keys());
  const { data: groups } = groupIds.length
    ? await supabase
        .from('whatsapp_groups')
        .select('id, group_name, green_api_chat_id')
        .in('id', groupIds)
    : { data: [] };

  const groupNameMap: Record<string, string> = {};
  for (const g of groups || []) {
    groupNameMap[g.id] = g.group_name || g.green_api_chat_id;
  }

  const top_groups = Array.from(groupMap.values())
    .map((g) => ({
      group_id: g.group_id,
      group_name: groupNameMap[g.group_id] || 'קבוצה לא ידועה',
      count: g.count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // ----- AI categories breakdown -----
  const categoryMap = new Map<string, number>();
  for (const a of actions || []) {
    if (a.trigger_source !== 'ai') continue;
    const cats = a.trigger_details?.categories;
    if (!Array.isArray(cats)) continue;
    for (const c of cats) {
      if (typeof c === 'string') {
        categoryMap.set(c, (categoryMap.get(c) || 0) + 1);
      }
    }
  }
  const ai_categories = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // ----- Overall summary -----
  const successful = (actions || []).filter((a) => a.was_successful).length;
  const failed = (actions || []).filter((a) => !a.was_successful).length;

  return NextResponse.json({
    days,
    daily_timeseries,
    by_source,
    by_action,
    top_spammers,
    top_groups,
    ai_categories,
    summary: {
      total: actions?.length || 0,
      successful,
      failed,
    },
  });
}
