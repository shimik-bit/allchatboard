import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * PATCH /api/groupguard/groups/[id]/summary-settings
 *
 * Updates the per-group daily-summary settings. Body fields are all optional —
 * only the fields present in the body are updated, the rest stay untouched.
 *
 * Body (all optional):
 *   summary_enabled:           boolean    Master toggle
 *   summary_auto:              boolean    Auto-run via daily cron
 *   summary_hour:              0..23      Hour of day for auto-run
 *   summary_send_to_whatsapp:  boolean    Push the summary to WhatsApp
 *   summary_whatsapp_target:   string     Phone (no suffix) to send to;
 *                                         null/empty = send back to the group
 *
 * Auth: workspace member.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: group } = await admin
    .from('whatsapp_groups')
    .select('id, workspace_id')
    .eq('id', params.id)
    .single();
  if (!group) {
    return NextResponse.json({ error: 'group_not_found' }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', group.workspace_id)
    .eq('user_id', user.id)
    .single();
  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Build the update payload — only include fields the caller actually sent,
  // with type validation. Anything else is ignored to prevent random columns
  // from being set via this endpoint.
  const update: Record<string, unknown> = {};

  if (typeof body.summary_enabled === 'boolean') {
    update.summary_enabled = body.summary_enabled;
  }
  if (typeof body.summary_auto === 'boolean') {
    update.summary_auto = body.summary_auto;
  }
  if (typeof body.summary_hour === 'number'
      && Number.isInteger(body.summary_hour)
      && body.summary_hour >= 0
      && body.summary_hour <= 23) {
    update.summary_hour = body.summary_hour;
  }
  if (typeof body.summary_send_to_whatsapp === 'boolean') {
    update.summary_send_to_whatsapp = body.summary_send_to_whatsapp;
  }
  // Phone target: empty string normalizes to NULL (= "send back to the group")
  if ('summary_whatsapp_target' in body) {
    const v = body.summary_whatsapp_target;
    if (v === null || v === '') {
      update.summary_whatsapp_target = null;
    } else if (typeof v === 'string') {
      // Strip non-digits — store the canonical form
      const cleaned = v.replace(/\D/g, '');
      update.summary_whatsapp_target = cleaned.length > 0 ? cleaned : null;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no valid fields' }, { status: 400 });
  }

  const { error } = await admin
    .from('whatsapp_groups')
    .update(update)
    .eq('id', params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: Object.keys(update) });
}
