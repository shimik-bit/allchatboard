import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/groupguard/super-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/groupguard/admin/stats
 *   Cross-workspace aggregate stats - super-admin only.
 *   Returns:
 *   - blocklist_total / confirmed / unconfirmed
 *   - actions: total / kicks / deletes / warns (last 30 days)
 *   - workspaces_using_gg: count of workspaces with gg_enabled groups
 *   - top_categories: most common AI spam categories globally
 *   - top_countries: most common phone prefixes appearing as spammers
 */

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const admin = await requireSuperAdmin(supabase);
  if (!admin) {
    return NextResponse.json({ error: 'super-admin only' }, { status: 403 });
  }

  const adminClient = createAdminClient();

  // ---- Blocklist counts ----
  const [
    { count: blocklist_total },
    { count: confirmed_count },
  ] = await Promise.all([
    adminClient.from('gg_global_blocklist').select('*', { count: 'exact', head: true }),
    adminClient
      .from('gg_global_blocklist')
      .select('*', { count: 'exact', head: true })
      .eq('is_confirmed', true),
  ]);

  // ---- Actions in last 30 days ----
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentActions } = await adminClient
    .from('gg_actions_log')
    .select('action_type, trigger_source, trigger_details, target_phone, created_at')
    .gte('created_at', thirtyDaysAgo);

  let total_actions = 0;
  let kicks = 0;
  let deletes = 0;
  let warns = 0;
  const categoryMap = new Map<string, number>();
  const prefixMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();

  for (const a of recentActions || []) {
    total_actions++;
    if (a.action_type === 'kick') kicks++;
    else if (a.action_type === 'delete_message') deletes++;
    else if (a.action_type === 'warn') warns++;

    if (a.trigger_source) {
      sourceMap.set(a.trigger_source, (sourceMap.get(a.trigger_source) || 0) + 1);
    }

    // AI categories
    const cats = a.trigger_details?.categories;
    if (Array.isArray(cats)) {
      for (const c of cats) {
        if (typeof c === 'string') {
          categoryMap.set(c, (categoryMap.get(c) || 0) + 1);
        }
      }
    }

    // Phone prefix (first 3 digits)
    if (a.target_phone) {
      const prefix = String(a.target_phone).substring(0, 3);
      prefixMap.set(prefix, (prefixMap.get(prefix) || 0) + 1);
    }
  }

  // ---- Workspaces using GroupGuard ----
  const { data: gguGroups } = await adminClient
    .from('whatsapp_groups')
    .select('workspace_id')
    .eq('gg_enabled', true);

  const uniqueWorkspaces = new Set(
    (gguGroups || []).map((g: { workspace_id: string }) => g.workspace_id),
  );

  // ---- Top groups across all workspaces ----
  const { count: total_groups } = await adminClient
    .from('whatsapp_groups')
    .select('*', { count: 'exact', head: true });

  const { count: enabled_groups } = await adminClient
    .from('whatsapp_groups')
    .select('*', { count: 'exact', head: true })
    .eq('gg_enabled', true);

  // Convert maps to sorted arrays
  const top_categories = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const top_prefixes = Array.from(prefixMap.entries())
    .map(([prefix, count]) => ({ prefix, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const by_source = Array.from(sourceMap.entries())
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({
    blocklist: {
      total: blocklist_total || 0,
      confirmed: confirmed_count || 0,
      unconfirmed: (blocklist_total || 0) - (confirmed_count || 0),
    },
    actions_30d: {
      total: total_actions,
      kicks,
      deletes,
      warns,
      by_source,
    },
    workspaces: {
      using_groupguard: uniqueWorkspaces.size,
    },
    groups: {
      total: total_groups || 0,
      enabled: enabled_groups || 0,
    },
    top_categories,
    top_prefixes,
  });
}
