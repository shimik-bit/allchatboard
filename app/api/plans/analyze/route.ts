import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/plans/analyze
 *
 * Triggers AI analysis on a previously uploaded plan. This route does the
 * authorization check (workspace membership) and then calls the analyze-plan
 * Edge Function which runs the actual Claude vision call in the background.
 *
 * Body: { plan_id: string }
 * Response: { plan_id, status: 'analyzing' }
 */

type AnalyzeBody = {
  plan_id?: string;
};

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: AnalyzeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { plan_id } = body;
  if (!plan_id) {
    return NextResponse.json({ error: 'plan_id is required' }, { status: 400 });
  }

  // Look up the plan (admin bypass) so we know its workspace
  const admin = createAdminClient();
  const { data: planRow } = await admin
    .from('construction_plans')
    .select('id, workspace_id, status')
    .eq('id', plan_id)
    .maybeSingle();

  if (!planRow) {
    return NextResponse.json({ error: 'plan_not_found' }, { status: 404 });
  }

  const plan = planRow as { id: string; workspace_id: string; status: string };

  // Verify membership of that workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', plan.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || !['owner', 'admin', 'editor'].includes((membership as { role: string }).role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Call the Edge Function
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const fnUrl = `${supabaseUrl}/functions/v1/analyze-plan`;

  const fnResp = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
    },
    body: JSON.stringify({ plan_id, workspace_id: plan.workspace_id }),
  });

  const respText = await fnResp.text();
  let respData: unknown;
  try {
    respData = JSON.parse(respText);
  } catch {
    respData = { raw: respText };
  }

  if (!fnResp.ok) {
    console.error('[plans/analyze] edge function failed:', fnResp.status, respText);
    return NextResponse.json(
      { error: 'analyze_failed', details: respData },
      { status: 502 }
    );
  }

  return NextResponse.json(respData);
}
