import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/telegram/encryption';
import { sendMessage, TelegramApiError } from '@/lib/telegram/bot-api';

/**
 * GET /api/telegram/messages?chat_id=...&limit=50&before=...
 *
 * Returns messages for a single chat, newest first.
 * RLS enforces workspace access.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const chatId = req.nextUrl.searchParams.get('chat_id');
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get('limit') ?? 50),
    200
  );
  const before = req.nextUrl.searchParams.get('before'); // ISO timestamp for pagination

  if (!chatId) {
    return NextResponse.json(
      { error: 'chat_id is required' },
      { status: 400 }
    );
  }

  let query = supabase
    .from('telegram_messages')
    .select(
      'id, chat_id, tg_message_id, reply_to_tg_message_id, direction, sender_user_id, sender_username, sender_first_name, sender_last_name, sender_is_bot, content_type, text, media_url, media_mime_type, media_file_name, media_file_size, media_duration, status, received_at, processed_at, raw_payload'
    )
    .eq('chat_id', chatId)
    .order('received_at', { ascending: false })
    .limit(limit);

  if (before) query = query.lt('received_at', before);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: data });
}

/**
 * POST /api/telegram/messages
 * Body: { chat_id, text, reply_to_tg_message_id? }
 *
 * Sends a text message to a Telegram chat via the bot, then records
 * the outbound message in our DB so the UI shows it in the conversation.
 *
 * Note: only TEXT for now. Phase 2.x can add photo/document send.
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

  const { chat_id, text, reply_to_tg_message_id } = body as {
    chat_id?: string;
    text?: string;
    reply_to_tg_message_id?: number;
  };

  if (!chat_id || !text || typeof text !== 'string' || !text.trim()) {
    return NextResponse.json(
      { error: 'chat_id and non-empty text are required' },
      { status: 400 }
    );
  }

  // 1. Resolve chat — RLS makes sure the caller is in the workspace
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

  // 2. Get bot token (use admin client because we need the encrypted columns
  //    and we've already confirmed the caller has access via RLS above).
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
    sent = await sendMessage(
      token,
      Number(chat.tg_chat_id),
      text.trim(),
      reply_to_tg_message_id
    );
  } catch (e) {
    const msg =
      e instanceof TelegramApiError
        ? `Telegram error: ${e.message}`
        : `Send failed: ${(e as Error).message}`;
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // 4. Record the outbound message so the UI can show it in the conversation.
  //    We don't get an update_id (those are only for incoming updates), so
  //    we synthesize one negative number to avoid colliding with future
  //    inbound updates which all use positive ids.
  const syntheticUpdateId = -Math.floor(Math.random() * 2_000_000_000);

  const { data: row, error: insertError } = await admin
    .from('telegram_messages')
    .insert({
      workspace_id: chat.workspace_id,
      bot_id: chat.bot_id,
      chat_id: chat.id,
      tg_update_id: syntheticUpdateId,
      tg_message_id: sent.message_id,
      reply_to_tg_message_id: reply_to_tg_message_id ?? null,
      direction: 'out',
      sender_is_bot: true,
      content_type: 'text',
      text: text.trim(),
      status: 'sent',
      received_at: new Date(sent.date * 1000).toISOString(),
      processed_at: new Date().toISOString(),
    })
    .select(
      'id, chat_id, tg_message_id, direction, content_type, text, status, received_at'
    )
    .single();

  if (insertError) {
    // The message went through to Telegram, but we couldn't log it. Surface
    // a warning so the UI can show "sent but not recorded" to the user.
    console.error('[telegram-send] insert failed', insertError);
    return NextResponse.json(
      {
        warning: 'Message sent but not recorded in DB',
        sent_message_id: sent.message_id,
      },
      { status: 207 }
    );
  }

  return NextResponse.json({ message: row }, { status: 201 });
}
