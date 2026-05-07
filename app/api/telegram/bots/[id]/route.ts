import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decryptToken } from '@/lib/telegram/encryption';
import { deleteWebhook } from '@/lib/telegram/bot-api';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/telegram/bots/[id]
 * Removes the webhook from Telegram (best-effort) and deletes the row.
 *
 * Best-effort on the webhook side: if Telegram is unreachable or the token
 * has been revoked externally, we still want to let the user delete the row.
 * Otherwise they'd be stuck with a "ghost" bot they can't remove.
 */
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
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
 * Setting status='inactive' currently only marks the row. The Phase 2
 * webhook handler will check status before processing messages.
 *
 * Re-activating clears any previous error state.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
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
      { error: 'סטטוס לא תקין (חייב להיות active או inactive)' },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
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
