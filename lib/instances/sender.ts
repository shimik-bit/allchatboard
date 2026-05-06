/**
 * Provider-agnostic message sender
 * =================================
 *
 * One function — `sendMessage()` — that routes to the right WhatsApp
 * provider based on the instance row from the database. Use this for any
 * NEW outbound paths (composer, broadcasts, etc.) so we don't have to
 * grow more `if (provider === ...)` branches throughout the codebase.
 *
 * The existing webhook auto-reply path (sendGreenApiReply in
 * app/api/whatsapp/webhook/route.ts) is intentionally left alone for
 * back-compat. Migrating that 10+ call-site path is a separate refactor.
 *
 * What this supports right now:
 *   - green_api: text messages to chatId (DM or group)
 *   - meta:      text messages to phone (DMs only — Cloud API has no groups)
 *
 * What it explicitly rejects:
 *   - Sending to a group from a Cloud API instance (returns ok:false with
 *     a clear error rather than failing silently somewhere downstream).
 */

import { sendText as cloudSendText, type CloudApiCredentials } from './cloud-api-client';

export type SendableInstance = {
  id: string;
  provider: string;
  provider_instance_id: string;
  provider_token: string;
  state: string;
};

export type SendResult =
  | { ok: true; provider_message_id: string }
  | { ok: false; error: string };

/**
 * Send a text message via the right provider for this instance.
 *
 * @param target For green_api: a chatId (e.g. "972556691165@c.us" or
 *               "120363xxx@g.us"). For meta cloud: a phone digits string
 *               (e.g. "972556691165") — groups not supported.
 */
export async function sendMessage(opts: {
  instance: SendableInstance;
  target: string;
  text: string;
  /** Optional: id of the message we're replying to (for quoted reply) */
  replyTo?: string;
}): Promise<SendResult> {
  const { instance, target, text, replyTo } = opts;

  if (instance.state !== 'authorized') {
    return { ok: false, error: `instance not authorized (state=${instance.state})` };
  }

  switch (instance.provider) {
    case 'green_api':
      return sendViaGreenApi(instance, target, text, replyTo);

    case 'meta':
      return sendViaCloud(instance, target, text, replyTo);

    default:
      return { ok: false, error: `unsupported provider: ${instance.provider}` };
  }
}

async function sendViaGreenApi(
  instance: SendableInstance,
  chatId: string,
  text: string,
  quotedMessageId?: string,
): Promise<SendResult> {
  // Per-instance subdomain lookup (matches green-api-client.ts logic)
  const prefix = instance.provider_instance_id.substring(0, 4);
  const url = `https://${prefix}.api.greenapi.com/waInstance${instance.provider_instance_id}/sendMessage/${instance.provider_token}`;

  const body: Record<string, unknown> = { chatId, message: text };
  if (quotedMessageId) body.quotedMessageId = quotedMessageId;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: `green_api ${res.status}: ${JSON.stringify(data)}` };
    }
    const idMessage = (data as { idMessage?: string })?.idMessage;
    if (!idMessage) {
      return { ok: false, error: 'green_api returned 200 but no idMessage' };
    }
    return { ok: true, provider_message_id: idMessage };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'green_api send threw',
    };
  }
}

async function sendViaCloud(
  instance: SendableInstance,
  target: string,
  text: string,
  replyTo?: string,
): Promise<SendResult> {
  // Cloud API has no concept of groups. If someone passes a group chatId
  // (ends in @g.us) we reject loudly rather than letting Meta return a
  // confusing "invalid recipient" error.
  if (target.endsWith('@g.us')) {
    return {
      ok: false,
      error: 'Meta Cloud API does not support group messages. Use a green_api instance for groups.',
    };
  }

  const creds: CloudApiCredentials = {
    phoneNumberId: instance.provider_instance_id,
    accessToken: instance.provider_token,
  };

  const result = await cloudSendText(creds, target, text, { replyTo });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, provider_message_id: result.data.message_id };
}
