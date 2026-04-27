import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/instances/[id]/set-primary
 * 
 * Sets this instance as the primary outbound instance for its workspace.
 * Automatically demotes any other primary instance in the same workspace.
 * The DB trigger then mirrors the new primary's credentials to
 * workspaces.whatsapp_instance_id/whatsapp_token (legacy compat).
 * 
 * Only workspace admin/owner can do this.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get the instance and verify it's in a workspace the user can manage
  const { data: instance, error: fetchErr } = await supabase
    .from('whatsapp_instances')
    .select('id, workspace_id, is_primary, display_name, state')
    .eq('id', params.id)
    .maybeSingle();

  if (fetchErr || !instance) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  // Verify membership and role
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', instance.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({
      error: 'רק owner או admin יכולים לשנות את ה-instance הראשי'
    }, { status: 403 });
  }

  // Already primary - nothing to do
  if (instance.is_primary) {
    return NextResponse.json({
      ok: true,
      already_primary: true,
      instance,
    });
  }

  // Use service client to bypass RLS for the atomic switch
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Demote current primary first (avoids the partial unique index violation)
  await service
    .from('whatsapp_instances')
    .update({ is_primary: false })
    .eq('workspace_id', instance.workspace_id)
    .eq('is_primary', true);

  // Promote the requested instance
  const { data: updated, error: updateErr } = await service
    .from('whatsapp_instances')
    .update({ is_primary: true })
    .eq('id', params.id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Audit
  await service.from('instance_provisioning_log').insert({
    instance_id: params.id,
    workspace_id: instance.workspace_id,
    user_id: user.id,
    action: 'state_change',
    details: {
      operation: 'set_as_primary',
      previous_state: instance.is_primary,
    },
  });

  return NextResponse.json({ ok: true, instance: updated });
}
