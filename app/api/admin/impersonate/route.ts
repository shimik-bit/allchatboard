import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminServiceClient } from '@/lib/admin/auth';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = adminServiceClient();

  // Verify admin AND has impersonate permission
  const { data: admin } = await service
    .from('platform_admins')
    .select('*')
    .eq('email', user.email)
    .maybeSingle();

  if (!admin || !admin.can_impersonate) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { target_user_id, target_email, workspace_id, reason } = body;

  if (!target_user_id || !target_email || !reason || reason.length < 5) {
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 });
  }

  // Generate a magic link for the target user (via admin API)
  const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: target_email,
  });

  if (linkError || !linkData) {
    return NextResponse.json({ error: linkError?.message || 'Could not generate magic link' }, { status: 500 });
  }

  // Log the impersonation
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const ua = req.headers.get('user-agent') || 'unknown';

  await service.from('impersonation_audit').insert({
    admin_user_id: user.id,
    admin_email: user.email,
    target_user_id,
    target_email,
    workspace_id: workspace_id || null,
    reason,
    ip_address: ip,
    user_agent: ua,
  });

  return NextResponse.json({
    magic_link: linkData.properties?.action_link,
    expires_at: linkData.properties?.email_otp,
  });
}
