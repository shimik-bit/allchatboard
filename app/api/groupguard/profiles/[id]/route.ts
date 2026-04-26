import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/groupguard/profiles/[id]
 *   Returns full profile + groups they're in + recent message samples.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const profileId = params.id;

  // Load profile - RLS will block if not in workspace
  const { data: profile, error } = await supabase
    .from('gg_member_profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: 'profile not found' }, { status: 404 });
  }

  // Verify user is in the same workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', profile.workspace_id)
    .eq('user_id', user.id)
    .single();
  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Load member's groups
  const { data: memberships } = await supabase
    .from('gg_member_groups')
    .select(`
      message_count,
      first_seen_at,
      last_seen_at,
      whatsapp_groups(id, group_name, green_api_chat_id)
    `)
    .eq('profile_id', profileId)
    .order('last_seen_at', { ascending: false });

  // Load recent message samples (last 10)
  const { data: recentMessages } = await supabase
    .from('wa_messages')
    .select('id, text, received_at, group_id')
    .eq('workspace_id', profile.workspace_id)
    .eq('sender_phone', profile.phone)
    .not('text', 'is', null)
    .order('received_at', { ascending: false })
    .limit(10);

  return NextResponse.json({
    profile,
    groups: (memberships || []).map((m: any) => ({
      group_id: m.whatsapp_groups?.id,
      group_name: m.whatsapp_groups?.group_name || m.whatsapp_groups?.green_api_chat_id,
      message_count: m.message_count,
      first_seen_at: m.first_seen_at,
      last_seen_at: m.last_seen_at,
    })),
    recent_messages: recentMessages || [],
  });
}
