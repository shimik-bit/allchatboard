/**
 * WhatsApp Webhook Recovery — shared library
 * ===========================================
 *
 * Implements the core "detect + recover" flow that runs in three places:
 *   1. Manual button in InstancesManager → POST /api/whatsapp/recover
 *   2. Daily cron at 12:00 UTC → POST /api/whatsapp/recover-cron
 *   3. Silent auto-trigger from the dashboard layout → fire-and-forget
 *      whenever the user opens any page that loads /api/instances.
 *
 * Background: Green API occasionally enters a state where it stops pushing
 * incoming WhatsApp messages to our webhook URL even though it's still
 * receiving them on the WhatsApp side. The messages pile up in their queue.
 * The fix is to clear-and-reset the webhook URL on their side, which kicks
 * the delivery loop back to life. This file does both detection and recovery.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export const RECOVERY_WINDOW_MINUTES = 30;

/**
 * Throttle: don't auto-recover for the same instance more often than this.
 * Manual + cron triggers ignore the throttle and always run; only the
 * silent dashboard-load trigger checks it.
 */
export const SILENT_RECOVERY_MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export type RecoveryResult = {
  recovered: number;
  groups_created: number;
  webhook_reset: boolean;
  skipped?: 'throttled';
};

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

type Instance = {
  id: string;
  provider_instance_id: string;
  provider_token: string;
  last_recovery_check_at?: string | null;
};

/**
 * Run recovery for all authorized Green API instances in a workspace.
 *
 * @param opts.silent  When true, throttles per-instance to once every
 *                     SILENT_RECOVERY_MIN_INTERVAL_MS. When false (default),
 *                     always runs. Manual button + cron use false; the
 *                     dashboard-load auto-trigger uses true.
 */
export async function recoverWorkspaceInstances(opts: {
  admin: SupabaseClient;
  origin: string;
  workspaceId: string;
  silent?: boolean;
}): Promise<RecoveryResult & { instances_checked: number }> {
  const { admin, origin, workspaceId, silent = false } = opts;

  const { data: instances } = await admin
    .from('whatsapp_instances')
    .select('id, provider_instance_id, provider_token, last_recovery_check_at')
    .eq('workspace_id', workspaceId)
    .eq('provider', 'green_api')
    .eq('state', 'authorized');

  if (!instances || instances.length === 0) {
    return { instances_checked: 0, recovered: 0, groups_created: 0, webhook_reset: false };
  }

  let totalRecovered = 0;
  let totalGroupsCreated = 0;
  let anyWebhookReset = false;
  let checkedCount = 0;

  for (const inst of instances as Instance[]) {
    // Silent throttle: skip if we recovered for this instance recently.
    // Without this, a logged-in user opening many pages in quick succession
    // would each fire a recover that hits Green API + replays messages.
    if (silent && inst.last_recovery_check_at) {
      const sinceMs = Date.now() - new Date(inst.last_recovery_check_at).getTime();
      if (sinceMs < SILENT_RECOVERY_MIN_INTERVAL_MS) continue;
    }

    checkedCount++;
    const result = await recoverInstance({ admin, origin, workspaceId, instance: inst });
    totalRecovered += result.recovered;
    totalGroupsCreated += result.groups_created;
    if (result.webhook_reset) anyWebhookReset = true;

    // Stamp the run time regardless of result so the silent throttle works
    // even on no-op runs (no point hitting Green API again immediately).
    await admin
      .from('whatsapp_instances')
      .update({ last_recovery_check_at: new Date().toISOString() })
      .eq('id', inst.id);
  }

  return {
    instances_checked: checkedCount,
    recovered: totalRecovered,
    groups_created: totalGroupsCreated,
    webhook_reset: anyWebhookReset,
  };
}

/**
 * For a single instance: pull recent messages from Green API, compare with
 * wa_messages, and replay any that we missed. If gaps are found, also reset
 * the webhook URL on Green API to unstick future deliveries.
 */
async function recoverInstance(opts: {
  admin: SupabaseClient;
  origin: string;
  workspaceId: string;
  instance: Instance;
}): Promise<RecoveryResult> {
  const { admin, origin, workspaceId, instance } = opts;
  const baseUrl = getGreenApiBaseUrl(instance.provider_instance_id);
  const greenApiUrl = `${baseUrl}/waInstance${instance.provider_instance_id}/lastIncomingMessages/${instance.provider_token}?minutes=${RECOVERY_WINDOW_MINUTES}`;

  let recentMessages: GreenApiMessage[];
  try {
    const res = await fetch(greenApiUrl);
    if (!res.ok) return { recovered: 0, groups_created: 0, webhook_reset: false };
    recentMessages = await res.json();
    if (!Array.isArray(recentMessages)) {
      return { recovered: 0, groups_created: 0, webhook_reset: false };
    }
  } catch (err) {
    console.error('[recover] failed to fetch from green api:', err);
    return { recovered: 0, groups_created: 0, webhook_reset: false };
  }

  if (recentMessages.length === 0) {
    return { recovered: 0, groups_created: 0, webhook_reset: false };
  }

  // Find which IDs we DON'T have in wa_messages — these are the gap.
  const greenApiIds = recentMessages.map((m) => m.idMessage).filter(Boolean);
  const { data: existingRows } = await admin
    .from('wa_messages')
    .select('green_api_message_id')
    .in('green_api_message_id', greenApiIds);

  const existingIds = new Set(
    (existingRows || []).map((r: { green_api_message_id: string }) => r.green_api_message_id),
  );
  const missing = recentMessages.filter((m) => m.idMessage && !existingIds.has(m.idMessage));

  if (missing.length === 0) {
    return { recovered: 0, groups_created: 0, webhook_reset: false };
  }

  console.log(
    `[recover] ws=${workspaceId} instance=${instance.provider_instance_id} found ${missing.length} missing messages`,
  );

  // Auto-create any groups in the gap that we don't have yet. The webhook
  // would do this on its own, but doing it here lets us look up the real
  // group name once instead of seeing 'קבוצה ללא שם' in the UI.
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

    let groupName = 'קבוצה ללא שם';
    try {
      const gdRes = await fetch(
        `${baseUrl}/waInstance${instance.provider_instance_id}/getGroupData/${instance.provider_token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId: msg.chatId }),
        },
      );
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

  // Replay missing messages through the normal webhook flow so they go
  // through allowlist check, AI classification, optional bot reply.
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
    await new Promise((r) => setTimeout(r, 500));
  }

  // Kick the webhook on Green API's side to unstick future deliveries.
  let webhookReset = false;
  if (recovered > 0) {
    try {
      const setUrl = `${baseUrl}/waInstance${instance.provider_instance_id}/setSettings/${instance.provider_token}`;
      const webhookUrl = `${origin}/api/whatsapp/webhook?workspace=${workspaceId}`;
      await fetch(setUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: '' }),
      });
      await new Promise((r) => setTimeout(r, 1500));
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

  return { recovered, groups_created: groupsCreated, webhook_reset: webhookReset };
}

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
    messageData: { typeMessage: msg.typeMessage } as Record<string, unknown>,
  };

  if (msg.typeMessage === 'textMessage') {
    base.messageData.textMessageData = { textMessage: msg.textMessage || '' };
  } else if (msg.typeMessage === 'extendedTextMessage') {
    base.messageData.extendedTextMessageData = { text: msg.textMessage || '' };
  } else {
    base.messageData.textMessageData = { textMessage: msg.textMessage || '' };
  }

  return base;
}

function getGreenApiBaseUrl(instanceId: string): string {
  const prefix = instanceId.substring(0, 4);
  return `https://${prefix}.api.greenapi.com`;
}
