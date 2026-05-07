import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/telegram/encryption';
import { deleteWebhook } from '@/lib/telegram/bot-api';

interface RouteContext {
  params: { id: string };
}

/**
 * DELETE /api/telegram/bots/[id]
 * Removes the webhook from Telegram (best-effort) and deletes the row.
 * Best-effort means: if Telegram is unreachable or token is invalid, we
 * still allow deletion of the local row — orphaned webhooks at Telegram
 * just sit idle and Telegram eventually drops them.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const { id } = params;
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: bot, error: fetchError } = await supabase
    .from('telegram_bots')
    .select('bot_token_encrypted, bot_token_iv, bot_token_auth_tag')
    .eq('id', id)
    .single();

  if (fetchError || !bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  try {
    const token = decryptToken({
      encrypted: bot.bot_token_encrypted,
      iv: bot.bot_token_iv,
      authTag: bot.bot_token_auth_tag,
    });
    await deleteWebhook(token);
  } catch (e) {
    console.error('[telegram] failed to delete webhook for bot', id, e);
  }

  const { error: deleteError } = await supabase
    .from('telegram_bots')
    .delete()
    .eq('id', id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * PATCH /api/telegram/bots/[id]
 * Body: { status?: 'active' | 'inactive' }
 *
 * Note: setting status='inactive' currently only marks the row.
 * The Phase 2 webhook handler will check status before processing messages.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = params;
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

  const { status } = body as { status?: string };

  if (status && !['active', 'inactive'].includes(status)) {
    return NextResponse.json(
      { error: 'Invalid status (must be active or inactive)' },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  // When re-activating, clear any prior error state so the badge is correct.
  if (status === 'active') {
    updates.last_error = null;
    updates.last_error_at = null;
  }

  const { data, error } = await supabase
    .from('telegram_bots')
    .update(updates)
    .eq('id', id)
    .select(
      'id, bot_id, bot_username, bot_first_name, status, last_error, last_message_at, created_at'
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ bot: data });
}
