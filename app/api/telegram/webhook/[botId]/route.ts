import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Telegram webhook receiver.
 *
 * Configured automatically when a bot is added — see app/api/telegram/bots/route.ts
 * which calls Telegram's setWebhook with this URL and a per-bot secret.
 *
 * Security:
 *   Telegram sends the per-bot secret in the X-Telegram-Bot-Api-Secret-Token
 *   header. We compare it to the secret stored in telegram_bots.webhook_secret.
 *   Without this match the request is rejected with 401.
 *
 * Idempotency:
 *   Telegram retries on non-200 responses. The unique (bot_id, tg_update_id)
 *   constraint on telegram_messages dedupes retries silently.
 *
 * Performance contract:
 *   Telegram considers webhooks failed after 60s. We must respond 200 fast.
 *   Therefore: parse → dedupe-check → upsert chat → insert message → return 200.
 *   Heavy work (AI classification, downloading media) is NOT done in this
 *   handler; it's left for downstream consumers (Phase 2.2 / 2.5).
 *
 * What we don't process here:
 *   - getFile / media download — Phase 2.5
 *   - AI classification — Phase 2.2 (will run on the messages after they land)
 *   - Send replies — Phase 2.3 has its own endpoint
 */

interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  reply_to_message?: { message_id: number };
  photo?: Array<{ file_id: string; file_size?: number; width: number; height: number }>;
  video?: { file_id: string; mime_type?: string; duration?: number; file_size?: number };
  voice?: { file_id: string; mime_type?: string; duration?: number; file_size?: number };
  audio?: { file_id: string; mime_type?: string; duration?: number; file_size?: number };
  document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
  sticker?: { file_id: string; emoji?: string };
  animation?: { file_id: string; mime_type?: string; duration?: number };
  location?: { latitude: number; longitude: number };
  contact?: { phone_number: string; first_name: string; last_name?: string };
  new_chat_members?: TelegramUser[];
  left_chat_member?: TelegramUser;
  group_chat_created?: boolean;
  supergroup_chat_created?: boolean;
  channel_chat_created?: boolean;
  // ... many more fields possible; we treat unknown content as 'service' or 'other'
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: { id: string; from: TelegramUser; data?: string };
}

/**
 * Maps a Telegram message to our content_type enum.
 */
function inferContentType(msg: TelegramMessage): {
  contentType: string;
  text: string | null;
  mediaInfo: {
    mimeType?: string;
    fileName?: string;
    fileSize?: number;
    duration?: number;
  };
} {
  // Service messages (joins/leaves/etc.) — surface as 'service' so the UI can group them
  if (msg.new_chat_members || msg.left_chat_member ||
      msg.group_chat_created || msg.supergroup_chat_created || msg.channel_chat_created) {
    return { contentType: 'service', text: null, mediaInfo: {} };
  }

  if (msg.photo && msg.photo.length > 0) {
    const largest = msg.photo[msg.photo.length - 1];
    return {
      contentType: 'photo',
      text: msg.caption ?? null,
      mediaInfo: { fileSize: largest.file_size },
    };
  }
  if (msg.video) {
    return {
      contentType: 'video',
      text: msg.caption ?? null,
      mediaInfo: {
        mimeType: msg.video.mime_type,
        fileSize: msg.video.file_size,
        duration: msg.video.duration,
      },
    };
  }
  if (msg.voice) {
    return {
      contentType: 'voice',
      text: msg.caption ?? null,
      mediaInfo: {
        mimeType: msg.voice.mime_type,
        fileSize: msg.voice.file_size,
        duration: msg.voice.duration,
      },
    };
  }
  if (msg.audio) {
    return {
      contentType: 'audio',
      text: msg.caption ?? null,
      mediaInfo: {
        mimeType: msg.audio.mime_type,
        fileSize: msg.audio.file_size,
        duration: msg.audio.duration,
      },
    };
  }
  if (msg.document) {
    return {
      contentType: 'document',
      text: msg.caption ?? null,
      mediaInfo: {
        mimeType: msg.document.mime_type,
        fileName: msg.document.file_name,
        fileSize: msg.document.file_size,
      },
    };
  }
  if (msg.sticker) {
    return { contentType: 'sticker', text: msg.sticker.emoji ?? null, mediaInfo: {} };
  }
  if (msg.animation) {
    return {
      contentType: 'animation',
      text: msg.caption ?? null,
      mediaInfo: {
        mimeType: msg.animation.mime_type,
        duration: msg.animation.duration,
      },
    };
  }
  if (msg.location) {
    return {
      contentType: 'location',
      text: `${msg.location.latitude},${msg.location.longitude}`,
      mediaInfo: {},
    };
  }
  if (msg.contact) {
    const fullName = `${msg.contact.first_name}${msg.contact.last_name ? ' ' + msg.contact.last_name : ''}`;
    return {
      contentType: 'contact',
      text: `${fullName}: ${msg.contact.phone_number}`,
      mediaInfo: {},
    };
  }
  if (msg.text) {
    return { contentType: 'text', text: msg.text, mediaInfo: {} };
  }
  // Unknown content type — store the raw payload anyway for debugging
  return { contentType: 'other', text: null, mediaInfo: {} };
}

interface RouteContext {
  params: { botId: string };
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { botId } = params;
  const admin = createAdminClient();

  // 1. Look up the bot — this also validates botId is a real bot
  const { data: bot, error: botError } = await admin
    .from('telegram_bots')
    .select('id, workspace_id, webhook_secret, status, bot_id')
    .eq('id', botId)
    .single();

  if (botError || !bot) {
    // Don't reveal whether the botId exists — a fixed 401 is safer.
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Verify the secret token sent by Telegram
  const presentedSecret = req.headers.get('x-telegram-bot-api-secret-token');
  if (presentedSecret !== bot.webhook_secret) {
    console.warn(`[telegram-webhook] secret mismatch for bot ${botId}`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 3. If the bot is inactive, accept the call (so Telegram stops retrying) but
  //    don't process the message.
  if (bot.status === 'inactive') {
    return NextResponse.json({ ok: true, ignored: 'bot_inactive' });
  }

  // 4. Parse the update
  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 5. Pick the message — handle both `message` and `edited_message`. Ignore
  //    callback_query for now (Phase 2 doesn't need them; we'll wire them up
  //    when we add interactive buttons).
  const msg = update.message ?? update.edited_message;
  if (!msg) {
    return NextResponse.json({ ok: true, ignored: 'no_message' });
  }

  const tgChat = msg.chat;
  const sender = msg.from;

  try {
    // 6. Upsert the chat record. First message in a new chat creates a row;
    //    subsequent messages update the metadata in case the title changed.
    const { data: chatRow, error: chatError } = await admin
      .from('telegram_chats')
      .upsert(
        {
          bot_id: bot.id,
          workspace_id: bot.workspace_id,
          tg_chat_id: tgChat.id,
          chat_type: tgChat.type,
          title: tgChat.title ?? null,
          username: tgChat.username ?? null,
          first_name: tgChat.first_name ?? null,
          last_name: tgChat.last_name ?? null,
          is_active: true,
        },
        { onConflict: 'bot_id,tg_chat_id', ignoreDuplicates: false }
      )
      .select('id, is_routed, is_active')
      .single();

    if (chatError || !chatRow) {
      console.error('[telegram-webhook] chat upsert failed', chatError);
      // Return 200 anyway so Telegram doesn't retry — the failure was on our
      // side and retrying won't help.
      return NextResponse.json({ ok: true, error: 'chat_upsert_failed' });
    }

    // 7. Handle bot-was-removed signal: when the bot is kicked from a group,
    //    Telegram sends a service message with `left_chat_member` referencing
    //    the bot itself. Compare to the bot's numeric Telegram id (bot.bot_id),
    //    not to our internal uuid. Mark the chat inactive so future routing
    //    skips it.
    if (msg.left_chat_member?.is_bot && msg.left_chat_member.id === bot.bot_id) {
      await admin
        .from('telegram_chats')
        .update({ is_active: false })
        .eq('id', chatRow.id);
    }

    // 8. Extract content
    const { contentType, text, mediaInfo } = inferContentType(msg);

    // 9. Insert the message. Idempotent via unique (bot_id, tg_update_id).
    //    On conflict we silently treat as success — Telegram retried on us.
    const { error: msgError } = await admin
      .from('telegram_messages')
      .insert({
        workspace_id: bot.workspace_id,
        bot_id: bot.id,
        chat_id: chatRow.id,
        tg_update_id: update.update_id,
        tg_message_id: msg.message_id,
        reply_to_tg_message_id: msg.reply_to_message?.message_id ?? null,
        direction: 'in',
        sender_user_id: sender?.id ?? null,
        sender_username: sender?.username ?? null,
        sender_first_name: sender?.first_name ?? null,
        sender_last_name: sender?.last_name ?? null,
        sender_is_bot: sender?.is_bot ?? false,
        content_type: contentType,
        text,
        media_mime_type: mediaInfo.mimeType ?? null,
        media_file_name: mediaInfo.fileName ?? null,
        media_file_size: mediaInfo.fileSize ?? null,
        media_duration: mediaInfo.duration ?? null,
        status: 'received',
        raw_payload: update,
        received_at: new Date(msg.date * 1000).toISOString(),
      });

    if (msgError) {
      // 23505 = unique_violation = Telegram retry. Treat as success.
      if ((msgError as any).code === '23505') {
        return NextResponse.json({ ok: true, deduped: true });
      }
      console.error('[telegram-webhook] message insert failed', msgError);
      // Still 200 so Telegram doesn't retry indefinitely on our schema bug
      return NextResponse.json({ ok: true, error: 'message_insert_failed' });
    }

    // 10. Bump the bot's last_message_at for monitoring
    await admin
      .from('telegram_bots')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', bot.id);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[telegram-webhook] uncaught', e);
    // Still 200 — see Performance contract above
    return NextResponse.json({ ok: true, error: 'internal' });
  }
}
