// app/api/inbox/convert-to-lead/route.ts
// POST - הופך escalation לליד CRM
// Body: { escalation_id: string }
//
// השדות הנגזרים:
// - title: מתוך title של ה-escalation
// - phone: source_phone
// - notes: ai_explanation + last_message_excerpt
// - source: 'whatsapp' (כי כל ה-escalations כרגע מ-WA)
// - stage: 'contacted' (כי כבר היה איתו אינטראקציה)
//
// אם כבר קיים ליד עם אותו טלפון - לא יוצר חדש, מחזיר את הקיים

import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    // Auth
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    }

    const body = await request.json();
    const { escalation_id } = body;
    if (!escalation_id) {
      return NextResponse.json({ error: 'escalation_id is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. שולף את ה-escalation
    const { data: escalation, error: escError } = await admin
      .from('escalations')
      .select('*')
      .eq('id', escalation_id)
      .single();

    if (escError || !escalation) {
      return NextResponse.json({ error: 'Escalation not found' }, { status: 404 });
    }

    // 2. אימות שהמשתמש שייך ל-workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_id', escalation.workspace_id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 3. מחפש טבלת leads
    const { data: leadsTable } = await admin
      .from('tables')
      .select('id')
      .eq('workspace_id', escalation.workspace_id)
      .eq('slug', 'leads')
      .maybeSingle();

    if (!leadsTable) {
      return NextResponse.json({ 
        error: 'CRM Pack לא מותקן ב-workspace זה. תיכנס ל-Hub כדי להתקין.',
        needs_install: true,
      }, { status: 400 });
    }

    // 4. בודק אם כבר קיים ליד עם אותו טלפון
    const phone = escalation.source_phone || '';
    const cleanPhone = phone.replace(/\D/g, '').slice(-9);
    
    if (cleanPhone.length >= 7) {
      const { data: existingLeads } = await admin
        .from('records')
        .select('id, data')
        .eq('table_id', leadsTable.id);

      const existing = (existingLeads || []).find((l: any) => {
        const leadPhone = (l.data?.phone || '').replace(/\D/g, '').slice(-9);
        return leadPhone === cleanPhone;
      });

      if (existing) {
        return NextResponse.json({
          success: true,
          lead_id: existing.id,
          already_exists: true,
          message: 'הליד כבר קיים ב-CRM',
        });
      }
    }

    // 5. יוצר ליד חדש
    const notes_parts = [];
    if (escalation.ai_explanation) notes_parts.push(`🤖 ניתוח AI: ${escalation.ai_explanation}`);
    if (escalation.last_message_excerpt) notes_parts.push(`💬 הודעה אחרונה: ${escalation.last_message_excerpt}`);
    if (escalation.reason) notes_parts.push(`📌 סוג: ${escalation.reason}`);

    const leadData: any = {
      title: escalation.title || 'ליד מ-WhatsApp',
      stage: 'contacted', // כבר היה איתו אינטראקציה
      source: 'whatsapp',
      notes: notes_parts.join('\n\n'),
      _source_escalation_id: escalation.id, // לקשור בחזרה
    };

    if (phone) leadData.phone = phone;

    const { data: created, error: insertError } = await admin
      .from('records')
      .insert({
        workspace_id: escalation.workspace_id,
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
      already_exists: false,
      message: 'הליד נוצר בהצלחה',
    });

  } catch (err) {
    console.error('convert-to-lead error:', err);
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'שגיאה' 
    }, { status: 500 });
  }
}
