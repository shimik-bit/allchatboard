// app/api/crm/lead-create/route.ts
// POST /api/crm/lead-create
// יוצר ליד חדש בטבלת leads + מקפיץ trigger לחישוב ai_score

import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

const VALID_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
const VALID_SOURCES = ['referral', 'website', 'google', 'whatsapp', 'facebook', 'instagram', 'cold_call', 'other'];

export async function POST(request: Request) {
  try {
    // 1. אימות
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    }

    // 2. workspace
    const cookieStore = cookies();
    const cookieWsId = cookieStore.get('tf_active_workspace')?.value;
    
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id);
    
    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ error: 'אין workspace' }, { status: 400 });
    }
    
    const wsId = cookieWsId && memberships.find(m => m.workspace_id === cookieWsId)
      ? cookieWsId
      : memberships[0].workspace_id;

    // 3. ולידציה
    const body = await request.json();
    const { title, contact_name, phone, email, value, stage, source, notes } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'חובה למלא כותרת' }, { status: 400 });
    }

    const cleanStage = VALID_STAGES.includes(stage) ? stage : 'new';
    const cleanSource = VALID_SOURCES.includes(source) ? source : 'other';
    const cleanValue = value ? Number(value) : null;

    // 4. מציאת טבלת leads
    const admin = createAdminClient();
    const { data: leadsTable } = await admin
      .from('tables')
      .select('id')
      .eq('workspace_id', wsId)
      .eq('slug', 'leads')
      .maybeSingle();

    if (!leadsTable) {
      return NextResponse.json({ 
        error: 'CRM Pack לא מותקן ב-workspace זה' 
      }, { status: 400 });
    }

    // 5. יצירת הליד
    const leadData: any = {
      title: title.trim(),
      stage: cleanStage,
      source: cleanSource,
    };
    
    if (contact_name?.trim()) leadData.contact_name = contact_name.trim();
    if (phone?.trim()) leadData.phone = phone.trim();
    if (email?.trim()) leadData.email = email.trim();
    if (cleanValue) leadData.value = cleanValue;
    if (notes?.trim()) leadData.notes = notes.trim();

    const { data: created, error: insertError } = await admin
      .from('records')
      .insert({
        workspace_id: wsId,
        table_id: leadsTable.id,
        data: leadData,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      lead_id: created.id,
      lead: created,
    });

  } catch (err) {
    console.error('lead-create error:', err);
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'שגיאה לא ידועה' 
    }, { status: 500 });
  }
}
