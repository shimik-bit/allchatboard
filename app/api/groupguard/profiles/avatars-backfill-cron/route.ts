import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { backfillWorkspaceAvatars } from '@/lib/groupguard/avatar-fetcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * GET /api/groupguard/profiles/avatars-backfill-cron
 *
 * Daily cron at 03:30 UTC. For every workspace with at least one
 * authorized green_api instance, fetches avatars for profiles missing
 * one (capped at 100 per workspace per run to keep total runtime
 * bounded).
 *
 * This runs alongside the existing extract-cron (which does AI profile
 * extraction at 04:00). Avatars and AI extraction are decoupled —
 * neither blocks the other.
 *
 * Auth: Vercel cron supplies Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization') || '';
    const queryParam = new URL(req.url).searchParams.get('secret') || '';
    const ok =
      authHeader === `Bearer ${cronSecret}` || queryParam === cronSecret;
    if (!ok) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Find workspaces with an authorized green_api instance — those are the
  // only ones for which avatar fetching can actually work. Cloud API doesn't
  // support fetching arbitrary contacts' avatars.
  const { data: rows } = await admin
    .from('whatsapp_instances')
    .select('workspace_id')
    .eq('provider', 'green_api')
    .eq('state', 'authorized');

  const workspaceIds: string[] = Array.from(
    new Set((rows || []).map((r: { workspace_id: string }) => r.workspace_id)),
  );

  if (workspaceIds.length === 0) {
    return NextResponse.json({ ok: true, workspaces_checked: 0, total: { processed: 0, updated: 0 } });
  }

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalNoPicture = 0;
  let totalErrors = 0;
  const perWorkspace: Array<{
    workspace_id: string;
    processed: number;
    updated: number;
  }> = [];

  // Sequential to avoid Green API rate spikes. With 100 profiles per
  // workspace × 250ms each = ~25s per workspace, fits easily in the
  // 5-minute maxDuration for any realistic deployment.
  for (const wsId of workspaceIds) {
    try {
      const result = await backfillWorkspaceAvatars({
        supabase: admin,
        workspaceId: wsId,
        maxProfiles: 100,
        onlyMissing: true, // cron only fills gaps, never re-fetches
      });
      totalProcessed += result.processed;
      totalUpdated += result.updated;
      totalNoPicture += result.no_picture;
      totalErrors += result.errors;
      perWorkspace.push({
        workspace_id: wsId,
        processed: result.processed,
        updated: result.updated,
      });
    } catch (err) {
      console.error(`[avatar-cron] ws=${wsId} failed:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    workspaces_checked: workspaceIds.length,
    total: {
      processed: totalProcessed,
      updated: totalUpdated,
      no_picture: totalNoPicture,
      errors: totalErrors,
    },
    results: perWorkspace,
  });
}
