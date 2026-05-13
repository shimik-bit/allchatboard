/**
 * GroupGuard - Scan group members against global blocklist
 * ============================================================================
 *
 * POST /api/groupguard/groups/[id]/scan
 *
 * Fetches all current members of a WhatsApp group via Green API and
 * cross-references each phone against gg_global_blocklist. Returns the list
 * of suspected spammers found in the group, with metadata to help the
 * admin decide who to remove.
 *
 * Auth: workspace member (same as groups GET).
 * Returns 200 with { members: [...], scan_summary: {...} }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getGroupData, stripWhatsAppSuffix } from '@/lib/groupguard/green-api-client';
import { enqueueSheetSync } from '@/lib/google/enqueue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BlocklistMatch {
  phone: string;                  // נורמלי, ללא @c.us
  whatsapp_id: string;            // עם @c.us - לשימוש ב-removeGroupParticipant
  is_admin: boolean;              // האם המשתמש אדמין בקבוצה (לא ניתן להסיר אם כן)
  // נתוני blocklist
  report_count: number;
  unique_groups_count: number;
  unique_workspaces_count: number;
  reason_summary: string | null;
  is_confirmed: boolean;
  first_reported_at: string | null;
  last_reported_at: string | null;
  // נתונים נוספים
  has_member_profile: boolean;    // האם יש לנו פרופיל מקומי
  member_name: string | null;     // שם תצוגה אם קיים
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const groupId = params.id;
  const supabase = createClient();
  const admin = createAdminClient();

  // 1. Verify user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Load the group + workspace credentials using admin client (bypass RLS).
  //    We do explicit permission check below — RLS was causing edge cases
  //    where users with valid membership were still denied due to
  //    cross-workspace context issues.
  //
  // 2. Load the group + workspace credentials using admin client (bypass RLS).
  //    We do explicit permission check below — RLS was causing edge cases
  //    where users with valid membership were still denied due to
  //    cross-workspace context issues.
  //
  //    Earlier attempt used a PostgREST embed:
  //      .select('id, ..., workspaces!whatsapp_groups_workspace_id_fkey!inner(...)')
  //    But the double-hint syntax (FK name + !inner) appears to not work
  //    reliably in our PostgREST version — the query keeps coming back
  //    with no rows even though the data exists, surfacing as a misleading
  //    'Group not found' 404 to the user.
  //
  //    Switched to two simple sequential queries. Slightly more code, but
  //    each query is unambiguous and any future schema change (more FKs
  //    on whatsapp_groups, RLS policy edits, etc.) won't silently break it.
  const { data: group, error: groupErr } = await admin
    .from('whatsapp_groups')
    .select('id, workspace_id, green_api_chat_id, group_name')
    .eq('id', groupId)
    .maybeSingle();

  if (groupErr || !group) {
    return NextResponse.json({
      error: 'Group not found',
      _debug: {
        groupId,
        userId: user.id,
        userEmail: user.email,
        groupErr: groupErr?.message ?? null,
      },
    }, { status: 404 });
  }

  const { data: workspace, error: wsErr } = await admin
    .from('workspaces')
    .select('id, whatsapp_instance_id, whatsapp_token')
    .eq('id', group.workspace_id)
    .maybeSingle();

  if (wsErr || !workspace) {
    return NextResponse.json({
      error: 'Workspace not found for this group',
      _debug: { groupId, workspaceId: group.workspace_id, wsErr: wsErr?.message ?? null },
    }, { status: 500 });
  }

  // 3. Explicit membership check (replaces RLS protection)
  const { data: membership } = await admin
    .from('workspace_members')
    .select('role, accepted_at')
    .eq('workspace_id', group.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || !membership.accepted_at) {
    return NextResponse.json({
      error: 'Forbidden — you are not a member of this workspace',
      _debug: {
        groupId,
        userId: user.id,
        userEmail: user.email,
        groupWorkspaceId: group.workspace_id,
        groupName: group.group_name,
        membership_found: !!membership,
        membership_accepted: membership?.accepted_at ?? null,
      },
    }, { status: 403 });
  }

  if (!workspace.whatsapp_instance_id || !workspace.whatsapp_token) {
    return NextResponse.json(
      { error: 'WhatsApp not connected for this workspace' },
      { status: 400 },
    );
  }

  // 3. Fetch participants from Green API
  const result = await getGroupData(
    {
      instanceId: workspace.whatsapp_instance_id,
      apiToken: workspace.whatsapp_token,
    },
    group.green_api_chat_id,
  );

  if (!result.ok || !result.data) {
    return NextResponse.json(
      { error: result.error ?? 'Failed to fetch group data from WhatsApp' },
      { status: 502 },
    );
  }

  const participants = result.data.participants ?? [];
  if (participants.length === 0) {
    return NextResponse.json({
      members: [],
      scan_summary: {
        total_members: 0,
        flagged_count: 0,
        scanned_at: new Date().toISOString(),
      },
    });
  }

  // 4. Normalize phones for blocklist lookup (strip @c.us)
  const normalizedPhones = participants.map((p) => stripWhatsAppSuffix(p.id));

  // 4a. Sync the participant list into gg_member_profiles + gg_member_groups
  //
  //     Without this step, the scan would only return blocklist matches and
  //     the rest of the group's members would never appear in the
  //     "חברי קבוצות" tab. They'd only get a profile row if they happened
  //     to send a message that triggers the message-extraction pipeline —
  //     which means lurkers (the majority of any large group) stay invisible
  //     forever.
  //
  //     We do a minimal upsert here: just phone + workspace_id, no name and
  //     no AI fields. The display_name will be populated when the user
  //     sends a message (we get senderName from Green API webhooks), and
  //     the AI extraction job (extract-cron) fills in the structured fields
  //     as messages accumulate. So this is essentially "register the user
  //     as known" — a stub the rest of the system can hang context off.
  //
  //     We don't await the AI extraction here because for a 900+ member
  //     group that would mean a 30+ minute synchronous wait. Better to
  //     return fast and let the background jobs catch up.
  const profileSync = await syncParticipantProfiles({
    admin,
    workspaceId: group.workspace_id,
    groupId,
    participants,
  });

  // 5. Cross-reference against global blocklist (admin client - bypass RLS)
  type BlockEntry = {
    phone: string;
    report_count: number | null;
    unique_groups_count: number | null;
    unique_workspaces_count: number | null;
    reason_summary: string | null;
    is_confirmed: boolean | null;
    first_reported_at: string | null;
    last_reported_at: string | null;
  };

  const { data: blocklistedRaw, error: blockErr } = await admin
    .from('gg_global_blocklist')
    .select(`
      phone,
      report_count,
      unique_groups_count,
      unique_workspaces_count,
      reason_summary,
      is_confirmed,
      first_reported_at,
      last_reported_at
    `)
    .in('phone', normalizedPhones);

  const blocklisted = (blocklistedRaw ?? []) as BlockEntry[];

  if (blockErr) {
    console.error('[scan] blocklist lookup error:', blockErr);
    return NextResponse.json(
      { error: 'Failed to query blocklist' },
      { status: 500 },
    );
  }

  if (blocklisted.length === 0) {
    return NextResponse.json({
      members: [],
      scan_summary: {
        total_members: participants.length,
        flagged_count: 0,
        profiles_synced: profileSync.profiles_inserted,
        memberships_synced: profileSync.memberships_inserted,
        scanned_at: new Date().toISOString(),
      },
    });
  }

  // 6. Get any local member profiles for the flagged phones (for display names)
  const flaggedPhones = blocklisted.map((b: BlockEntry) => b.phone);
  const { data: profiles } = await admin
    .from('gg_member_profiles')
    .select('phone, full_name')
    .eq('workspace_id', group.workspace_id)
    .in('phone', flaggedPhones);

  const profileMap = new Map<string, string>();
  ((profiles ?? []) as Array<{ phone: string; full_name: string | null }>).forEach((p) => {
    if (p.full_name) profileMap.set(p.phone, p.full_name);
  });

  // 7. Build the response - merge participant data with blocklist data
  const blocklistMap = new Map(blocklisted.map((b: BlockEntry) => [b.phone, b]));
  const matches: BlocklistMatch[] = [];

  for (const participant of participants) {
    const phone = stripWhatsAppSuffix(participant.id);
    const blockEntry = blocklistMap.get(phone);
    if (!blockEntry) continue;

    matches.push({
      phone,
      whatsapp_id: participant.id,
      is_admin: participant.isAdmin || participant.isSuperAdmin,
      report_count: blockEntry.report_count ?? 0,
      unique_groups_count: blockEntry.unique_groups_count ?? 0,
      unique_workspaces_count: blockEntry.unique_workspaces_count ?? 0,
      reason_summary: blockEntry.reason_summary,
      is_confirmed: blockEntry.is_confirmed ?? false,
      first_reported_at: blockEntry.first_reported_at,
      last_reported_at: blockEntry.last_reported_at,
      has_member_profile: profileMap.has(phone),
      member_name: profileMap.get(phone) ?? null,
    });
  }

  // 8. Sort: confirmed spammers first, then by report_count descending
  matches.sort((a: BlocklistMatch, b: BlocklistMatch) => {
    if (a.is_confirmed !== b.is_confirmed) return a.is_confirmed ? -1 : 1;
    return b.report_count - a.report_count;
  });

  return NextResponse.json({
    members: matches,
    scan_summary: {
      total_members: participants.length,
      flagged_count: matches.length,
      profiles_synced: profileSync.profiles_inserted,
      memberships_synced: profileSync.memberships_inserted,
      scanned_at: new Date().toISOString(),
      group_name: group.group_name,
    },
  });
}


// ============================================================================
// syncParticipantProfiles
// ============================================================================
//
// Bulk-upsert all current group participants into gg_member_profiles +
// gg_member_groups, so they appear in the "חברי קבוצות" tab right away —
// not only after they happen to send a message.
//
// Strategy:
//   1. Upsert profiles by (workspace_id, phone) — phone is the unique key.
//      We pass minimal data: just phone + workspace_id. Names come later
//      from message webhooks (senderName), AI fields from extract-cron.
//      `ignoreDuplicates: false` lets existing rows pass through unchanged
//      (we don't want to clobber AI-extracted data with empty strings).
//   2. Bulk-select the resulting profile ids for the upserted phones.
//   3. Upsert (profile_id, group_id) into gg_member_groups, marking
//      first_seen_at = now() if new and last_seen_at = now() always.
//
// Performance: the sample group "בית" has 901 members. With Supabase's
// REST API a 901-row upsert lands in ~1-2 seconds. Bulk operations are
// always WAY faster than per-row loops — we never iterate.
//
// We swallow errors and just log them, returning counts. The scan
// shouldn't fail just because the profile sync hiccuped — the user
// still wants their blocklist results.

async function syncParticipantProfiles(opts: {
  admin: ReturnType<typeof createAdminClient>;
  workspaceId: string;
  groupId: string;
  participants: Array<{ id: string; isAdmin: boolean; isSuperAdmin: boolean }>;
}): Promise<{ profiles_inserted: number; memberships_inserted: number }> {
  const { admin, workspaceId, groupId, participants } = opts;

  // Build the rows. Strip @c.us / @s.whatsapp.net so phone is normalized.
  const profileRows = participants
    .map((p) => {
      const phone = stripWhatsAppSuffix(p.id);
      // Skip non-WA participants (e.g. lid/community broadcast addresses)
      // — those don't fit the "phone" shape and would pollute the table.
      if (!phone || !/^\d+$/.test(phone)) return null;
      return {
        workspace_id: workspaceId,
        phone,
        // first_seen_at / last_seen_at have DB defaults; we don't override
        // because for an existing row we don't want to clobber first_seen_at.
      };
    })
    .filter((r): r is { workspace_id: string; phone: string } => r !== null);

  if (profileRows.length === 0) {
    return { profiles_inserted: 0, memberships_inserted: 0 };
  }

  // Detect which of these phones are *new* members in this group, so we can
  // emit a 'gg_new_member' event to the Sheets sync queue. We need to do
  // this BEFORE the membership upsert so the lookup reflects pre-scan state.
  //
  // A "new member" = a profile_id that doesn't yet have a row in
  // gg_member_groups for this group_id. We compute the set up-front and
  // pass it to a fire-and-forget enqueue at the end of the function so
  // sheet sync latency never blocks the scan.
  const newMemberPhones: string[] = await detectNewMembers(
    admin,
    workspaceId,
    groupId,
    profileRows.map((r) => r.phone),
  );

  // Step 1: bulk-upsert profiles. The unique constraint on
  // (workspace_id, phone) makes this idempotent.
  const { error: profileErr } = await admin
    .from('gg_member_profiles')
    .upsert(profileRows, {
      onConflict: 'workspace_id,phone',
      ignoreDuplicates: true, // don't touch existing rows — they may have AI data we don't want to clobber
    });

  if (profileErr) {
    console.error('[scan] profile sync failed:', profileErr);
    return { profiles_inserted: 0, memberships_inserted: 0 };
  }

  // Step 2: select profile ids for all the phones we just upserted.
  // We need the ids to insert into gg_member_groups, and Supabase upsert
  // doesn't return existing-row ids, only newly inserted ones.
  const phones = profileRows.map((r) => r.phone);
  const { data: profileIds, error: selectErr } = await admin
    .from('gg_member_profiles')
    .select('id, phone')
    .eq('workspace_id', workspaceId)
    .in('phone', phones);

  if (selectErr || !profileIds) {
    console.error('[scan] profile id lookup failed:', selectErr);
    return { profiles_inserted: profileRows.length, memberships_inserted: 0 };
  }

  // Step 3: bulk-upsert memberships. We don't bump message_count here —
  // that's tracked by the message webhook, not by group membership scans.
  const membershipRows = profileIds.map((p: { id: string; phone: string }) => ({
    profile_id: p.id,
    group_id: groupId,
    last_seen_at: new Date().toISOString(),
    // first_seen_at + message_count keep DB defaults on insert; on conflict
    // we update only last_seen_at via the merge-duplicate strategy below.
  }));

  const { error: membershipErr } = await admin
    .from('gg_member_groups')
    .upsert(membershipRows, {
      onConflict: 'profile_id,group_id',
      ignoreDuplicates: false, // do bump last_seen_at for existing rows
    });

  if (membershipErr) {
    console.error('[scan] membership sync failed:', membershipErr);
    return { profiles_inserted: profileRows.length, memberships_inserted: 0 };
  }

  // Fire-and-forget: enqueue 'gg_new_member' events for each detected new
  // member. We don't await — the user wants the scan response fast, and
  // sheets sync is a nice-to-have. The Sheets sync queue is durable so
  // even if the request returns before these resolve, the events still
  // make it to the queue.
  if (newMemberPhones.length > 0) {
    emitNewMemberEvents(admin, workspaceId, groupId, newMemberPhones).catch(
      (e) => console.warn('[scan] sheets enqueue failed (non-fatal):', e),
    );
  }

  return {
    profiles_inserted: profileRows.length,
    memberships_inserted: membershipRows.length,
  };
}

// ============================================================================
// Helpers for new-member detection + Sheets sync emission
// ============================================================================

/**
 * Given a set of phones we're about to upsert, return the subset that
 * doesn't yet have a row in gg_member_groups for this group_id. Those
 * are the "new joiners" we want to emit as gg_new_member events.
 *
 * Returns an empty array if anything fails — we'd rather miss an event
 * than break the scan.
 */
async function detectNewMembers(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  groupId: string,
  phones: string[],
): Promise<string[]> {
  if (phones.length === 0) return [];

  try {
    // Find existing memberships for these phones in this group
    const { data: existingProfiles } = await admin
      .from('gg_member_profiles')
      .select('id, phone')
      .eq('workspace_id', workspaceId)
      .in('phone', phones);

    if (!existingProfiles || existingProfiles.length === 0) {
      // None of these phones exist as profiles yet → they're all new
      return phones;
    }

    const profileIdToPhone = new Map<string, string>(
      (existingProfiles as Array<{ id: string; phone: string }>).map((p) => [p.id, p.phone]),
    );
    const profileIds = Array.from(profileIdToPhone.keys());

    const { data: existingMemberships } = await admin
      .from('gg_member_groups')
      .select('profile_id')
      .eq('group_id', groupId)
      .in('profile_id', profileIds);

    const alreadyMemberProfileIds = new Set(
      (existingMemberships ?? []).map((m: { profile_id: string }) => m.profile_id),
    );

    // Phones with an existing profile but no membership in THIS group → new
    const newViaExistingProfile = profileIds
      .filter((id) => !alreadyMemberProfileIds.has(id))
      .map((id) => profileIdToPhone.get(id)!)
      .filter(Boolean);

    // Phones we've never seen as a profile at all → also new
    const existingPhones = new Set(profileIdToPhone.values());
    const phonesWithNoProfile = phones.filter((p) => !existingPhones.has(p));

    return [...newViaExistingProfile, ...phonesWithNoProfile];
  } catch (err) {
    console.warn('[scan] detectNewMembers failed:', err);
    return [];
  }
}

/**
 * Look up display name + profession etc. for the detected new members and
 * enqueue one gg_new_member event per phone. Batched DB read; per-phone
 * enqueue (since each may go to a different sheet config — actually no,
 * same config, but enqueueSheetSync is per-row so we call it per phone).
 */
async function emitNewMemberEvents(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  groupId: string,
  phones: string[],
): Promise<void> {
  // Look up group name once
  const { data: group } = await admin
    .from('gg_groups')
    .select('name')
    .eq('id', groupId)
    .maybeSingle();

  // Look up any existing profile metadata for these phones (in case AI
  // extraction has already populated fields)
  const { data: profiles } = await admin
    .from('gg_member_profiles')
    .select('phone, full_name, profession, trust_score')
    .eq('workspace_id', workspaceId)
    .in('phone', phones);

  const profileMap = new Map<string, any>(
    ((profiles ?? []) as any[]).map((p) => [p.phone, p]),
  );

  const ts = new Date().toISOString();
  await Promise.all(
    phones.map((phone) => {
      const p = profileMap.get(phone);
      return enqueueSheetSync('gg_new_member', workspaceId, {
        ts,
        workspaceId,
        groupId,
        groupName: group?.name ?? null,
        phone,
        displayName: p?.full_name ?? null,
        profession: p?.profession ?? null,
        trustScore: p?.trust_score ?? null,
        joinedAt: ts,
      });
    }),
  );
}
