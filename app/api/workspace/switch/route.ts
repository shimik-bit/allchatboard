/**
 * Workspace switcher endpoint
 *
 * Sets the active workspace cookie and redirects to /dashboard.
 *
 * Two ways to call:
 *   GET /api/workspace/switch?id=<workspace-uuid>  - by UUID
 *   GET /api/workspace/switch?code=BEA             - by workspace_code (more shareable)
 *
 * The user must be a member of the target workspace, otherwise we
 * silently ignore the request and just redirect to /dashboard with
 * the cookie unchanged.
 *
 * This is the simplest way to get into a specific workspace from a link
 * (useful for testing, demo links, or "open in" buttons elsewhere).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ACTIVE_WS_COOKIE = 'tf_active_workspace';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const code = searchParams.get('code');

  let targetWorkspaceId: string | null = null;

  if (id) {
    targetWorkspaceId = id;
  } else if (code) {
    // Look up the UUID from the workspace_code
    const { data: ws } = await supabase
      .from('workspaces')
      .select('id')
      .eq('workspace_code', code.toUpperCase())
      .single();
    targetWorkspaceId = ws?.id ?? null;
  }

  if (!targetWorkspaceId) {
    // No id/code or no match - just go to dashboard with current cookie
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Verify the user is actually a member of this workspace before
  // setting the cookie. Without this check, anyone could set the cookie
  // to any workspace UUID — RLS would still block actual data access,
  // but the dashboard layout would crash trying to load it.
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('workspace_id', targetWorkspaceId)
    .maybeSingle();

  if (!membership) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // All good — set the cookie and redirect
  const response = NextResponse.redirect(new URL('/dashboard', request.url));
  response.cookies.set(ACTIVE_WS_COOKIE, targetWorkspaceId, {
    httpOnly: false,    // sidebar reads this client-side too
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,  // 1 year
  });
  return response;
}
