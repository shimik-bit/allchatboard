import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { verifyWebhookSignature } from '@/lib/instances/cloud-api-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Meta WhatsApp Cloud API webhook
 * =================================
 *
 * GET  → verification handshake (Meta calls once when you set the URL)
 * POST → incoming events (messages, status updates, etc.)
 *
 * Why this is separate from /api/whatsapp/webhook (Green API):
 *
 *   - Cloud API uses a completely different payload shape — the message
 *     comes nested inside entry[].changes[].value.messages[]. Trying to
 *     unify the two webhooks would mean a tangle of "which provider is
 *     this from" branches throughout an already-2,500-line route. Cleaner
 *     to keep them separate and let each handle its own quirks.
 *
 *   - Cloud API has its own verification handshake (hub.challenge), which
 *     Green API doesn't.
 *
 *   - Auto-reply is intentionally NOT triggered here yet. The bot's
 *     classify+reply pipeline is currently tightly coupled to
 *     sendGreenApiReply in the Green webhook. A follow-up PR will
 *     factor that out so Cloud incoming can also fire the AI auto-reply.
 *
 * Routing: the URL must end in ?instance=<id> so we know which Cloud API
 * instance the message belongs to. Each Cloud API customer registers
 * their webhook URL pointing at our endpoint with their instance id
 * appended as a query param. No JWT/secret is needed in the URL itself —
 * we use Meta's app secret + X-Hub-Signature-256 instead.
 */

type CloudWebhookEntry = {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: {
        display_phone_number: string;
        phone_number_id: string;
      };
      contacts?: Array<{
        profile?: { name?: string };
        wa_id: string;
      }>;
      messages?: Array<{
        from: string; // wa_id of sender
        id: string;
        timestamp: string; // unix seconds, as a string
        type: string;
        text?: { body: string };
        image?: { id: string; mime_type: string; caption?: string };
        document?: { id: string; mime_type: string; filename?: string; caption?: string };
        audio?: { id: string; mime_type: string };
        video?: { id: string; mime_type: string; caption?: string };
        sticker?: { id: string; mime_type: string };
        button?: { payload: string; text: string };
        interactive?: {
          type: 'button_reply' | 'list_reply';
          button_reply?: { id: string; title: string };
          list_reply?: { id: string; title: string; description?: string };
        };
        context?: { from: string; id: string }; // when replying to another message
      }>;
      statuses?: Array<{
        id: string;
        status: string;
        timestamp: string;
        recipient_id: string;
        conversation?: { id: string };
      }>;
    };
    field: string;
  }>;
};

type CloudWebhookBody = {
  object: string;
  entry: CloudWebhookEntry[];
};

// ============================================================================
// GET: verification handshake (one-time when Meta registers the URL)
// ============================================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const challenge = searchParams.get('hub.challenge');
  const token = searchParams.get('hub.verify_token');
  const instanceParam = searchParams.get('instance');

  if (mode !== 'subscribe' || !challenge || !instanceParam) {
    return new NextResponse('bad request', { status: 400 });
  }

  // Look up the instance + its expected verify_token. Meta sends whatever
  // verify_token the user configured in their Meta app — we compare it
  // against what's stored in provider_metadata.webhook_verify_token.
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: instance } = await admin
    .from('whatsapp_instances')
    .select('id, provider, provider_metadata')
    .eq('id', instanceParam)
    .eq('provider', 'meta')
    .maybeSingle();

  if (!instance) {
    return new NextResponse('instance not found', { status: 404 });
  }

  const expectedToken = (instance.provider_metadata as { webhook_verify_token?: string } | null)
    ?.webhook_verify_token;

  if (!expectedToken || token !== expectedToken) {
    return new NextResponse('verify token mismatch', { status: 403 });
  }

  // Meta wants the challenge echoed back as plain text
  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

// ============================================================================
// POST: incoming events
// ============================================================================

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const instanceParam = searchParams.get('instance');
  if (!instanceParam) {
    return NextResponse.json({ error: 'instance query param required' }, { status: 400 });
  }

  // We need the raw body for signature verification — re-parsing later from
  // text → JSON is fine.
  const rawBody = await req.text();

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: instance } = await admin
    .from('whatsapp_instances')
    .select('id, workspace_id, provider, provider_instance_id, provider_token, provider_metadata')
    .eq('id', instanceParam)
    .eq('provider', 'meta')
    .maybeSingle();

  if (!instance) {
    return NextResponse.json({ error: 'instance not found' }, { status: 404 });
  }

  // Verify signature if app_secret is configured. Skip cleanly if not —
  // some users may run without it during initial setup.
  const appSecret = (instance.provider_metadata as { app_secret?: string } | null)?.app_secret;
  if (appSecret) {
    const signature = req.headers.get('x-hub-signature-256');
    const valid = await verifyWebhookSignature({
      rawBody,
      signatureHeader: signature,
      appSecret,
    });
    if (!valid) {
      console.warn(`[cloud-webhook] signature mismatch for instance ${instance.id}`);
      // Per Meta docs, ALWAYS return 200 even on bad signature — otherwise
      // they'll retry indefinitely. We just don't process the event.
      return NextResponse.json({ ok: true, ignored: 'bad_signature' });
    }
  }

  let body: CloudWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true, ignored: 'invalid_json' });
  }

  if (body.object !== 'whatsapp_business_account') {
    return NextResponse.json({ ok: true, ignored: 'wrong_object' });
  }

  let messagesPersisted = 0;
  let statusesPersisted = 0;

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;

      const value = change.value;

      // 1. Process incoming messages
      for (const msg of value.messages || []) {
        const persisted = await persistIncomingMessage({
          admin,
          workspaceId: instance.workspace_id,
          msg,
          contacts: value.contacts || [],
        });
        if (persisted) messagesPersisted++;
      }

      // 2. Process status updates (delivered, read, sent, failed)
      for (const status of value.statuses || []) {
        const persisted = await persistStatusUpdate({
          admin,
          workspaceId: instance.workspace_id,
          status,
        });
        if (persisted) statusesPersisted++;
      }
    }
  }

  // Bump messages_received_total on the instance so the UI reflects activity
  if (messagesPersisted > 0) {
    await admin
      .from('whatsapp_instances')
      .update({
        last_message_at: new Date().toISOString(),
      })
      .eq('id', instance.id);
  }

  return NextResponse.json({
    ok: true,
    messages_persisted: messagesPersisted,
    statuses_persisted: statusesPersisted,
  });
}

// ============================================================================
// Helpers: normalize Cloud API events into our wa_messages schema
// ============================================================================

async function persistIncomingMessage(opts: {
  admin: any; // Service-role Supabase client. Loose-typed to avoid SupabaseClient<> generic friction.
  workspaceId: string;
  msg: NonNullable<CloudWebhookEntry['changes'][number]['value']['messages']>[number];
  contacts: NonNullable<CloudWebhookEntry['changes'][number]['value']['contacts']>;
}): Promise<boolean> {
  const { admin, workspaceId, msg, contacts } = opts;

  // Extract a usable text representation per message type. We don't try to
  // download media here — that would balloon the webhook latency. Media
  // resolution can happen lazily when something actually wants the file.
  const text = extractText(msg);
  const senderPhone = msg.from; // wa_id, no @c.us suffix
  const senderName = contacts.find((c) => c.wa_id === msg.from)?.profile?.name || null;

  const receivedAt = new Date(parseInt(msg.timestamp, 10) * 1000).toISOString();

  // Idempotency: same provider message id should never insert twice. We
  // rely on the unique index on (workspace_id, green_api_message_id) —
  // even though the column is named for green_api, it's effectively the
  // "provider message id" slot for any provider.
  const { error } = await admin.from('wa_messages').insert({
    workspace_id: workspaceId,
    green_api_message_id: msg.id,
    sender_phone: senderPhone,
    sender_name: senderName,
    direction: 'in',
    text,
    media_type: msg.type !== 'text' ? msg.type : null,
    received_at: receivedAt,
    status: 'received',
    group_id: null, // Cloud API has no groups
  });

  if (error) {
    // Duplicate key is expected on retries — not a real error.
    if (error.code === '23505') return false;
    console.error('[cloud-webhook] insert failed:', error);
    return false;
  }

  return true;
}

async function persistStatusUpdate(opts: {
  admin: any; // Service-role Supabase client. Loose-typed to avoid SupabaseClient<> generic friction.
  workspaceId: string;
  status: NonNullable<CloudWebhookEntry['changes'][number]['value']['statuses']>[number];
}): Promise<boolean> {
  const { admin, status } = opts;

  // Map Meta's status vocabulary onto whatever we already use internally.
  // Meta uses: sent, delivered, read, failed
  // We just store whatever string they sent — UI can interpret.
  const { error } = await admin
    .from('wa_messages')
    .update({ status: status.status })
    .eq('green_api_message_id', status.id);

  if (error) {
    console.error('[cloud-webhook] status update failed:', error);
    return false;
  }
  return true;
}

function extractText(
  msg: NonNullable<CloudWebhookEntry['changes'][number]['value']['messages']>[number],
): string {
  switch (msg.type) {
    case 'text':
      return msg.text?.body || '';
    case 'image':
      return msg.image?.caption ? `[image] ${msg.image.caption}` : '[image]';
    case 'document':
      return msg.document?.caption
        ? `[document: ${msg.document.filename || 'file'}] ${msg.document.caption}`
        : `[document: ${msg.document?.filename || 'file'}]`;
    case 'audio':
      return '[audio]';
    case 'video':
      return msg.video?.caption ? `[video] ${msg.video.caption}` : '[video]';
    case 'sticker':
      return '[sticker]';
    case 'button':
      return msg.button?.text || '[button reply]';
    case 'interactive':
      if (msg.interactive?.type === 'button_reply') {
        return msg.interactive.button_reply?.title || '[button reply]';
      }
      if (msg.interactive?.type === 'list_reply') {
        return msg.interactive.list_reply?.title || '[list reply]';
      }
      return '[interactive reply]';
    default:
      return `[${msg.type}]`;
  }
}
