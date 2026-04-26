import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/reports?workspace_id=xxx  - list reports
 * POST /api/reports                  - create new report
 */

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

  const { data: reports, error } = await supabase
    .from('scheduled_reports')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also fetch tables for the UI form
  const { data: tables } = await supabase
    .from('tables')
    .select('id, name, icon')
    .eq('workspace_id', workspaceId)
    .eq('is_archived', false)
    .order('position');

  // Recent run history per report
  const { data: recentRuns } = await supabase
    .from('scheduled_report_runs')
    .select('id, report_id, ran_at, success, recipients_sent, error_message')
    .eq('workspace_id', workspaceId)
    .order('ran_at', { ascending: false })
    .limit(50);

  return NextResponse.json({
    reports: reports || [],
    tables: tables || [],
    recent_runs: recentRuns || [],
  });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    workspace_id, name, description, template_type, template_config,
    schedule_time, schedule_days, timezone,
    recipient_phones, recipient_names,
    table_ids, enabled,
  } = body;

  if (!workspace_id || !name?.trim() || !template_type) {
    return NextResponse.json({ error: 'workspace_id, name, template_type are required' }, { status: 400 });
  }

  if (!Array.isArray(recipient_phones) || recipient_phones.length === 0) {
    return NextResponse.json({ error: 'At least one recipient phone is required' }, { status: 400 });
  }

  // Verify admin
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .single();
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'admin/owner only' }, { status: 403 });
  }

  const { data: report, error } = await supabase
    .from('scheduled_reports')
    .insert({
      workspace_id,
      name: name.trim(),
      description: description || null,
      template_type,
      template_config: template_config || {},
      schedule_time: schedule_time || '09:00',
      schedule_days: schedule_days || [0, 1, 2, 3, 4, 5, 6],
      timezone: timezone || 'Asia/Jerusalem',
      recipient_phones,
      recipient_names: recipient_names || [],
      table_ids: Array.isArray(table_ids) && table_ids.length > 0 ? table_ids : null,
      enabled: enabled !== false,
      created_by: user.id,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ report }, { status: 201 });
}
