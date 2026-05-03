import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/apps?workspace_id=...
 *
 * Returns the catalog of every visible app + a flag per item showing whether
 * it's installed for the requested workspace. Used by the apps page and by
 * the sidebar to decide what to render.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const workspaceId = req.nextUrl.searchParams.get('workspace_id');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
  }

  // Verify membership (also gives us the role for the can_install flag)
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const role = (membership as { role: string }).role;
  const canInstall = ['owner', 'admin'].includes(role);

  // Use admin client so RLS doesn't filter installations during the join
  const admin = createAdminClient();

  const [{ data: catalog }, { data: installed }] = await Promise.all([
    admin
      .from('apps_catalog')
      .select('*')
      .eq('is_visible', true)
      .order('position', { ascending: true }),
    admin
      .from('workspace_apps')
      .select('app_slug, installed_at, installed_by, config')
      .eq('workspace_id', workspaceId),
  ]);

  const installedMap = new Map<string, { installed_at: string; config: unknown }>();
  for (const row of (installed || []) as { app_slug: string; installed_at: string; config: unknown }[]) {
    installedMap.set(row.app_slug, { installed_at: row.installed_at, config: row.config });
  }

  const apps = (catalog || []).map((c: any) => ({
    ...c,
    is_installed: installedMap.has(c.slug),
    installed_at: installedMap.get(c.slug)?.installed_at ?? null,
    config: installedMap.get(c.slug)?.config ?? null,
  }));

  return NextResponse.json({ apps, can_install: canInstall, role });
}
