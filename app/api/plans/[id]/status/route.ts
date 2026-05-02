import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/plans/[id]/status
 *
 * Polled by the client every ~2-3 seconds while a plan is being analyzed.
 * Returns the latest status and (when ready) the extracted data summary.
 */

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const planId = params.id;
  if (!planId) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

  const admin = createAdminClient();
  const { data: planRow } = await admin
    .from('construction_plans')
    .select(
      'id, workspace_id, status, error_message, ai_confidence_score, ai_model_used, ai_tokens_used, ai_extracted_data, plan_type, scale, detected_floors, detected_rooms_count, detected_total_area_sqm, ai_summary, processing_started_at, processing_completed_at'
    )
    .eq('id', planId)
    .maybeSingle();

  if (!planRow) {
    return NextResponse.json({ error: 'plan_not_found' }, { status: 404 });
  }

  const plan = planRow as {
    id: string;
    workspace_id: string;
    status: string;
    error_message: string | null;
    ai_confidence_score: number | null;
    ai_model_used: string | null;
    ai_tokens_used: number | null;
    ai_extracted_data: Record<string, unknown> | null;
    plan_type: string | null;
    scale: string | null;
    detected_floors: number | null;
    detected_rooms_count: number | null;
    detected_total_area_sqm: number | null;
    ai_summary: string | null;
    processing_started_at: string | null;
    processing_completed_at: string | null;
  };

  // Verify membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', plan.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    plan_id: plan.id,
    status: plan.status,
    error_message: plan.error_message,
    confidence: plan.ai_confidence_score,
    model: plan.ai_model_used,
    tokens_used: plan.ai_tokens_used,
    plan_type: plan.plan_type,
    scale: plan.scale,
    floors: plan.detected_floors,
    rooms_count: plan.detected_rooms_count,
    total_area_sqm: plan.detected_total_area_sqm,
    summary: plan.ai_summary,
    extracted: plan.ai_extracted_data,
    rooms_inserted: (plan.ai_extracted_data as { _rooms_inserted?: number } | null)?._rooms_inserted ?? 0,
    rooms_table_id: (plan.ai_extracted_data as { _rooms_table_id?: string } | null)?._rooms_table_id ?? null,
    started_at: plan.processing_started_at,
    completed_at: plan.processing_completed_at,
  });
}
