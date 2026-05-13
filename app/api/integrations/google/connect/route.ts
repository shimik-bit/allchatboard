// GET /api/integrations/google/connect
//
// Entry point for the OAuth flow. The user clicks "Connect Google" in
// /dashboard/settings/integrations, lands here, and we redirect them to
// Google's consent screen with a `state` parameter that lets the callback
// route remember (a) which workspace they were on and (b) where to send
// them when it's all done.

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { resolveActiveWorkspaceForUser } from '@/lib/permissions/active-workspace';
import { buildConsentUrl, encodeState } from '@/lib/google/oauth';

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const ws = await resolveActiveWorkspaceForUser();
  if (!ws) {
    return NextResponse.redirect(new URL('/dashboard?error=no_workspace', req.url));
  }

  const returnTo = req.nextUrl.searchParams.get('returnTo') ?? '/dashboard/settings/integrations';

  const state = encodeState({
    workspaceId: ws.wsId,
    userId: user.id,
    nonce: randomBytes(16).toString('hex'),
    returnTo,
  });

  try {
    const url = buildConsentUrl(state);
    return NextResponse.redirect(url);
  } catch (err) {
    console.error('[google/connect] Failed to build consent URL:', err);
    return NextResponse.redirect(
      new URL('/dashboard/settings/integrations?error=config', req.url),
    );
  }
}
