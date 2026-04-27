import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

/**
 * POST /api/invitations
 * Body: { workspace_id, email, role?, display_name?, job_title?, message? }
 * Creates an invitation + sends email
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { workspace_id, email, role = 'editor', display_name, job_title, message } = body;

  if (!workspace_id || !email) {
    return NextResponse.json({ error: 'workspace_id and email required' }, { status: 400 });
  }

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  // Check user is owner/admin of workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Only workspace owners/admins can invite' }, { status: 403 });
  }

  // Check if email already a member
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: usersData } = await service.auth.admin.listUsers({ perPage: 1000 });
  const existingUser = usersData?.users?.find(u => u.email === email);
  if (existingUser) {
    const { data: existingMember } = await service
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspace_id)
      .eq('user_id', existingUser.id)
      .maybeSingle();
    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this workspace' }, { status: 409 });
    }
  }

  // Cancel any existing pending invitation
  await service
    .from('workspace_invitations')
    .delete()
    .eq('workspace_id', workspace_id)
    .eq('email', email)
    .eq('status', 'pending');

  // Create invitation
  const { data: invitation, error: invError } = await service
    .from('workspace_invitations')
    .insert({
      workspace_id,
      email,
      role,
      display_name: display_name || null,
      job_title: job_title || null,
      message: message || null,
      invited_by: user.id,
    })
    .select('*')
    .single();

  if (invError || !invitation) {
    return NextResponse.json({ error: invError?.message || 'Failed to create invitation' }, { status: 500 });
  }

  // Get workspace name for email
  const { data: workspace } = await service
    .from('workspaces')
    .select('name, icon')
    .eq('id', workspace_id)
    .single();

  // Get inviter info
  const { data: inviterMember } = await service
    .from('workspace_members')
    .select('display_name')
    .eq('user_id', user.id)
    .eq('workspace_id', workspace_id)
    .maybeSingle();
  const inviterName = inviterMember?.display_name || user.email?.split('@')[0] || 'משתמש';

  // Generate accept URL
  const acceptUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://taskflow-ai.com'}/invite/${invitation.token}`;

  // Send invitation email via Supabase magic link to email
  // (This uses Supabase's built-in email - will be replaced with Resend later)
  try {
    await service.auth.admin.inviteUserByEmail(email, {
      data: {
        workspace_id,
        workspace_name: workspace?.name,
        invited_by: inviterName,
        invitation_token: invitation.token,
      },
      redirectTo: acceptUrl,
    });
  } catch (err) {
    // Email send fail is not fatal - invitation is created and they can use the link
    console.error('Failed to send invitation email:', err);
  }

  return NextResponse.json({
    invitation,
    accept_url: acceptUrl,
    workspace_name: workspace?.name,
  });
}

/**
 * DELETE /api/invitations?id=xxx
 * Cancel a pending invitation
 */
export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase
    .from('workspace_invitations')
    .delete()
    .eq('id', id)
    .eq('status', 'pending');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
