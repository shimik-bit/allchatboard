import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { generateCashflowForecast } from '@/lib/cashflow/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/cashflow/generate
 *
 * Triggers a cashflow forecast regeneration for the workspace.
 *
 * Body:
 *   { workspace_id: UUID }
 *
 * Response:
 *   {
 *     forecasts_created: number,
 *     forecasts_updated: number,
 *     forecasts_unchanged: number,
 *     recurring_patterns_detected: number,
 *     vat_obligations_calculated: number,
 *     pending_invoices_added: number,
 *     pipeline_records_added: number,
 *     bank_transactions_analyzed: number,
 *     horizon_days: number
 *   }
 *
 * Idempotent — running multiple times is safe. User-confirmed entries are
 * never overwritten. Stale auto-forecasts get updated with new amounts/dates.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const workspaceId = body.workspace_id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
    }

    // Verify membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();
    if (!membership || !['owner', 'admin', 'editor'].includes(membership.role)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();
    const result = await generateCashflowForecast(admin, workspaceId, 'manual', user.id);

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('Cashflow generate error', e);
    return NextResponse.json(
      { error: e?.message || 'failed to generate forecast' },
      { status: 500 }
    );
  }
}
