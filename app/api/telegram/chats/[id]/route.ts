import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: { id: string };
}

/**
 * PATCH /api/telegram/chats/[id]
 * Body: { is_active?: boolean, is_routed?: boolean, notes?: string }
 *
 * RLS allows only owners/admins to update.
 *
 *  - is_active: when false, the webhook still records messages but the UI hides the chat
 *  - is_routed: when false, messages from this chat won't show in Inbox / be routed
 *               (Phase 2.4 will plug this into the unified messages view)
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

  const { is_active, is_routed, notes } = body as {
    is_active?: boolean;
    is_routed?: boolean;
    notes?: string;
  };

  const updates: Record<string, unknown> = {};
  if (typeof is_active === 'boolean') updates.is_active = is_active;
  if (typeof is_routed === 'boolean') updates.is_routed = is_routed;
  if (typeof notes === 'string') updates.notes = notes;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No fields to update' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('telegram_chats')
    .update(updates)
    .eq('id', id)
    .select(
      'id, bot_id, tg_chat_id, chat_type, title, username, first_name, last_name, is_active, is_routed, last_message_at, message_count, created_at'
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ chat: data });
}
