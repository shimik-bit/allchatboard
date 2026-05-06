import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/groupguard/blocklist/lookup?workspace_id=X&phone=Y
 *
 * Look up a phone across the entire spammer database. Designed to answer
 * "is this number known to me / known to the system?" in one round-trip.
 *
 * Returns:
 *   - found:  whether the phone exists in gg_global_blocklist
 *   - entry:  the blocklist row (with manual-add metadata) or null
 *   - actions: actions taken against this phone in THIS workspace
 *     (total_count + last 5 entries with group + action_type + timestamp)
 *   - profile: member profile for this phone in this workspace, if known
 *     (display_name, profession, business_name — useful context)
 *
 * Why all three:
 * Looking up "is X a spammer?" is rarely a one-dimensional question.
 * People want to know:
 *   - Is the system flagging them globally? (entry)
 *   - Have I personally had to deal with them in my groups? (actions)
 *   - Who are they / what do I know about them? (profile)
 * Returning everything in one call avoids waterfall fetches in the UI.
 *
 * Phone normalization mirrors the manual-add endpoint: strip @c.us and
 * non-digits before querying. The blocklist stores raw digit strings.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  const phoneRaw = searchParams.get('phone');

  if (!workspaceId || !phoneRaw) {
    return NextResponse.json(
      { error: 'workspace_id and phone are required' },
      { status: 400 },
    );
  }

  // Normalize same way as manual-add does, so users can paste anything:
  // "+972-50-123-4567", "972501234567@c.us", or just "972501234567"
  // all hit the same row.
  const phone = String(phoneRaw)
    .replace(/@.*$/, '')
    .replace(/\D/g, '');

  if (phone.length < 4) {
    // Still allow short queries — partial-match search uses these. The
    // endpoint will degrade to "no exact match" + skip the actions/
    // profile lookups (which need a full phone). Returning here would
    // be friendlier than 400 since the user is just typing.
    return NextResponse.json({
      ok: true,
      phone,
      found: false,
      entry: null,
      actions: { total_count: 0, recent: [] },
      profile: null,
      hint: 'הזן לפחות 4 ספרות לחיפוש',
    });
  }

  // Membership check — must be a member to look anything up in this
  // workspace's actions/profiles. The blocklist itself is public-readable
  // by design (so even non-members get the global lookup), but we still
  // want a workspace_id for actions/profile context.
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // 1. Blocklist entry (the main answer)
  const { data: entry } = await admin
    .from('gg_global_blocklist')
    .select(`
      id, phone, first_reported_at, last_reported_at, report_count,
      unique_groups_count, unique_workspaces_count,
      reason_summary, is_confirmed, confirmed_at, notes,
      added_manually, added_manually_by_email, added_manually_at,
      created_at, updated_at
    `)
    .eq('phone', phone)
    .maybeSingle();

  // 2. Actions taken against this phone in THIS workspace. We need both
  // total count (for the "kicked X times" summary) and a recent list (for
  // a small timeline). Two queries because a single .select with .count
  // doesn't easily give us both — keeping it explicit.
  const [{ count: totalActions }, { data: recentActions }] = await Promise.all([
    admin
      .from('gg_actions_log')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('target_phone', phone),
    admin
      .from('gg_actions_log')
      .select('id, group_id, action_type, trigger_source, was_successful, created_at')
      .eq('workspace_id', workspaceId)
      .eq('target_phone', phone)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  // 3. Group names for the recent actions (single lookup for all groups
  // the actions belong to — avoids per-row joins).
  const groupIds = Array.from(
    new Set((recentActions || []).map((a) => a.group_id).filter(Boolean)),
  );
  const groupMap: Record<string, string> = {};
  if (groupIds.length > 0) {
    const { data: groups } = await admin
      .from('whatsapp_groups')
      .select('id, group_name, green_api_chat_id')
      .in('id', groupIds);
    for (const g of groups || []) {
      groupMap[g.id] = g.group_name || g.green_api_chat_id;
    }
  }

  // 4. Member profile in this workspace, if we have one. Useful so the
  // user sees "Ah, this is John the plumber from group X" not just a
  // raw phone number.
  const { data: profile } = await admin
    .from('gg_member_profiles')
    .select(`
      id, display_name, full_name, profession, business_name,
      groups_count, message_count, avatar_url, completeness_pct
    `)
    .eq('workspace_id', workspaceId)
    .eq('phone', phone)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    phone,
    found: !!entry,
    entry: entry || null,
    actions: {
      total_count: totalActions || 0,
      recent: (recentActions || []).map((a) => ({
        ...a,
        group_name: groupMap[a.group_id] || a.group_id,
      })),
    },
    profile: profile || null,
  });
}
