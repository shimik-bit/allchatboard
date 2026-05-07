/**
 * POST /api/escalations/[id]/reply
 *
 * Sends a reply to the escalation's source via the appropriate channel:
 *   - WhatsApp (default) → Green API + log to wa_messages
 *   - Telegram → Bot API sendMessage + log to telegram_messages
 *
 * Body: { text: string }
 *
 * Side effects (same on both channels):
 *  - Moves the escalation to status='in_progress' if it's still 'open'
 *    AND auto-assigns it to the replying user. Rationale: if you replied,
 *    you've taken the escalation. No separate "קבל לטיפול" click.
 *  - Refreshes last_message_excerpt with the reply text.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getInstanceBaseUrl } from '@/lib/instances/green-api-client';
import { decryptToken } from '@/lib/telegram/encryption';
import { sendMessage as tgSendMessage, TelegramApiError } from '@/lib/telegram/bot-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const text = String(body?.text || '').trim();
  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  const { data: esc, error: escErr } = await supabase
    .from('escalations')
    .select('id, workspace_id, source_phone, source_telegram_chat_id, channel, status')
    .eq('id', params.id)
    .single();

  if (escErr || !esc) {
    return NextResponse.json({ error: 'escalation not found' }, { status: 404 });
  }

  const channel = esc.channel ?? 'whatsapp';

  let sentMessageId: string | null = null;
  if (channel === 'telegram') {
    const result = await sendTelegramReply(esc, text);
    if (result.error) return result.error;
    sentMessageId = result.sentMessageId;
  } else {
    const result = await sendWhatsAppReply(supabase, esc, text);
    if (result.error) return result.error;
    sentMessageId = result.sentMessageId;
  }

  // Auto-take if still open. Same UX on both channels.
  if (esc.status === 'open') {
    await supabase
      .from('escalations')
      .update({
        status: 'in_progress',
        assigned_to_user_id: user.id,
        assigned_at: new Date().toISOString(),
        last_message_excerpt: text.slice(0, 200),
      })
      .eq('id', params.id);
  } else {
    await supabase
      .from('escalations')
      .update({ last_message_excerpt: text.slice(0, 200) })
      .eq('id', params.id);
  }

  return NextResponse.json({ ok: true, channel, sent_message_id: sentMessageId });
}

// ─────────────────────────────────────────────────────────────────────────
// WhatsApp (existing logic, refactored into a helper)
// ─────────────────────────────────────────────────────────────────────────

async function sendWhatsAppReply(
  supabase: ReturnType<typeof createClient>,
  esc: any,
  text: string
): Promise<{ sentMessageId: string | null; error?: NextResponse }> {
  if (!esc.source_phone) {
    return {
      sentMessageId: null,
      error: NextResponse.json(
        { error: 'this escalation has no source phone — cannot reply' },
        { status: 400 }
      ),
    };
  }

  const { data: ws } = await supabase
    .from('workspaces')
    .select('whatsapp_instance_id, whatsapp_token')
    .eq('id', esc.workspace_id)
    .single();

  if (!ws?.whatsapp_instance_id || !ws?.whatsapp_token) {
    return {
      sentMessageId: null,
      error: NextResponse.json(
        { error: 'workspace has no WhatsApp instance configured' },
        { status: 400 }
      ),
    };
  }

  const chatId = esc.source_phone.replace(/^\+/, '').replace(/\D/g, '') + '@c.us';
  const url = `${getInstanceBaseUrl(ws.whatsapp_instance_id)}/waInstance${ws.whatsapp_instance_id}/sendMessage/${ws.whatsapp_token}`;

  let sentMessageId: string | null = null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message: text, linkPreview: false }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        sentMessageId: null,
        error: NextResponse.json(
          { error: `Green API rejected: HTTP ${res.status}: ${errText}` },
          { status: 502 }
        ),
      };
    }

    const data = await res.json();
    sentMessageId = data?.idMessage || null;
  } catch (e: any) {
    return {
      sentMessageId: null,
      error: NextResponse.json(
        { error: `network error: ${e?.message || 'unknown'}` },
        { status: 502 }
      ),
    };
  }

  const admin = createAdminClient();
  await admin.from('wa_messages').insert({
    workspace_id: esc.workspace_id,
    sender_phone: esc.source_phone,
    text,
    direction: 'out',
    status: 'sent',
    received_at: new Date().toISOString(),
    sent_message_id: sentMessageId,
  });

  return { sentMessageId };
}

// ─────────────────────────────────────────────────────────────────────────
// Telegram (new in Phase 2.3)
// ─────────────────────────────────────────────────────────────────────────

async function sendTelegramReply(
  esc: any,
  text: string
): Promise<{ sentMessageId: string | null; error?: NextResponse }> {
  if (!esc.source_telegram_chat_id) {
    return {
      sentMessageId: null,
      error: NextResponse.json(
        { error: 'this telegram escalation has no source chat — cannot reply' },
        { status: 400 }
      ),
    };
  }

  const admin = createAdminClient();

  const { data: chat, error: chatErr } = await admin
    .from('telegram_chats')
    .select('id, bot_id, tg_chat_id, is_active, workspace_id')
    .eq('id', esc.source_telegram_chat_id)
    .single();

  if (chatErr || !chat) {
    return {
      sentMessageId: null,
      error: NextResponse.json(
        { error: 'telegram chat not found' },
        { status: 404 }
      ),
    };
  }

  if (!chat.is_active) {
    return {
      sentMessageId: null,
      error: NextResponse.json(
        { error: 'cannot reply — bot was removed from this chat' },
        { status: 400 }
      ),
    };
  }

  const { data: bot, error: botErr } = await admin
    .from('telegram_bots')
    .select('id, status, bot_token_encrypted, bot_token_iv, bot_token_auth_tag')
    .eq('id', chat.bot_id)
    .single();

  if (botErr || !bot) {
    return {
      sentMessageId: null,
      error: NextResponse.json(
        { error: 'telegram bot not found' },
        { status: 404 }
      ),
    };
  }

  if (bot.status !== 'active') {
    return {
      sentMessageId: null,
      error: NextResponse.json(
        { error: `telegram bot is ${bot.status}` },
        { status: 400 }
      ),
    };
  }

  const token = decryptToken({
    encrypted: bot.bot_token_encrypted,
    iv: bot.bot_token_iv,
    authTag: bot.bot_token_auth_tag,
  });

  let sent;
  try {
    sent = await tgSendMessage(token, Number(chat.tg_chat_id), text);
  } catch (e) {
    const msg =
      e instanceof TelegramApiError
        ? `telegram error: ${e.message}`
        : `send failed: ${(e as Error).message}`;
    return {
      sentMessageId: null,
      error: NextResponse.json({ error: msg }, { status: 502 }),
    };
  }

  // Log outbound. Synthetic negative tg_update_id avoids colliding with
  // future inbound updates (always positive ids from Telegram).
  const syntheticUpdateId = -Math.floor(Math.random() * 2_000_000_000);

  await admin.from('telegram_messages').insert({
    workspace_id: chat.workspace_id,
    bot_id: chat.bot_id,
    chat_id: chat.id,
    tg_update_id: syntheticUpdateId,
    tg_message_id: sent.message_id,
    direction: 'out',
    sender_is_bot: true,
    content_type: 'text',
    text,
    status: 'sent',
    received_at: new Date(sent.date * 1000).toISOString(),
    processed_at: new Date().toISOString(),
  });

  return { sentMessageId: String(sent.message_id) };
}
