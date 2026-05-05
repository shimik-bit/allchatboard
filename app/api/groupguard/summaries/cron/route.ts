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
 * Runs hourly. For each call:
 *   1. Find all groups with summary_enabled=true AND summary_auto=true AND
 *      summary_hour matches the current UTC hour
 *   2. For each, generate a summary if one doesn't already exist for today
 *   3. Process up to BATCH_SIZE groups per run to stay under 60s
 *
 * The hourly schedule means a group set to "21:00" gets its summary
 * generated within the 21:00 hour. Sub-hour precision isn't worth the
 * cron complexity since users don't expect "exactly 21:00 sharp" for a
 * batched daily report.
 *
 * Re-runs in the same hour are safe: summarizeGroup() dedupes via
 * summary_date UNIQUE constraint, so the second cron call this hour will
 * skip groups it already processed.
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
  const currentHour = new Date().getUTCHours();

  // Find groups whose schedule fires this hour. Note: we filter on
  // summary_hour matching *current UTC hour*. For workspaces in Israel
  // (UTC+2/+3), this is shifted — a group set to "21" in the UI is stored
  // as 21 here. Future enhancement could join workspace timezone to make
  // the displayed time match local time, but for the v1 we accept that the
  // hour is "UTC hour-of-day" and document accordingly in the UI tooltip.
  const { data: candidates, error } = await supabase
    .from('whatsapp_groups')
    .select('id, group_name, workspace_id')
    .eq('is_active', true)
    .eq('summary_enabled', true)
    .eq('summary_auto', true)
    .eq('summary_hour', currentHour)
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
      message: `no_candidates_at_utc_hour_${currentHour}`,
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
