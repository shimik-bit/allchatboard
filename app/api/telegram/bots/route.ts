import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { encryptToken } from '@/lib/telegram/encryption';
import { getBotInfo, setWebhook, TelegramApiError } from '@/lib/telegram/bot-api';

/**
 * GET /api/telegram/bots?workspace_id=...
 * Returns the bots in the given workspace. RLS enforces that the caller
 * is a member of that workspace.
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
 *   1. Validate token format
 *   2. Call Telegram getMe to validate the token + fetch bot identity
 *   3. Encrypt the token (AES-256-GCM)
 *   4. Insert the row (RLS check: must be admin or owner of the workspace)
 *   5. Register webhook with Telegram
 *   6. If webhook fails: keep the row but mark it as 'error' so the
 *      admin can retry from the UI.
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
      { error: 'פורמט טוקן לא תקין. נדרש NNNNNN:XXXX...' },
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
        ? `טלגרם דחה את הטוקן: ${e.message}`
        : `שגיאה באימות הטוקן: ${(e as Error).message}`;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // 2. Encrypt token
  const encrypted = encryptToken(token);

  // 3. Generate webhook secret (32 bytes hex = 64 chars; well under Telegram's 256 limit)
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
        { error: 'הבוט הזה כבר מחובר ל-workspace אחר' },
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
        last_error: `הגדרת Webhook נכשלה: ${errorMsg}`,
        last_error_at: new Date().toISOString(),
      })
      .eq('id', bot.id);

    return NextResponse.json(
      {
        bot: {
          ...bot,
          status: 'error',
          last_error: `הגדרת Webhook נכשלה: ${errorMsg}`,
        },
        warning: errorMsg,
      },
      { status: 207 } // Multi-Status: bot saved but webhook failed
    );
  }

  return NextResponse.json({ bot }, { status: 201 });
}
