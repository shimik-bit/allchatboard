import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

async function requireAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  const { data: admin } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!admin) return { error: NextResponse.json({ error: 'Platform admin only' }, { status: 403 }), user: null };
  return { error: null, user };
}

/**
 * POST /api/admin/instances/[id]/share
 * Body: { workspace_id, workspace_display_name?, notes? }
 * Adds a workspace link to an instance, marking it as shared.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => ({}));
  const { workspace_id, workspace_display_name, notes, priority = 100 } = body;
  if (!workspace_id) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Verify instance exists
  const { data: instance } = await service
    .from('whatsapp_instances')
    .select('id, workspace_id, is_shared, display_name')
    .eq('id', params.id)
    .maybeSingle();
  if (!instance) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  // Verify target workspace exists
  const { data: workspace } = await service
    .from('workspaces')
    .select('id, name')
    .eq('id', workspace_id)
    .maybeSingle();
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // Mark instance as shared if not already
  if (!instance.is_shared) {
    await service
      .from('whatsapp_instances')
      .update({
        is_shared: true,
        shared_by_admin_id: auth.user!.id,
        shared_at: new Date().toISOString(),
        shared_note: notes || null,
      })
      .eq('id', params.id);
  }

  // Create the link
  const { data: link, error } = await service
    .from('instance_workspace_links')
    .insert({
      instance_id: params.id,
      workspace_id,
      workspace_display_name: workspace_display_name || workspace.name,
      priority,
      linked_by: auth.user!.id,
      notes,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({
        error: `Workspace "${workspace.name}" כבר מקושר ל-instance זה`
      }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit log
  await service.from('instance_provisioning_log').insert({
    instance_id: params.id,
    workspace_id,
    user_id: auth.user!.id,
    action: 'state_change',
    details: {
      operation: 'workspace_link_added',
      shared_now: true,
      target_workspace: workspace.name,
      notes,
    },
  });

  return NextResponse.json({ link, made_shared: !instance.is_shared });
}

/**
 * DELETE /api/admin/instances/[id]/share?workspace_id=xxx
 * Removes a workspace link from an instance.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const auth = await requireAdmin(supabase);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  await service
    .from('instance_workspace_links')
    .delete()
    .eq('instance_id', params.id)
    .eq('workspace_id', workspaceId);

  // If no links left, unmark as shared
  const { count } = await service
    .from('instance_workspace_links')
    .select('id', { count: 'exact', head: true })
    .eq('instance_id', params.id);

  if ((count || 0) === 0) {
    await service
      .from('whatsapp_instances')
      .update({ is_shared: false })
      .eq('id', params.id);
  }

  await service.from('instance_provisioning_log').insert({
    instance_id: params.id,
    workspace_id: workspaceId,
    user_id: auth.user!.id,
    action: 'state_change',
    details: { operation: 'workspace_link_removed', remaining_links: count || 0 },
  });

  return NextResponse.json({ ok: true, remaining_links: count || 0 });
}
