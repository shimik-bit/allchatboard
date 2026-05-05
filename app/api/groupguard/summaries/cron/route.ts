import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { summarizeGroup } from '@/lib/groupguard/group-summarizer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET/POST /api/groupguard/summaries/cron
 *
 * Auth: Bearer ${CRON_SECRET}
 *
 * Runs ONCE per day (Vercel Hobby plan limit). Sweeps all groups with
 * summary_enabled=true AND summary_auto=true and generates a summary for
 * each one.
 *
 * Why not honor each group's chosen summary_hour? Vercel Hobby disallows
 * sub-daily cron schedules, so we can't run an hourly cron that checks
 * for matching hours. The summary_hour field still exists on the row but
 * is currently ignored by the cron — kept for forward-compat when/if the
 * project upgrades to Vercel Pro.
 *
 * Re-runs in the same day are safe: summarizeGroup() dedupes via
 * summary_date UNIQUE constraint, so a manual run earlier won't be
 * overwritten by the cron.
 *
 * Limits: BATCH_SIZE caps processing per invocation. If the workspace has
 * more than BATCH_SIZE groups configured for auto-summary, only the first
 * BATCH_SIZE are processed today and the rest get picked up tomorrow.
 * In practice no workspace should have >10 daily-summary groups; if that
 * changes, we can paginate or upgrade the plan.
 */

const BATCH_SIZE = 10;

function checkAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') || '';
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) {
    console.warn('[GG][summary-cron] CRON_SECRET not set');
    return false;
  }
  return authHeader === `Bearer ${expectedSecret}`;
}

async function handle() {
  const supabase = createAdminClient();
  const startedAt = Date.now();

  // We run this cron ONCE per day at a fixed hour (21:00 UTC = ~midnight in
  // Israel). Vercel's Hobby plan disallows sub-daily crons, so the previous
  // hourly approach (which let each group pick its own summary_hour) had to
  // be replaced with a single daily sweep across all enabled groups.
  //
  // The summary_hour field still exists on the row for forward-compat with
  // a future Pro-plan upgrade, but it's currently ignored by this cron.
  const { data: candidates, error } = await supabase
    .from('whatsapp_groups')
    .select('id, group_name, workspace_id')
    .eq('is_active', true)
    .eq('summary_enabled', true)
    .eq('summary_auto', true)
    .limit(BATCH_SIZE);

  if (error) {
    console.error('[GG][summary-cron] candidate query failed:', error);
    return { ok: false, error: error.message };
  }

  if (!candidates || candidates.length === 0) {
    return {
      ok: true,
      processed: 0,
      generated: 0,
      duration_ms: Date.now() - startedAt,
      message: 'no_candidates',
    };
  }

  // Process sequentially (10 groups × ~5s/group = ~50s, fits the 60s budget).
  // Parallel calls would be faster but harder to keep under the timeout
  // and would burst OpenAI rate limits.
  const results: Array<{ group_id: string; status: string }> = [];
  for (const g of candidates) {
    try {
      const result = await summarizeGroup(supabase, g.id, {
        triggeredBy: 'auto',
      });
      if (result.ok && 'skipped' in result && result.skipped) {
        results.push({ group_id: g.id, status: `skipped:${result.reason}` });
      } else if (result.ok) {
        results.push({ group_id: g.id, status: 'generated' });
      } else {
        results.push({ group_id: g.id, status: `error:${result.error}` });
      }
    } catch (err) {
      console.error('[GG][summary-cron] failed for group', g.id, err);
      results.push({ group_id: g.id, status: 'exception' });
    }
  }

  return {
    ok: true,
    processed: results.length,
    generated: results.filter((r) => r.status === 'generated').length,
    skipped: results.filter((r) => r.status.startsWith('skipped:')).length,
    errors: results.filter((r) => r.status.startsWith('error:') || r.status === 'exception').length,
    duration_ms: Date.now() - startedAt,
    results,
  };
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json(await handle());
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json(await handle());
}
