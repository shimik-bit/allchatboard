/**
 * Meta WhatsApp Cloud API client
 * ================================
 *
 * Pure HTTP wrapper around Meta's Graph API for WhatsApp Business. Handles
 * sending text/template/media messages, marking messages as read, and
 * fetching phone-number metadata. Receiving lives in the webhook route.
 *
 * Differences from Green API worth flagging up front:
 *
 *   1. **Templates required for cold outbound.** You can only send a free-
 *      form message inside the 24h "customer service window" — i.e. the
 *      customer has to have messaged YOU within the last 24 hours.
 *      Outside that window every outbound goes through an approved
 *      template. We expose sendTemplate() for that.
 *
 *   2. **No groups.** At all. The whole concept doesn't exist on Cloud
 *      API. Caller code that depends on groups (GroupGuard, summaries,
 *      member profiles) should skip Cloud instances entirely.
 *
 *   3. **Phone numbers come back as wa_id.** The Graph API uses "wa_id"
 *      everywhere where Green API uses chatId/phone. Same digits, no
 *      "@c.us" suffix.
 *
 *   4. **Conversation-based pricing.** Every 24h "conversation" with a
 *      user is billed by Meta. Helper utility provided to extract the
 *      conversation id from send responses so callers can track this
 *      themselves if they care.
 *
 * Auth: long-lived System User access token recommended. Store in
 * whatsapp_instances.provider_token. The token typically lasts 60 days
 * (or never if it's a permanent System User token).
 */

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export type CloudApiCredentials = {
  /** phone_number_id from Meta — the unique identifier for the WhatsApp business number */
  phoneNumberId: string;
  /** Long-lived access token (System User token recommended) */
  accessToken: string;
};

export type CloudApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; statusCode?: number; meta?: unknown };

export type SendTextResult = {
  message_id: string;
  contact_wa_id: string;
};

// ============================================================================
// Phone number info / verify credentials
// ============================================================================

/**
 * Fetch the metadata for the connected phone number. Doubles as a creds-
 * verification ping — if this returns ok, the access_token + phone_number_id
 * are valid and the number is in good standing with Meta.
 */
export async function getPhoneNumberInfo(
  creds: CloudApiCredentials,
): Promise<
  CloudApiResult<{
    id: string;
    display_phone_number: string;
    verified_name: string;
    quality_rating?: string;
  }>
> {
  return graphGet<{
    id: string;
    display_phone_number: string;
    verified_name: string;
    quality_rating?: string;
  }>(creds, `/${creds.phoneNumberId}`);
}

// ============================================================================
// Send: text (24h window only)
// ============================================================================

/**
 * Send a free-form text message. Only works inside the 24-hour customer
 * service window (i.e. the user messaged us within the last 24h).
 * For cold outbound, use sendTemplate() instead.
 *
 * @param toPhone - recipient phone in E.164-without-plus format (e.g. "972556691165")
 */
export async function sendText(
  creds: CloudApiCredentials,
  toPhone: string,
  text: string,
  opts?: { previewUrl?: boolean; replyTo?: string },
): Promise<CloudApiResult<SendTextResult>> {
  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhone(toPhone),
    type: 'text',
    text: {
      body: text,
      preview_url: opts?.previewUrl ?? false,
    },
  };
  if (opts?.replyTo) {
    body.context = { message_id: opts.replyTo };
  }

  const res = await graphPost<{
    messaging_product: string;
    contacts: Array<{ input: string; wa_id: string }>;
    messages: Array<{ id: string; message_status?: string }>;
  }>(creds, `/${creds.phoneNumberId}/messages`, body);

  if (!res.ok) return res;

  const messageId = res.data.messages?.[0]?.id;
  const contactWaId = res.data.contacts?.[0]?.wa_id;
  if (!messageId || !contactWaId) {
    return {
      ok: false,
      error: 'Cloud API returned 200 but no message id / contact wa_id',
      meta: res.data,
    };
  }

  return { ok: true, data: { message_id: messageId, contact_wa_id: contactWaId } };
}

// ============================================================================
// Send: template (always allowed, must be pre-approved in Meta dashboard)
// ============================================================================

export type TemplateComponent =
  | { type: 'header'; parameters: Array<{ type: 'text'; text: string }> }
  | { type: 'body'; parameters: Array<{ type: 'text'; text: string }> }
  | {
      type: 'button';
      sub_type: 'quick_reply' | 'url';
      index: number;
      parameters: Array<{ type: 'payload' | 'text'; payload?: string; text?: string }>;
    };

/**
 * Send a pre-approved template. Templates are created via the Meta Business
 * Manager and reviewed by Meta. This is the only way to message a user
 * outside the 24-hour service window.
 *
 * @param templateName - the exact name of the approved template
 * @param languageCode - BCP-47 language tag (e.g. "he", "en_US")
 * @param components - variable substitutions for the template
 */
export async function sendTemplate(
  creds: CloudApiCredentials,
  toPhone: string,
  templateName: string,
  languageCode: string,
  components?: TemplateComponent[],
): Promise<CloudApiResult<SendTextResult>> {
  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to: normalizePhone(toPhone),
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components && components.length > 0 ? { components } : {}),
    },
  };

  const res = await graphPost<{
    messaging_product: string;
    contacts: Array<{ input: string; wa_id: string }>;
    messages: Array<{ id: string }>;
  }>(creds, `/${creds.phoneNumberId}/messages`, body);

  if (!res.ok) return res;
  const messageId = res.data.messages?.[0]?.id;
  const contactWaId = res.data.contacts?.[0]?.wa_id;
  if (!messageId || !contactWaId) {
    return { ok: false, error: 'Cloud API returned 200 but no message id', meta: res.data };
  }
  return { ok: true, data: { message_id: messageId, contact_wa_id: contactWaId } };
}

// ============================================================================
// Send: media (image, document, audio, video, sticker)
// ============================================================================

export type MediaType = 'image' | 'document' | 'audio' | 'video' | 'sticker';

export async function sendMedia(
  creds: CloudApiCredentials,
  toPhone: string,
  mediaType: MediaType,
  mediaUrl: string,
  opts?: { caption?: string; filename?: string; replyTo?: string },
): Promise<CloudApiResult<SendTextResult>> {
  const mediaPayload: Record<string, unknown> = { link: mediaUrl };
  // Only image, video and document support captions; audio/sticker don't.
  if (
    opts?.caption &&
    (mediaType === 'image' || mediaType === 'video' || mediaType === 'document')
  ) {
    mediaPayload.caption = opts.caption;
  }
  // Only document supports custom filename
  if (opts?.filename && mediaType === 'document') {
    mediaPayload.filename = opts.filename;
  }

  const body: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizePhone(toPhone),
    type: mediaType,
    [mediaType]: mediaPayload,
  };
  if (opts?.replyTo) {
    body.context = { message_id: opts.replyTo };
  }

  const res = await graphPost<{
    messaging_product: string;
    contacts: Array<{ input: string; wa_id: string }>;
    messages: Array<{ id: string }>;
  }>(creds, `/${creds.phoneNumberId}/messages`, body);

  if (!res.ok) return res;
  const messageId = res.data.messages?.[0]?.id;
  const contactWaId = res.data.contacts?.[0]?.wa_id;
  if (!messageId || !contactWaId) {
    return { ok: false, error: 'Cloud API returned 200 but no message id', meta: res.data };
  }
  return { ok: true, data: { message_id: messageId, contact_wa_id: contactWaId } };
}

// ============================================================================
// Mark incoming message as read (turns the double-grey ticks blue)
// ============================================================================

export async function markAsRead(
  creds: CloudApiCredentials,
  incomingMessageId: string,
): Promise<CloudApiResult<{ success: boolean }>> {
  return graphPost<{ success: boolean }>(creds, `/${creds.phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: incomingMessageId,
  });
}

// ============================================================================
// Download incoming media (incoming webhook gives a media id, we have to
// resolve it to a URL ourselves and fetch it with the access token)
// ============================================================================

/**
 * Resolve a media_id from an incoming message into a downloadable URL.
 * The URL is short-lived and can only be fetched with the same access token.
 */
export async function getMediaUrl(
  creds: CloudApiCredentials,
  mediaId: string,
): Promise<CloudApiResult<{ url: string; mime_type: string; sha256: string; file_size: number }>> {
  return graphGet<{ url: string; mime_type: string; sha256: string; file_size: number }>(
    creds,
    `/${mediaId}`,
  );
}

// ============================================================================
// Internal: HTTP helpers
// ============================================================================

async function graphGet<T>(creds: CloudApiCredentials, path: string): Promise<CloudApiResult<T>> {
  try {
    const res = await fetch(`${GRAPH_BASE_URL}${path}`, {
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
      },
    });
    return parseGraphResponse<T>(res);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error in Graph GET',
    };
  }
}

async function graphPost<T>(
  creds: CloudApiCredentials,
  path: string,
  body: Record<string, unknown>,
): Promise<CloudApiResult<T>> {
  try {
    const res = await fetch(`${GRAPH_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return parseGraphResponse<T>(res);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error in Graph POST',
    };
  }
}

async function parseGraphResponse<T>(res: Response): Promise<CloudApiResult<T>> {
  const data: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Meta returns errors as { error: { message, type, code, error_subcode, ... } }
    const errObj = (data as { error?: { message?: string; code?: number; error_subcode?: number } })?.error;
    const errMsg = errObj?.message || `Graph API ${res.status}`;
    return {
      ok: false,
      statusCode: res.status,
      error: errObj?.code ? `${errMsg} (code ${errObj.code})` : errMsg,
      meta: data,
    };
  }

  return { ok: true, data: data as T };
}

// ============================================================================
// Webhook signature verification (optional but recommended in production)
// ============================================================================

/**
 * Verify the X-Hub-Signature-256 header on an incoming webhook against the
 * app secret. Skip the check if appSecret is empty (e.g. local dev).
 *
 * Note: Web Crypto isn't available in some Vercel runtimes for arbitrary
 * keys, so we use Node's built-in 'crypto' here. That's why webhook routes
 * using this need `runtime = 'nodejs'`.
 */
export async function verifyWebhookSignature(opts: {
  rawBody: string;
  signatureHeader: string | null;
  appSecret: string;
}): Promise<boolean> {
  if (!opts.appSecret) return true; // not configured = skip
  if (!opts.signatureHeader) return false;

  // Header format: "sha256=<hex>"
  const expected = opts.signatureHeader.replace(/^sha256=/, '').toLowerCase();
  if (!expected) return false;

  const { createHmac, timingSafeEqual } = await import('crypto');
  const computed = createHmac('sha256', opts.appSecret)
    .update(opts.rawBody, 'utf8')
    .digest('hex');

  if (expected.length !== computed.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(computed, 'hex'));
  } catch {
    return false;
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Normalize a phone number for Cloud API. Cloud API wants E.164 without
 * the leading "+", so "+972556691165" or "972556691165@c.us" both become
 * "972556691165".
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/^\+/, '').replace(/@c\.us$/, '').replace(/@s\.whatsapp\.net$/, '');
}
