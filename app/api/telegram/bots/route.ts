import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/telegram/encryption';
import { getBotInfo, setWebhook, TelegramApiError } from '@/lib/telegram/bot-api';

/**
 * GET /api/telegram/bots?workspace_id=...
 * Returns list of bots in the given workspace.
 * RLS enforces the caller is a member of that workspace.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspaceId = req.nextUrl.searchParams.get('workspace_id');
  if (!workspaceId) {
    return NextResponse.json(
      { error: 'workspace_id is required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('telegram_bots')
    .select(
      'id, bot_id, bot_username, bot_first_name, status, last_error, last_message_at, created_at'
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bots: data });
}

/**
 * POST /api/telegram/bots
 * Body: { workspace_id, token }
 *
 * Flow:
 *  1. Validate token format (regex)
 *  2. Validate token with Telegram (getMe) — also gets bot_id, username
 *  3. Encrypt token (AES-256-GCM)
 *  4. Insert into DB (RLS enforces admin/owner role on insert)
 *  5. Register webhook with Telegram
 *  6. If webhook fails: keep DB row but mark as 'error' so the user can retry
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();

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

  const { workspace_id, token } = body as {
    workspace_id?: string;
    token?: string;
  };

  if (!workspace_id || !token) {
    return NextResponse.json(
      { error: 'workspace_id and token are required' },
      { status: 400 }
    );
  }

  // Telegram tokens look like: "123456789:AAH-aBcDef..."
  if (!/^\d+:[A-Za-z0-9_-]+$/.test(token)) {
    return NextResponse.json(
      { error: 'Invalid token format. Expected NNNNNN:XXXX...' },
      { status: 400 }
    );
  }

  // 1. Validate with Telegram
  let botInfo;
  try {
    botInfo = await getBotInfo(token);
  } catch (e) {
    const msg =
      e instanceof TelegramApiError
        ? `Telegram rejected the token: ${e.message}`
        : `Could not validate token: ${(e as Error).message}`;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // 2. Encrypt token
  const encrypted = encryptToken(token);

  // 3. Generate webhook secret (32 bytes hex; Telegram allows up to 256 chars)
  const webhookSecret = crypto.randomBytes(32).toString('hex');

  // 4. Insert
  const { data: bot, error: insertError } = await supabase
    .from('telegram_bots')
    .insert({
      workspace_id,
      bot_id: botInfo.id,
      bot_username: botInfo.username,
      bot_first_name: botInfo.first_name,
      bot_token_encrypted: encrypted.encrypted,
      bot_token_iv: encrypted.iv,
      bot_token_auth_tag: encrypted.authTag,
      webhook_secret: webhookSecret,
      status: 'active',
      created_by: user.id,
    })
    .select(
      'id, bot_id, bot_username, bot_first_name, status, last_error, last_message_at, created_at'
    )
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'This bot is already connected to another workspace' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 5. Register webhook
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    `https://${req.headers.get('host')}`;
  const webhookUrl = `${baseUrl}/api/telegram/webhook/${bot.id}`;

  try {
    await setWebhook(token, webhookUrl, webhookSecret);
  } catch (e) {
    const errorMsg = (e as Error).message;
    await supabase
      .from('telegram_bots')
      .update({
        status: 'error',
        last_error: `Webhook setup failed: ${errorMsg}`,
        last_error_at: new Date().toISOString(),
      })
      .eq('id', bot.id);

    // 207 Multi-Status: bot saved but partially failed — let UI show a warning
    return NextResponse.json(
      {
        bot: {
          ...bot,
          status: 'error',
          last_error: `Webhook setup failed: ${errorMsg}`,
        },
        warning: errorMsg,
      },
      { status: 207 }
    );
  }

  return NextResponse.json({ bot }, { status: 201 });
}
