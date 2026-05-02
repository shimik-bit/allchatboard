// app/api/crm/lead-update/route.ts
// API endpoint לעדכון סטטוס ליד מהקנבן
// POST /api/crm/lead-update
// Body: { lead_id: string, new_stage: string }

import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const VALID_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

export async function POST(request: Request) {
  try {
    // 1. אימות שהמשתמש מחובר
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. ולידציה של הקלט
    const body = await request.json();
    const { lead_id, new_stage } = body;

    if (!lead_id || !new_stage) {
      return NextResponse.json({ error: 'lead_id and new_stage are required' }, { status: 400 });
    }

    if (!VALID_STAGES.includes(new_stage)) {
      return NextResponse.json({ error: `Invalid stage. Must be one of: ${VALID_STAGES.join(', ')}` }, { status: 400 });
    }

    // 3. בדיקה שהמשתמש שייך ל-workspace של הליד
    const admin = createAdminClient();
    
    const { data: lead, error: leadError } = await admin
      .from('records')
      .select('id, data, workspace_id, table_id')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // בדיקה שהמשתמש חבר ב-workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_id', lead.workspace_id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden - not a member of this workspace' }, { status: 403 });
    }

    // 4. עדכון הסטטוס
    const updatedData = {
      ...(lead.data as any),
      stage: new_stage,
    };

    const { error: updateError } = await admin
      .from('records')
      .update({ 
        data: updatedData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead_id);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      lead_id,
      new_stage,
    });

  } catch (err) {
    console.error('lead-update error:', err);
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Unknown error' 
    }, { status: 500 });
  }
}
