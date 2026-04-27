/**
 * GroupGuard - Bulk remove members from group
 * ============================================================================
 *
 * POST /api/groupguard/groups/[id]/bulk-remove
 * Body: { phones: string[] }   // normalized, no @c.us
 *
 * Removes the listed members from the WhatsApp group via Green API.
 * Logs each removal as a 'kick' action with source='manual_scan'.
 * Returns per-phone success/failure status.
 *
 * Auth: workspace member with edit permissions.
 * Requires the bot to be a group admin (otherwise removals will fail).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { removeGroupParticipant } from '@/lib/groupguard/green-api-client';

export const dynamic = 'force-dynamic';

interface RemovalResult {
  phone: string;
  success: boolean;
  error?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const groupId = params.id;
  const supabase = createClient();
  const admin = createAdminClient();

  // 1. Auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse body
  let body: { phones?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const phones = Array.isArray(body.phones)
    ? body.phones.filter((p): p is string => typeof p === 'string').slice(0, 50)
    : [];

  if (phones.length === 0) {
    return NextResponse.json({ error: 'No phones provided' }, { status: 400 });
  }

  // 3. Load group + workspace
  const { data: group, error: groupErr } = await supabase
    .from('whatsapp_groups')
    .select(`
      id,
      workspace_id,
      green_api_chat_id,
      group_name,
      gg_is_admin,
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

  // 4. Warn if bot is not admin (removals will fail but we proceed anyway)
  const botNotAdminWarning = !group.gg_is_admin;

  // 5. Remove each participant sequentially with small delay (avoid rate limit)
  const creds = {
    instanceId: workspace.whatsapp_instance_id,
    apiToken: workspace.whatsapp_token,
  };

  const results: RemovalResult[] = [];
  const successfulPhones: string[] = [];

  for (const phone of phones) {
    try {
      const removeResult = await removeGroupParticipant(
        creds,
        group.green_api_chat_id,
        phone, // Function adds @c.us internally
      );

      if (removeResult.ok) {
        results.push({ phone, success: true });
        successfulPhones.push(phone);
      } else {
        results.push({
          phone,
          success: false,
          error: removeResult.error ?? 'Unknown error',
        });
      }
    } catch (err) {
      results.push({
        phone,
        success: false,
        error: err instanceof Error ? err.message : 'Exception',
      });
    }

    // 200ms throttle between calls
    await new Promise((r) => setTimeout(r, 200));
  }

  // 6. Log successful removals to gg_actions_log
  if (successfulPhones.length > 0) {
    const logEntries = successfulPhones.map((phone) => ({
      workspace_id: group.workspace_id,
      group_id: group.id,
      target_phone: phone,
      action_type: 'kick',
      trigger_source: 'global_blocklist',
      reason: 'Removed via manual blocklist scan',
      success: true,
      created_at: new Date().toISOString(),
    }));

    const { error: logErr } = await admin
      .from('gg_actions_log')
      .insert(logEntries);

    if (logErr) {
      console.warn('[bulk-remove] failed to log actions:', logErr);
      // don't fail the request - removals already happened
    }
  }

  return NextResponse.json({
    results,
    summary: {
      total: phones.length,
      successful: successfulPhones.length,
      failed: phones.length - successfulPhones.length,
      bot_not_admin_warning: botNotAdminWarning,
    },
  });
}
