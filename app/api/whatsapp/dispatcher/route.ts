import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  sendMessage,
  deleteMessage,
} from '@/lib/groupguard/green-api-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // also declared in vercel.json

/**
 * /api/whatsapp/dispatcher
 *
 * Cron-driven dispatcher for broadcast_jobs and delete_jobs. Runs every
 * minute via Vercel Cron. On each invocation:
 *
 *   1. Atomically claim ONE eligible job per type (broadcast + delete).
 *      Eligible = status='pending' AND (scheduled_at IS NULL OR scheduled_at <= now()).
 *      We mark it 'running' before processing so concurrent runs don't
 *      double-process the same job. (Vercel Cron itself is single-fire,
 *      but a manual GET to this endpoint at the same time as a cron
 *      run would otherwise duplicate.)
 *
 *   2. For each pending target in the claimed job:
 *      - Send/delete via Green API
 *      - Wait `delay_seconds` between targets (the WhatsApp anti-spam concern)
 *      - Update the target row + the job's counters
 *
 *   3. Mark the job 'done' or 'failed' when targets are exhausted.
 *
 * Why one job per type per cron tick? A single job can take a long time
 * (10 groups × 30s delay = 5 minutes) and Vercel functions cap at 60s.
 * If we have more pending jobs, the next cron tick picks them up. The
 * tradeoff is throughput on small backlogs, which is acceptable here —
 * a workspace with 50 groups is going to take 25 minutes anyway, and
 * making this a queue worker would require a separate infra (Inngest,
 * Trigger.dev, etc.) that we'd rather not introduce yet.
 *
 * Auth: protected by CRON_SECRET. Vercel Cron auto-injects the header.
 * Manual hits during dev should pass `?secret=<CRON_SECRET>` or the same
 * Authorization header.
 */
export async function GET(req: NextRequest) {
  // Auth: Vercel Cron sends Authorization: Bearer <CRON_SECRET>. If
  // CRON_SECRET is set, we enforce it. If unset, we allow the request
  // (the endpoint only processes jobs that already exist — it can't
  // create or modify them — so the worst case from a missing secret
  // is wasted compute on flood requests, which Vercel rate-limits anyway).
  // For production deploys it's still recommended to set CRON_SECRET.
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const authHeader = req.headers.get('authorization');
    const querySecret = new URL(req.url).searchParams.get('secret');
    const provided =
      (authHeader && authHeader.replace(/^Bearer\s+/i, '')) || querySecret;
    if (provided !== expected) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const startedAt = Date.now();
  const budgetMs = 50_000; // leave 10s headroom under the 60s function cap

  const result = {
    broadcast: await processOneBroadcast(admin, startedAt, budgetMs),
    delete: await processOneDelete(admin, startedAt, budgetMs),
  };

  return NextResponse.json(result);
}

// ─────────────────────────────────────────────────────────────────────────────
// BROADCAST: send a message to N groups with delay between sends
// ─────────────────────────────────────────────────────────────────────────────

async function processOneBroadcast(
  admin: ReturnType<typeof createAdminClient>,
  startedAt: number,
  budgetMs: number
) {
  // Claim a job: pick the oldest pending job whose scheduled_at has passed
  // (or is null = immediate). Atomically flip its status to 'running'.
  // Done as a single UPDATE...RETURNING to prevent two cron runs from
  // grabbing the same job.
  const { data: claimed, error: claimErr } = await admin.rpc(
    'broadcast_claim_next_job'
  );

  if (claimErr) {
    console.error('[dispatcher] broadcast claim error:', claimErr);
    return { claimed: null, processed: 0, error: claimErr.message };
  }
  if (!claimed || claimed.length === 0) {
    return { claimed: null, processed: 0 };
  }
  const job = claimed[0];

  // Load workspace creds — broadcast can't run without an instance
  const { data: workspace } = await admin
    .from('workspaces')
    .select('whatsapp_instance_id, whatsapp_token')
    .eq('id', job.workspace_id)
    .single();
  if (!workspace?.whatsapp_instance_id || !workspace?.whatsapp_token) {
    await admin
      .from('broadcast_jobs')
      .update({
        status: 'failed',
        last_error: 'workspace has no Green API instance configured',
        finished_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    return { claimed: job.id, processed: 0, error: 'no creds' };
  }
  const creds = {
    instanceId: workspace.whatsapp_instance_id,
    apiToken: workspace.whatsapp_token,
  };

  // Process pending targets one at a time, with the configured delay between
  // them. Stop when the budget is exhausted — the next cron tick will pick
  // up where we left off.
  let processed = 0;
  while (Date.now() - startedAt < budgetMs) {
    const { data: targets } = await admin
      .from('broadcast_targets')
      .select(
        'id, group_id, position, whatsapp_groups(green_api_chat_id, group_name)'
      )
      .eq('job_id', job.id)
      .eq('status', 'pending')
      .order('position', { ascending: true })
      .limit(1);

    if (!targets || targets.length === 0) break;
    const target = targets[0] as any;
    const chatId = target.whatsapp_groups?.green_api_chat_id;

    if (!chatId) {
      await admin
        .from('broadcast_targets')
        .update({
          status: 'skipped',
          error: 'group has no green_api_chat_id',
        })
        .eq('id', target.id);
      await admin
        .from('broadcast_jobs')
        .update({ failed_count: job.failed_count + 1 })
        .eq('id', job.id);
      processed++;
      continue;
    }

    // Apply the inter-message delay BEFORE sending (except for the first one).
    // Sleeping before — not after — lets the loop exit cleanly when budget runs out.
    if (processed > 0 && job.delay_seconds > 0) {
      const remaining = budgetMs - (Date.now() - startedAt);
      const waitMs = Math.min(job.delay_seconds * 1000, remaining - 5000);
      if (waitMs <= 0) break;
      await sleep(waitMs);
    }

    // Send.
    const result = await sendMessage(creds, chatId, job.message_text);

    if (result.ok) {
      await admin
        .from('broadcast_targets')
        .update({
          status: 'sent',
          green_message_id: (result.data as any)?.idMessage || null,
          sent_at: new Date().toISOString(),
        })
        .eq('id', target.id);
      await admin.rpc('broadcast_increment_sent', { p_job_id: job.id });
    } else {
      await admin
        .from('broadcast_targets')
        .update({
          status: 'failed',
          error: result.error || `HTTP ${result.statusCode}`,
        })
        .eq('id', target.id);
      await admin.rpc('broadcast_increment_failed', { p_job_id: job.id });
    }
    processed++;
  }

  // Mark the job done if no pending targets remain. Otherwise leave it
  // 'running' so the next cron tick continues.
  const { count: remaining } = await admin
    .from('broadcast_targets')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', job.id)
    .eq('status', 'pending');

  if (remaining === 0) {
    await admin
      .from('broadcast_jobs')
      .update({
        status: 'done',
        finished_at: new Date().toISOString(),
      })
      .eq('id', job.id);
  }

  return { claimed: job.id, processed, remaining };
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE: delete N messages with delay
// ─────────────────────────────────────────────────────────────────────────────

async function processOneDelete(
  admin: ReturnType<typeof createAdminClient>,
  startedAt: number,
  budgetMs: number
) {
  const { data: claimed, error: claimErr } = await admin.rpc(
    'delete_claim_next_job'
  );
  if (claimErr) {
    console.error('[dispatcher] delete claim error:', claimErr);
    return { claimed: null, processed: 0, error: claimErr.message };
  }
  if (!claimed || claimed.length === 0) {
    return { claimed: null, processed: 0 };
  }
  const job = claimed[0];

  const { data: workspace } = await admin
    .from('workspaces')
    .select('whatsapp_instance_id, whatsapp_token')
    .eq('id', job.workspace_id)
    .single();
  if (!workspace?.whatsapp_instance_id || !workspace?.whatsapp_token) {
    await admin
      .from('delete_jobs')
      .update({
        status: 'failed',
        last_error: 'workspace has no Green API instance configured',
        finished_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    return { claimed: job.id, processed: 0, error: 'no creds' };
  }
  const creds = {
    instanceId: workspace.whatsapp_instance_id,
    apiToken: workspace.whatsapp_token,
  };

  let processed = 0;
  while (Date.now() - startedAt < budgetMs) {
    const { data: targets } = await admin
      .from('delete_targets')
      .select(
        'id, green_message_id, position, whatsapp_groups(green_api_chat_id)'
      )
      .eq('job_id', job.id)
      .eq('status', 'pending')
      .order('position', { ascending: true })
      .limit(1);

    if (!targets || targets.length === 0) break;
    const target = targets[0] as any;
    const chatId = target.whatsapp_groups?.green_api_chat_id;

    if (!chatId) {
      await admin
        .from('delete_targets')
        .update({ status: 'skipped', error: 'group has no green_api_chat_id' })
        .eq('id', target.id);
      processed++;
      continue;
    }

    if (processed > 0 && job.delay_seconds > 0) {
      const remaining = budgetMs - (Date.now() - startedAt);
      const waitMs = Math.min(job.delay_seconds * 1000, remaining - 5000);
      if (waitMs <= 0) break;
      await sleep(waitMs);
    }

    const result = await deleteMessage(creds, chatId, target.green_message_id);

    if (result.ok) {
      await admin
        .from('delete_targets')
        .update({
          status: 'deleted',
          deleted_at: new Date().toISOString(),
        })
        .eq('id', target.id);
      await admin.rpc('delete_increment_deleted', { p_job_id: job.id });
    } else {
      await admin
        .from('delete_targets')
        .update({
          status: 'failed',
          error: result.error || `HTTP ${result.statusCode}`,
        })
        .eq('id', target.id);
      await admin.rpc('delete_increment_failed', { p_job_id: job.id });
    }
    processed++;
  }

  const { count: remaining } = await admin
    .from('delete_targets')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', job.id)
    .eq('status', 'pending');

  if (remaining === 0) {
    await admin
      .from('delete_jobs')
      .update({ status: 'done', finished_at: new Date().toISOString() })
      .eq('id', job.id);
  }

  return { claimed: job.id, processed, remaining };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
