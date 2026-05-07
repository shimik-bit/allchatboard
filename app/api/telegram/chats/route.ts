import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/telegram/chats?workspace_id=...
 * Optional: ?bot_id=... to filter by bot
 *
 * Returns chats the bot has interacted with, sorted by most recent activity.
 * RLS enforces workspace membership.
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
  const botId = req.nextUrl.searchParams.get('bot_id');

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'workspace_id is required' },
      { status: 400 }
    );
  }

  let query = supabase
    .from('telegram_chats')
    .select(
      'id, bot_id, tg_chat_id, chat_type, title, username, first_name, last_name, is_active, is_routed, last_message_at, message_count, created_at'
    )
    .eq('workspace_id', workspaceId)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (botId) query = query.eq('bot_id', botId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ chats: data });
}
