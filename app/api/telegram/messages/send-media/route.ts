import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/telegram/encryption';
import { sendPhoto, sendDocument, TelegramApiError } from '@/lib/telegram/bot-api';

/**
 * POST /api/telegram/messages/send-media
 * Body: { chat_id, media_url, kind: 'photo'|'document', caption?, filename? }
 *
 * Sends a photo or document to a Telegram chat. The media_url must be
 * publicly accessible (we pass it directly to Telegram, which fetches it).
 *
 * Why URL-based and not multipart upload:
 *  - Lets the UI upload to Supabase Storage first (already public via the
 *    `media` bucket) and then just hand us the URL.
 *  - Avoids streaming binary through this Next.js API route, which would
 *    blow past Vercel's payload limits for larger files.
 *  - Matches how the existing WhatsApp media flow works.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { chat_id, media_url, kind, caption, filename } = body as {
    chat_id?: string;
    media_url?: string;
    kind?: 'photo' | 'document';
    caption?: string;
    filename?: string;
  };

  if (!chat_id || !media_url || !kind) {
    return NextResponse.json(
      { error: 'chat_id, media_url, and kind are required' },
      { status: 400 }
    );
  }

  if (kind !== 'photo' && kind !== 'document') {
    return NextResponse.json(
      { error: 'kind must be "photo" or "document"' },
      { status: 400 }
    );
  }

  // Validate URL is HTTPS (Telegram won't accept http:// or anything weird)
  try {
    const u = new URL(media_url);
    if (u.protocol !== 'https:') {
      return NextResponse.json(
        { error: 'media_url must be HTTPS' },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: 'Invalid media_url' }, { status: 400 });
  }

  // 1. Resolve chat (RLS via user-scoped client)
  const { data: chat, error: chatError } = await supabase
    .from('telegram_chats')
    .select('id, bot_id, workspace_id, tg_chat_id, is_active')
    .eq('id', chat_id)
    .single();

  if (chatError || !chat) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
  }

  if (!chat.is_active) {
    return NextResponse.json(
      { error: 'Cannot send to an inactive chat (bot was removed)' },
      { status: 400 }
    );
  }

  // 2. Get bot token
  const { data: bot, error: botError } = await admin
    .from('telegram_bots')
    .select(
      'id, status, bot_token_encrypted, bot_token_iv, bot_token_auth_tag'
    )
    .eq('id', chat.bot_id)
    .single();

  if (botError || !bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  if (bot.status !== 'active') {
    return NextResponse.json(
      { error: `Bot is ${bot.status}` },
      { status: 400 }
    );
  }

  const token = decryptToken({
    encrypted: bot.bot_token_encrypted,
    iv: bot.bot_token_iv,
    authTag: bot.bot_token_auth_tag,
  });

  // 3. Send via Telegram
  let sent;
  try {
    if (kind === 'photo') {
      sent = await sendPhoto(token, Number(chat.tg_chat_id), media_url, caption);
    } else {
      sent = await sendDocument(
        token,
        Number(chat.tg_chat_id),
        media_url,
        caption,
        filename
      );
    }
  } catch (e) {
    const msg =
      e instanceof TelegramApiError
        ? `Telegram error: ${e.message}`
        : `Send failed: ${(e as Error).message}`;
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // 4. Record outbound message
  const syntheticUpdateId = -Math.floor(Math.random() * 2_000_000_000);

  const { data: row, error: insertError } = await admin
    .from('telegram_messages')
    .insert({
      workspace_id: chat.workspace_id,
      bot_id: chat.bot_id,
      chat_id: chat.id,
      tg_update_id: syntheticUpdateId,
      tg_message_id: sent.message_id,
      direction: 'out',
      sender_is_bot: true,
      content_type: kind,
      text: caption ?? null,
      media_url,
      media_file_name: filename ?? null,
      status: 'sent',
      received_at: new Date(sent.date * 1000).toISOString(),
      processed_at: new Date().toISOString(),
    })
    .select(
      'id, chat_id, tg_message_id, direction, content_type, text, media_url, media_file_name, status, received_at'
    )
    .single();

  if (insertError) {
    console.error('[telegram-send-media] insert failed', insertError);
    return NextResponse.json(
      {
        warning: 'Media sent but not recorded in DB',
        sent_message_id: sent.message_id,
      },
      { status: 207 }
    );
  }

  return NextResponse.json({ message: row }, { status: 201 });
}
