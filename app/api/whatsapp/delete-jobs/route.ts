import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/whatsapp/delete-jobs
 *
 * Creates a delete-messages job. Two flavors:
 *
 *   kind='broadcast': delete every message we sent through a previous
 *     broadcast_jobs row. Targets are inferred from broadcast_targets
 *     where status='sent' and green_message_id is non-null.
 *
 *   kind='manual': delete specific message ids the user pasted in.
 *     Body must include `targets: [{ group_id, message_ids: string[] }]`.
 *     Useful for "delete that one bad message that went viral".
 *
 * Both flavors require the bot to be admin in the target groups for
 * deletion of OTHER members' messages. For our own messages, no admin
 * privilege is needed (Green API allows self-deletion).
 *
 * Body:
 *   {
 *     workspace_id,
 *     kind: 'broadcast' | 'manual',
 *     source_broadcast_id?: string,    // required when kind='broadcast'
 *     targets?: Array<{group_id, message_ids:[]}>, // required when kind='manual'
 *     delay_seconds?: 0..3600 (default 5),
 *     scheduled_at?: ISO
 *   }
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { workspace_id, kind, source_broadcast_id, targets, delay_seconds, scheduled_at } = body || {};

  if (typeof workspace_id !== 'string' || !workspace_id) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }
  if (kind !== 'broadcast' && kind !== 'manual') {
    return NextResponse.json({ error: 'kind must be "broadcast" or "manual"' }, { status: 400 });
  }

  const delay = Number.isFinite(delay_seconds) ? Math.floor(delay_seconds) : 5;
  if (delay < 0 || delay > 3600) {
    return NextResponse.json({ error: 'delay_seconds must be 0..3600' }, { status: 400 });
  }
  let scheduledAt: string | null = null;
  if (scheduled_at) {
    const d = new Date(scheduled_at);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: 'scheduled_at not a valid date' }, { status: 400 });
    }
    if (d.getTime() > Date.now() + 90 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'scheduled_at can be at most 90 days in the future' }, { status: 400 });
    }
    scheduledAt = d.toISOString();
  }

  // --- Auth: admin/owner ---
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .single();
  if (!membership) {
    return NextResponse.json({ error: 'workspace not found' }, { status: 404 });
  }
  if (!['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'forbidden — admin or owner role required' }, { status: 403 });
  }

  const admin = createAdminClient();

  // --- Build the targets list ---
  type TargetRow = { group_id: string; green_message_id: string };
  const collectedTargets: TargetRow[] = [];

  if (kind === 'broadcast') {
    if (typeof source_broadcast_id !== 'string' || !source_broadcast_id) {
      return NextResponse.json(
        { error: 'source_broadcast_id required when kind=broadcast' },
        { status: 400 }
      );
    }
    // Verify the source broadcast belongs to this workspace
    const { data: srcJob } = await admin
      .from('broadcast_jobs')
      .select('id, workspace_id')
      .eq('id', source_broadcast_id)
      .single();
    if (!srcJob || srcJob.workspace_id !== workspace_id) {
      return NextResponse.json(
        { error: 'source_broadcast_id not found in this workspace' },
        { status: 404 }
      );
    }
    const { data: sentTargets } = await admin
      .from('broadcast_targets')
      .select('group_id, green_message_id')
      .eq('job_id', source_broadcast_id)
      .eq('status', 'sent')
      .not('green_message_id', 'is', null);
    if (!sentTargets || sentTargets.length === 0) {
      return NextResponse.json(
        { error: 'no sent messages found in the source broadcast' },
        { status: 400 }
      );
    }
    for (const t of sentTargets) {
      collectedTargets.push({
        group_id: t.group_id as string,
        green_message_id: t.green_message_id as string,
      });
    }
  } else {
    // kind === 'manual'
    if (!Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json(
        { error: 'targets[] required when kind=manual' },
        { status: 400 }
      );
    }
    if (targets.length > 50) {
      return NextResponse.json(
        { error: 'too many groups in one job (max 50)' },
        { status: 400 }
      );
    }
    for (const t of targets) {
      if (!t || typeof t.group_id !== 'string' || !Array.isArray(t.message_ids)) {
        return NextResponse.json({ error: 'invalid target shape' }, { status: 400 });
      }
      for (const mid of t.message_ids) {
        if (typeof mid === 'string' && mid.trim()) {
          collectedTargets.push({ group_id: t.group_id, green_message_id: mid.trim() });
        }
      }
    }
    if (collectedTargets.length === 0) {
      return NextResponse.json({ error: 'no message ids provided' }, { status: 400 });
    }
    if (collectedTargets.length > 500) {
      return NextResponse.json(
        { error: 'too many messages (max 500 per job)' },
        { status: 400 }
      );
    }
    // Verify all groups belong to the workspace
    const groupIds = [...new Set(collectedTargets.map(t => t.group_id))];
    const { data: validGroups } = await admin
      .from('whatsapp_groups')
      .select('id')
      .eq('workspace_id', workspace_id)
      .in('id', groupIds);
    if (!validGroups || validGroups.length !== groupIds.length) {
      return NextResponse.json(
        { error: 'one or more group_ids do not belong to this workspace' },
        { status: 400 }
      );
    }
  }

  // --- Create the job + targets ---
  const { data: job, error: jobErr } = await admin
    .from('delete_jobs')
    .insert({
      workspace_id,
      created_by: user.id,
      kind,
      source_broadcast_id: kind === 'broadcast' ? source_broadcast_id : null,
      delay_seconds: delay,
      scheduled_at: scheduledAt,
      total_targets: collectedTargets.length,
      status: 'pending',
    })
    .select('id, scheduled_at')
    .single();

  if (jobErr || !job) {
    return NextResponse.json(
      { error: 'failed to create job: ' + (jobErr?.message || 'unknown') },
      { status: 500 }
    );
  }

  const targetRows = collectedTargets.map((t, idx) => ({
    job_id: job.id,
    workspace_id,
    group_id: t.group_id,
    green_message_id: t.green_message_id,
    position: idx + 1,
    status: 'pending',
  }));

  const { error: tErr } = await admin.from('delete_targets').insert(targetRows);
  if (tErr) {
    await admin.from('delete_jobs').update({
      status: 'failed',
      last_error: 'failed to insert targets: ' + tErr.message,
      finished_at: new Date().toISOString(),
    }).eq('id', job.id);
    return NextResponse.json({ error: tErr.message }, { status: 500 });
  }

  return NextResponse.json({
    job_id: job.id,
    total_targets: collectedTargets.length,
    scheduled_at: job.scheduled_at,
    status: 'pending',
  });
}

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const workspaceId = url.searchParams.get('workspace_id');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }

  const { data: jobs, error } = await supabase
    .from('delete_jobs')
    .select(
      'id, kind, source_broadcast_id, delay_seconds, scheduled_at, status, total_targets, deleted_count, failed_count, created_at, started_at, finished_at, last_error'
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: jobs || [] });
}
