import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { recoverWorkspaceInstances } from '@/lib/whatsapp/recover';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/whatsapp/recover
 *
 * Manual recovery — called from the "שחזר הודעות חסרות" button in
 * InstancesManager. Fully runs (ignores the silent throttle) so a user
 * who explicitly clicks always gets a fresh check.
 *
 * For the underlying mechanism see lib/whatsapp/recover.ts.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { workspace_id?: string; silent?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const workspaceId = body.workspace_id;
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }

  // Membership check
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();
  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  const origin =
    req.headers.get('origin') ||
    `https://${req.headers.get('host') || 'taskflow-ai.com'}`;

  const result = await recoverWorkspaceInstances({
    admin,
    origin,
    workspaceId,
    silent: body.silent === true,
  });

  return NextResponse.json({
    ok: true,
    instances_checked: result.instances_checked,
    messages_recovered: result.recovered,
    groups_created: result.groups_created,
    webhook_reset: result.webhook_reset,
  });
}
