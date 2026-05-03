import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/apps/install
 * Body: { workspace_id, app_slug }
 *
 * Installs an app for a workspace. Membership + role check (owner/admin only).
 * Idempotent — re-installing a present app is a no-op (returns 200).
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { workspace_id?: string; app_slug?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { workspace_id, app_slug } = body;
  if (!workspace_id || !app_slug) {
    return NextResponse.json({ error: 'workspace_id + app_slug required' }, { status: 400 });
  }

  // Role check
  const { data: m } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!m || !['owner', 'admin'].includes((m as { role: string }).role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Verify the app exists in the catalog (don't install something arbitrary)
  const admin = createAdminClient();
  const { data: app } = await admin
    .from('apps_catalog')
    .select('slug, primary_route')
    .eq('slug', app_slug)
    .eq('is_visible', true)
    .maybeSingle();
  if (!app) return NextResponse.json({ error: 'app_not_found' }, { status: 404 });

  // Upsert the installation (idempotent on the unique constraint)
  const { error } = await admin
    .from('workspace_apps')
    .upsert(
      { workspace_id, app_slug, installed_by: user.id },
      { onConflict: 'workspace_id,app_slug', ignoreDuplicates: true }
    );

  if (error) {
    console.error('[apps/install] upsert error:', error);
    return NextResponse.json({ error: 'install_failed', details: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    workspace_id,
    app_slug,
    primary_route: (app as { primary_route: string }).primary_route,
  });
}

/**
 * DELETE /api/apps/install
 * Body: { workspace_id, app_slug }
 *
 * Removes the installation. Data is preserved — only the sidebar entry is
 * removed.
 */
export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { workspace_id?: string; app_slug?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  const { workspace_id, app_slug } = body;
  if (!workspace_id || !app_slug) {
    return NextResponse.json({ error: 'workspace_id + app_slug required' }, { status: 400 });
  }

  const { data: m } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!m || !['owner', 'admin'].includes((m as { role: string }).role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('workspace_apps')
    .delete()
    .eq('workspace_id', workspace_id)
    .eq('app_slug', app_slug);

  if (error) {
    return NextResponse.json({ error: 'uninstall_failed', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
