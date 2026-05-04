import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/whatsapp/broadcasts
 *   Creates a broadcast job: send a text to N groups with an inter-message delay.
 *
 * Body:
 *   {
 *     workspace_id: string,
 *     message_text: string (1..4096),
 *     group_ids: string[] (1..100),
 *     delay_seconds?: number (default 30, 0..3600),
 *     scheduled_at?: ISO string (default null = immediate)
 *   }
 *
 * Returns: { job_id, total_targets, scheduled_at }
 *
 * Authorization: workspace owner/admin only.
 *
 * GET /api/whatsapp/broadcasts?workspace_id=X
 *   Lists recent broadcasts in the workspace, with target counts inlined.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // --- Validation ---
  const { workspace_id, message_text, group_ids, delay_seconds, scheduled_at } = body || {};

  if (typeof workspace_id !== 'string' || !workspace_id) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }
  const text = typeof message_text === 'string' ? message_text.trim() : '';
  if (!text) {
    return NextResponse.json({ error: 'message_text required' }, { status: 400 });
  }
  if (text.length > 4096) {
    return NextResponse.json({ error: 'message_text too long (max 4096)' }, { status: 400 });
  }
  if (!Array.isArray(group_ids) || group_ids.length === 0) {
    return NextResponse.json({ error: 'group_ids[] required' }, { status: 400 });
  }
  if (group_ids.length > 100) {
    return NextResponse.json(
      { error: 'cannot broadcast to more than 100 groups in one job' },
      { status: 400 }
    );
  }
  const delay = Number.isFinite(delay_seconds) ? Math.floor(delay_seconds) : 30;
  if (delay < 0 || delay > 3600) {
    return NextResponse.json({ error: 'delay_seconds must be 0..3600' }, { status: 400 });
  }

  // scheduled_at: optional, must be a parseable ISO and not too far in the future
  let scheduledAt: string | null = null;
  if (scheduled_at) {
    const d = new Date(scheduled_at);
    if (isNaN(d.getTime())) {
      return NextResponse.json({ error: 'scheduled_at is not a valid date' }, { status: 400 });
    }
    // Allow up to 90 days in the future. Anything further is more likely
    // a typo than intent; the user can re-create later if needed.
    const maxFuture = Date.now() + 90 * 24 * 60 * 60 * 1000;
    if (d.getTime() > maxFuture) {
      return NextResponse.json(
        { error: 'scheduled_at can be at most 90 days in the future' },
        { status: 400 }
      );
    }
    // Past dates are fine — they'll just be picked up immediately by the
    // dispatcher (treated as "send now"). Avoids confusing the user when
    // they pick "in 30s" and are 35s late submitting.
    scheduledAt = d.toISOString();
  }

  // --- Authorization: must be admin/owner ---
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
    return NextResponse.json(
      { error: 'forbidden — broadcast requires admin or owner role' },
      { status: 403 }
    );
  }

  const admin = createAdminClient();

  // --- Validate the groups: must all belong to this workspace AND have a green_api_chat_id ---
  const { data: groups } = await admin
    .from('whatsapp_groups')
    .select('id, green_api_chat_id, group_name, is_active')
    .eq('workspace_id', workspace_id)
    .in('id', group_ids);

  if (!groups || groups.length !== group_ids.length) {
    return NextResponse.json(
      { error: 'one or more group_ids do not belong to this workspace' },
      { status: 400 }
    );
  }
  const missingChatId = groups.filter((g: any) => !g.green_api_chat_id);
  if (missingChatId.length > 0) {
    return NextResponse.json(
      {
        error: `${missingChatId.length} group(s) have no Green API chat id and cannot be messaged`,
        groups: missingChatId.map((g: any) => g.group_name || g.id),
      },
      { status: 400 }
    );
  }

  // --- Create the job + targets in two writes (no transaction primitive in
  // supabase-js; if the targets write fails we mark the job 'failed' so
  // it's never picked up by the dispatcher) ---
  const { data: job, error: jobErr } = await admin
    .from('broadcast_jobs')
    .insert({
      workspace_id,
      created_by: user.id,
      message_text: text,
      delay_seconds: delay,
      scheduled_at: scheduledAt,
      total_targets: groups.length,
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

  // Insert targets in their original order. Position tracks send order so
  // the user can predict "the 3rd group will receive at T+60s".
  const targets = groups.map((g: any, idx: number) => ({
    job_id: job.id,
    workspace_id,
    group_id: g.id,
    position: idx + 1,
    status: 'pending',
  }));

  const { error: targetsErr } = await admin.from('broadcast_targets').insert(targets);
  if (targetsErr) {
    // Best-effort cleanup: mark the job as failed so it's not dispatched.
    await admin
      .from('broadcast_jobs')
      .update({
        status: 'failed',
        last_error: 'failed to insert targets: ' + targetsErr.message,
        finished_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    return NextResponse.json(
      { error: 'failed to insert targets: ' + targetsErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    job_id: job.id,
    total_targets: groups.length,
    scheduled_at: job.scheduled_at,
    status: 'pending',
  });
}

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const workspaceId = url.searchParams.get('workspace_id');
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }

  // RLS will enforce membership — we read with the user-scoped client.
  const { data: jobs, error } = await supabase
    .from('broadcast_jobs')
    .select(
      'id, message_text, delay_seconds, scheduled_at, status, total_targets, sent_count, failed_count, created_at, started_at, finished_at, last_error'
    )
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jobs: jobs || [] });
}
