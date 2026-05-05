import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { recoverWorkspaceInstances } from '@/lib/whatsapp/recover';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // up to 5 min — many workspaces × multiple instances

/**
 * GET /api/whatsapp/recover-cron
 *
 * Daily Vercel cron at 12:00 UTC. Iterates every workspace that has at
 * least one authorized Green API instance and runs the recovery flow
 * against it. Catches the case where Green API got stuck while the user
 * wasn't actively using the dashboard (the silent dashboard-load trigger
 * only fires when someone opens the app).
 *
 * Auth: Vercel cron requests carry an Authorization: Bearer <CRON_SECRET>
 * header. We accept that or a matching ?secret= query param so this is
 * also testable from a browser tab during development.
 */

export async function GET(req: NextRequest) {
  // Verify cron secret — protects from public hits
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization') || '';
    const queryParam = new URL(req.url).searchParams.get('secret') || '';
    const ok =
      authHeader === `Bearer ${cronSecret}` ||
      queryParam === cronSecret;
    if (!ok) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const admin = createAdminClient();

  // Find all workspaces that have at least one authorized Green API
  // instance. Doing the distinct via a select+Set rather than a SQL
  // distinct because Supabase JS doesn't expose distinct cleanly.
  const { data: rows } = await admin
    .from('whatsapp_instances')
    .select('workspace_id')
    .eq('provider', 'green_api')
    .eq('state', 'authorized');

  const workspaceIds: string[] = Array.from(
    new Set((rows || []).map((r: { workspace_id: string }) => r.workspace_id)),
  );

  if (workspaceIds.length === 0) {
    return NextResponse.json({
      ok: true,
      workspaces_checked: 0,
      total_recovered: 0,
      total_groups_created: 0,
      results: [],
    });
  }

  // Origin for the webhook self-fetch — has to be a real reachable URL
  // since the cron runs server-side, the request URL host is the local
  // function host which is fine.
  const origin =
    req.headers.get('origin') ||
    `https://${req.headers.get('host') || 'taskflow-ai.com'}`;

  let totalRecovered = 0;
  let totalGroupsCreated = 0;
  const perWorkspace: Array<{
    workspace_id: string;
    recovered: number;
    groups_created: number;
    webhook_reset: boolean;
  }> = [];

  // Process workspaces sequentially. Doing them in parallel could spike
  // Green API rate limits across many tenants at the same wall-clock
  // moment, and serially we still finish in well under maxDuration for
  // any realistic deployment.
  for (const wsId of workspaceIds) {
    try {
      const result = await recoverWorkspaceInstances({
        admin,
        origin,
        workspaceId: wsId,
        silent: false, // cron always runs, never throttled
      });
      totalRecovered += result.recovered;
      totalGroupsCreated += result.groups_created;
      perWorkspace.push({
        workspace_id: wsId,
        recovered: result.recovered,
        groups_created: result.groups_created,
        webhook_reset: result.webhook_reset,
      });
    } catch (err) {
      console.error(`[recover-cron] ws=${wsId} failed:`, err);
      perWorkspace.push({
        workspace_id: wsId,
        recovered: 0,
        groups_created: 0,
        webhook_reset: false,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    workspaces_checked: workspaceIds.length,
    total_recovered: totalRecovered,
    total_groups_created: totalGroupsCreated,
    results: perWorkspace,
  });
}
