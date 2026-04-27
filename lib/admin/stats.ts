/**
 * Aggregate platform-level statistics from all workspaces.
 * Used by /admin overview page.
 */

import { adminServiceClient } from './auth';

export type PlatformStats = {
  // Counts
  total_workspaces: number;
  active_workspaces_30d: number;
  total_users: number;
  new_users_7d: number;
  total_records: number;
  total_messages: number;

  // Activity
  signups_today: number;
  signups_7d: number;
  records_created_24h: number;
  messages_processed_24h: number;
  ai_briefings_30d: number;

  // AI usage & cost
  ai_total_cost_usd_30d: number;
  ai_total_tokens_30d: number;

  // Top workspaces by activity
  top_workspaces: Array<{
    id: string;
    name: string;
    icon: string | null;
    member_count: number;
    record_count: number;
    message_count: number;
    last_activity: string | null;
  }>;
};

export async function getPlatformStats(): Promise<PlatformStats> {
  const supabase = adminServiceClient();
  const now = new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  // Run all aggregations in parallel
  const [
    workspacesResp,
    usersResp,
    activeWsResp,
    recordsResp,
    messagesResp,
    signupsTodayResp,
    signups7dResp,
    records24hResp,
    messages24hResp,
    aiBriefingsResp,
    aiUsageResp,
    topWorkspacesResp,
  ] = await Promise.all([
    // Total workspaces
    supabase.from('workspaces').select('id', { count: 'exact', head: true }),

    // Total users (auth.users)
    Promise.resolve({ data: null }),

    // Active workspaces (had records or messages in last 30d)
    supabase
      .from('records')
      .select('table_id', { count: 'exact', head: false })
      .gte('updated_at', thirtyDaysAgo)
      .limit(1000),

    // Total records
    supabase.from('records').select('id', { count: 'exact', head: true }),

    // Total WA messages
    supabase.from('wa_messages').select('id', { count: 'exact', head: true }),

    // Signups today
    supabase
      .from('terms_acceptances')
      .select('user_id', { count: 'exact', head: true })
      .gte('accepted_at', today.toISOString()),

    // Signups 7d
    supabase
      .from('terms_acceptances')
      .select('user_id', { count: 'exact', head: true })
      .gte('accepted_at', sevenDaysAgo),

    // Records 24h
    supabase
      .from('records')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo),

    // Messages 24h
    supabase
      .from('wa_messages')
      .select('id', { count: 'exact', head: true })
      .gte('processed_at', oneDayAgo),

    // AI briefings (focus_sessions in 30d)
    supabase
      .from('focus_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo),

    // AI usage cost (sum of cost_usd from focus_sessions in 30d)
    supabase
      .from('focus_sessions')
      .select('cost_usd, tokens_input, tokens_output')
      .gte('created_at', thirtyDaysAgo)
      .limit(10000),

    // Top workspaces by record count - we'll fetch all and sort
    supabase
      .from('workspaces')
      .select('id, name, icon, updated_at')
      .order('updated_at', { ascending: false })
      .limit(10),
  ]);

  // Get total users via direct query since RPC might not exist
  let totalUsers = 0;
  let newUsers7d = 0;
  try {
    const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    totalUsers = users?.users?.length || 0;
    newUsers7d = users?.users?.filter(u => new Date(u.created_at) > new Date(sevenDaysAgo)).length || 0;
  } catch {}

  // Active workspaces - distinct table_ids → workspace_ids
  const activeTableIds = new Set((activeWsResp.data || []).map((r: any) => r.table_id));
  let activeWorkspaceIds = new Set<string>();
  if (activeTableIds.size > 0) {
    const { data: tablesActive } = await supabase
      .from('tables')
      .select('workspace_id')
      .in('id', Array.from(activeTableIds));
    activeWorkspaceIds = new Set((tablesActive || []).map((t: any) => t.workspace_id));
  }

  // AI usage aggregation
  let aiTotalCost = 0;
  let aiTotalTokens = 0;
  for (const row of (aiUsageResp.data || []) as any[]) {
    aiTotalCost += parseFloat(row.cost_usd || '0');
    aiTotalTokens += (row.tokens_input || 0) + (row.tokens_output || 0);
  }

  // Top workspaces - fetch enrichment for each
  const topWorkspaces: PlatformStats['top_workspaces'] = [];
  for (const ws of ((topWorkspacesResp.data || []) as any[]).slice(0, 5)) {
    const [{ count: memberCount }, { count: recordCount }, { count: messageCount }] = await Promise.all([
      supabase.from('workspace_members').select('user_id', { count: 'exact', head: true }).eq('workspace_id', ws.id),
      supabase.from('records').select('id', { count: 'exact', head: true })
        .in('table_id', (await supabase.from('tables').select('id').eq('workspace_id', ws.id)).data?.map((t: any) => t.id) || ['00000000-0000-0000-0000-000000000000']),
      supabase.from('wa_messages').select('id', { count: 'exact', head: true })
        .in('group_id', (await supabase.from('whatsapp_groups').select('id').eq('workspace_id', ws.id)).data?.map((g: any) => g.id) || ['00000000-0000-0000-0000-000000000000']),
    ]);
    topWorkspaces.push({
      id: ws.id,
      name: ws.name,
      icon: ws.icon,
      member_count: memberCount || 0,
      record_count: recordCount || 0,
      message_count: messageCount || 0,
      last_activity: ws.updated_at,
    });
  }

  topWorkspaces.sort((a, b) =>
    (b.record_count + b.message_count) - (a.record_count + a.message_count)
  );

  return {
    total_workspaces: workspacesResp.count || 0,
    active_workspaces_30d: activeWorkspaceIds.size,
    total_users: totalUsers,
    new_users_7d: newUsers7d,
    total_records: recordsResp.count || 0,
    total_messages: messagesResp.count || 0,

    signups_today: signupsTodayResp.count || 0,
    signups_7d: signups7dResp.count || 0,
    records_created_24h: records24hResp.count || 0,
    messages_processed_24h: messages24hResp.count || 0,
    ai_briefings_30d: aiBriefingsResp.count || 0,

    ai_total_cost_usd_30d: aiTotalCost,
    ai_total_tokens_30d: aiTotalTokens,

    top_workspaces: topWorkspaces,
  };
}
