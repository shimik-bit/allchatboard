import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

/**
 * POST /api/invitations/accept
 * Body: { token }
 * Accepts a workspace invitation (logged-in user)
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Must be logged in' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { token } = body;
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Get invitation
  const { data: invitation } = await service
    .from('workspace_invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }

  if (invitation.status !== 'pending') {
    return NextResponse.json({ error: `Invitation already ${invitation.status}` }, { status: 400 });
  }

  if (new Date(invitation.expires_at) < new Date()) {
    await service.from('workspace_invitations').update({ status: 'expired' }).eq('id', invitation.id);
    return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
  }

  // Verify email matches (case insensitive)
  if (invitation.email.toLowerCase() !== user.email?.toLowerCase()) {
    return NextResponse.json({
      error: `This invitation is for ${invitation.email}. You are logged in as ${user.email}.`
    }, { status: 403 });
  }

  // Check if already a member
  const { data: existing } = await service
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', invitation.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await service.from('workspace_invitations').update({ status: 'accepted', accepted_at: new Date().toISOString(), accepted_by: user.id }).eq('id', invitation.id);
    return NextResponse.json({ ok: true, workspace_id: invitation.workspace_id, already_member: true });
  }

  // Add to workspace_members
  const { error: addError } = await service
    .from('workspace_members')
    .insert({
      workspace_id: invitation.workspace_id,
      user_id: user.id,
      role: invitation.role,
      display_name: invitation.display_name || user.email?.split('@')[0],
    });

  if (addError) {
    return NextResponse.json({ error: addError.message }, { status: 500 });
  }

  // Mark invitation accepted
  await service
    .from('workspace_invitations')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by: user.id,
    })
    .eq('id', invitation.id);

  return NextResponse.json({
    ok: true,
    workspace_id: invitation.workspace_id,
  });
}
