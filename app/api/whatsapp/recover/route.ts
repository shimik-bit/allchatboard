import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/whatsapp/recover
 *
 * Detects + recovers from a stuck Green API webhook delivery.
 *
 * Background: Green API occasionally enters a state where it stops pushing
 * incoming messages to our webhook URL even though it's still receiving
 * them on the WhatsApp side. The messages pile up in their queue. The fix
 * is to clear and re-set the webhook URL on their side, which kicks the
 * delivery loop back to life.
 *
 * This endpoint does both detection and recovery in one pass:
 *   1. Pull the latest messages Green API has received in the last 30 min
 *   2. Compare against what we have in wa_messages for the same instance
 *   3. For each message Green API has but we don't:
 *      a. Auto-create the group in whatsapp_groups if missing
 *      b. POST a synthesized webhook payload back to our own /webhook route
 *         so the message goes through the normal pipeline (classification,
 *         saved to DB, optional bot reply)
 *   4. If we recovered any messages, also reset the webhook URL on Green API
 *      to unstick future deliveries
 *
 * Auth: workspace member (the recovery is scoped to a single workspace +
 *       its instances).
 *
 * Usage:
 *   - Manual: POST from the dashboard "Refresh status" button
 *   - Scheduled: hooked into the daily cron alongside profile rescan
 *
 * Returns:
 *   {
 *     ok: true,
 *     instances_checked: number,
 *     messages_recovered: number,
 *     groups_created: number,
 *     webhook_reset: boolean,
 *   }
 */

type GreenApiMessage = {
  idMessage: string;
  timestamp: number;
  typeMessage: string;
  chatId: string;
  textMessage?: string;
  senderId: string;
  senderName?: string;
  senderContactName?: string;
};

const RECOVERY_WINDOW_MINUTES = 30;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { workspace_id?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const workspaceId = body.workspace_id;
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }

  // Authorize: caller must be in the workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();
  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  // Find authorized + connected Green API instances for this workspace
  const { data: instances } = await admin
    .from('whatsapp_instances')
    .select('id, provider_instance_id, provider_token')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'green_api')
    .eq('state', 'authorized');

  if (!instances || instances.length === 0) {
    return NextResponse.json({
      ok: true,
      instances_checked: 0,
      messages_recovered: 0,
      groups_created: 0,
      webhook_reset: false,
      message: 'no_authorized_instances',
    });
  }

  const origin = req.headers.get('origin') || `https://${req.headers.get('host') || 'taskflow-ai.com'}`;
  let totalRecovered = 0;
  let totalGroupsCreated = 0;
  let anyWebhookReset = false;

  for (const inst of instances) {
    const result = await recoverInstance(admin, origin, workspaceId, inst);
    totalRecovered += result.recovered;
    totalGroupsCreated += result.groupsCreated;
    if (result.webhookReset) anyWebhookReset = true;
  }

  return NextResponse.json({
    ok: true,
    instances_checked: instances.length,
    messages_recovered: totalRecovered,
    groups_created: totalGroupsCreated,
    webhook_reset: anyWebhookReset,
  });
}

/**
 * For a single instance: pull recent messages from Green API, compare with
 * wa_messages, and replay any that we missed.
 */
async function recoverInstance(
  admin: ReturnType<typeof createAdminClient>,
  origin: string,
  workspaceId: string,
  instance: { provider_instance_id: string; provider_token: string },
): Promise<{ recovered: number; groupsCreated: number; webhookReset: boolean }> {
  const baseUrl = getGreenApiBaseUrl(instance.provider_instance_id);
  const greenApiUrl = `${baseUrl}/waInstance${instance.provider_instance_id}/lastIncomingMessages/${instance.provider_token}?minutes=${RECOVERY_WINDOW_MINUTES}`;

  let recentMessages: GreenApiMessage[];
  try {
    const res = await fetch(greenApiUrl);
    if (!res.ok) return { recovered: 0, groupsCreated: 0, webhookReset: false };
    recentMessages = await res.json();
    if (!Array.isArray(recentMessages)) {
      return { recovered: 0, groupsCreated: 0, webhookReset: false };
    }
  } catch (err) {
    console.error('[recover] failed to fetch from green api:', err);
    return { recovered: 0, groupsCreated: 0, webhookReset: false };
  }

  if (recentMessages.length === 0) {
    return { recovered: 0, groupsCreated: 0, webhookReset: false };
  }

  // Find which of these IDs we DON'T have in our DB. We check by green_api_message_id
  // since that's the unique id Green API assigns.
  const greenApiIds = recentMessages.map((m) => m.idMessage).filter(Boolean);
  const { data: existingRows } = await admin
    .from('wa_messages')
    .select('green_api_message_id')
    .in('green_api_message_id', greenApiIds);

  const existingIds = new Set((existingRows || []).map((r: { green_api_message_id: string }) => r.green_api_message_id));
  const missing = recentMessages.filter((m) => m.idMessage && !existingIds.has(m.idMessage));

  if (missing.length === 0) {
    // No gap detected — webhook is delivering normally. Don't reset it unnecessarily.
    return { recovered: 0, groupsCreated: 0, webhookReset: false };
  }

  console.log(`[recover] instance=${instance.provider_instance_id} found ${missing.length} missing messages`);

  // Auto-create groups for any group chats we don't yet have. Without this,
  // the webhook would create them itself, but doing it here in batch is
  // marginally faster and lets us use one chatName lookup per group.
  let groupsCreated = 0;
  const seenGroups = new Set<string>();
  for (const msg of missing) {
    if (!msg.chatId.endsWith('@g.us')) continue;
    if (seenGroups.has(msg.chatId)) continue;
    seenGroups.add(msg.chatId);

    const { data: existing } = await admin
      .from('whatsapp_groups')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('green_api_chat_id', msg.chatId)
      .maybeSingle();
    if (existing) continue;

    // Look up the group name from Green API for a nicer record
    let groupName = 'קבוצה ללא שם';
    try {
      const gdRes = await fetch(`${getGreenApiBaseUrl(instance.provider_instance_id)}/waInstance${instance.provider_instance_id}/getGroupData/${instance.provider_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: msg.chatId }),
      });
      if (gdRes.ok) {
        const gd = await gdRes.json();
        if (gd?.subject) groupName = gd.subject;
      }
    } catch {}

    const { error: insertErr } = await admin.from('whatsapp_groups').insert({
      workspace_id: workspaceId,
      green_api_chat_id: msg.chatId,
      group_name: groupName,
      is_active: true,
    });
    if (!insertErr) groupsCreated++;
  }

  // Now replay each missing message through our own webhook so it goes
  // through the full pipeline (allowlist check, AI classification, etc).
  // We do this sequentially to avoid hammering Green API with bot replies.
  let recovered = 0;
  for (const msg of missing) {
    const payload = synthesizeWebhookPayload(instance.provider_instance_id, msg);
    try {
      const replayRes = await fetch(
        `${origin}/api/whatsapp/webhook?workspace=${workspaceId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (replayRes.ok) recovered++;
    } catch (err) {
      console.error('[recover] replay failed:', msg.idMessage, err);
    }
    // Small delay between replays so we don't burst-trigger 7+ AI classifications
    // and bot replies all at once
    await new Promise((r) => setTimeout(r, 500));
  }

  // We had a real gap → kick the webhook on Green API's side to unstick
  // future deliveries. Clear-then-set is the pattern that consistently
  // works (just re-sending the same URL is idempotent and doesn't rebuild
  // their delivery loop).
  let webhookReset = false;
  if (recovered > 0) {
    try {
      const setUrl = `${getGreenApiBaseUrl(instance.provider_instance_id)}/waInstance${instance.provider_instance_id}/setSettings/${instance.provider_token}`;
      const webhookUrl = `${origin}/api/whatsapp/webhook?workspace=${workspaceId}`;

      // Step 1: clear
      await fetch(setUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: '' }),
      });
      await new Promise((r) => setTimeout(r, 1500));
      // Step 2: re-set
      await fetch(setUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl,
          incomingWebhook: 'yes',
          outgoingWebhook: 'yes',
          stateWebhook: 'yes',
        }),
      });
      webhookReset = true;
    } catch (err) {
      console.error('[recover] webhook reset failed:', err);
    }
  }

  return { recovered, groupsCreated, webhookReset };
}

/**
 * Build a webhook payload that mimics what Green API would send for an
 * incoming message. Used by the replay loop above.
 */
function synthesizeWebhookPayload(instanceId: string, msg: GreenApiMessage): unknown {
  const base = {
    typeWebhook: 'incomingMessageReceived',
    instanceData: { idInstance: Number(instanceId) },
    idMessage: msg.idMessage,
    senderData: {
      chatId: msg.chatId,
      sender: msg.senderId,
      senderName: msg.senderName || msg.senderContactName || '',
      chatName: '',
    },
    messageData: { typeMessage: msg.typeMessage },
  };

  // Green API stores text in different places per message type — mirror that
  if (msg.typeMessage === 'textMessage') {
    (base.messageData as any).textMessageData = { textMessage: msg.textMessage || '' };
  } else if (msg.typeMessage === 'extendedTextMessage') {
    (base.messageData as any).extendedTextMessageData = { text: msg.textMessage || '' };
  } else {
    // For other types (audio, image, etc.) we have less info from
    // lastIncomingMessages, so we just pass what we have. The webhook will
    // handle missing fields gracefully.
    (base.messageData as any).textMessageData = { textMessage: msg.textMessage || '' };
  }

  return base;
}

function getGreenApiBaseUrl(instanceId: string): string {
  // Per-instance prefix — the first 4 digits of the instance ID determine
  // the API region. This matches lib/instances/green-api-client.ts logic.
  const prefix = instanceId.substring(0, 4);
  return `https://${prefix}.api.greenapi.com`;
}
