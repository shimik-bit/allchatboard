// app/api/inbox/find-escalation/route.ts
// GET ?phone=...
// מחזיר את ה-escalation האחרון של הטלפון הזה

import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const wsId = cookies().get('tf_active_workspace')?.value;
    if (!wsId) {
      return NextResponse.json({ error: 'No active workspace' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    if (!phone) {
      return NextResponse.json({ error: 'phone is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    
    const { data: escalation } = await admin
      .from('escalations')
      .select('id')
      .eq('workspace_id', wsId)
      .eq('source_phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!escalation) {
      return NextResponse.json({ error: 'No escalation found for this phone' }, { status: 404 });
    }

    return NextResponse.json({ escalation_id: escalation.id });
  } catch (err) {
    return NextResponse.json({ 
      error: err instanceof Error ? err.message : 'Error' 
    }, { status: 500 });
  }
}
