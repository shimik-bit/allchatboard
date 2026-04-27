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

  // 1. Verify user has access to this group's workspace
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Load the group + workspace credentials
  const { data: group, error: groupErr } = await supabase
    .from('whatsapp_groups')
    .select(`
      id,
      workspace_id,
      green_api_chat_id,
      group_name,
      workspaces!inner (
        id,
        whatsapp_instance_id,
        whatsapp_token
      )
    `)
    .eq('id', groupId)
    .maybeSingle();

  if (groupErr || !group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }

  const workspace = Array.isArray(group.workspaces)
    ? group.workspaces[0]
    : group.workspaces;

  if (!workspace?.whatsapp_instance_id || !workspace?.whatsapp_token) {
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
      scanned_at: new Date().toISOString(),
      group_name: group.group_name,
    },
  });
}
