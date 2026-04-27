import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { session_id, task_index, task_title, action, snooze_until, notes } = body;

  if (!session_id || task_index === undefined || !action) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const validActions = ['done', 'skipped', 'snoozed', 'delegated', 'added_to_table'];
  if (!validActions.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('focus_actions')
    .insert({
      session_id,
      user_id: user.id,
      task_index,
      task_title: task_title || '(untitled)',
      action,
      snooze_until: snooze_until || null,
      notes: notes || null,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
