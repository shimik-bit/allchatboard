// app/api/inbox/export/route.ts
// GET - מייצא את כל ה-escalations של ה-workspace ל-CSV
// מחזיר Blob עם BOM כדי שעברית תיפתח נכון ב-Excel

import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

const REASON_LABELS_HE: Record<string, string> = {
  customer_request: 'בקשת לקוח',
  ai_uncertain: 'AI לא בטוח',
  complaint: 'תלונה',
  payment: 'תשלום',
  technical: 'טכני',
  human_handoff: 'העברה לאדם',
  bot_failed: 'בוט נכשל',
  other: 'אחר',
};

const STATUS_LABELS_HE: Record<string, string> = {
  open: 'פתוח',
  in_progress: 'בטיפול',
  resolved: 'טופל',
  dismissed: 'נדחה',
};

const PRIORITY_LABELS_HE: Record<string, string> = {
  urgent: 'דחוף',
  normal: 'רגיל',
  low: 'נמוך',
};

// בורח ערכים ל-CSV - מטפל בפסיקים, גרשיים, ושורות חדשות
function csvEscape(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function fmtDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '';
  const s = Number(seconds);
  if (s < 60) return `${Math.round(s)} שניות`;
  if (s < 3600) return `${Math.round(s / 60)} דקות`;
  if (s < 86400) {
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return m > 0 ? `${h}:${String(m).padStart(2, '0')} שעות` : `${h} שעות`;
  }
  return `${Math.round(s / 86400)} ימים`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    }

    const wsId = cookies().get('tf_active_workspace')?.value;
    if (!wsId) {
      return NextResponse.json({ error: 'אין workspace פעיל' }, { status: 400 });
    }

    // אימות חברות ב-workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_id', wsId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
    }

    // שליפת כל ה-escalations
    const admin = createAdminClient();
    const { data: escalations, error } = await admin
      .from('escalations')
      .select('*')
      .eq('workspace_id', wsId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // בניית CSV
    const headers = [
      'תאריך יצירה',
      'כותרת',
      'טלפון',
      'סוג',
      'עדיפות',
      'סטטוס',
      'הוקצה ב-',
      'נפתר ב-',
      'זמן תגובה',
      'זמן פתרון',
      'סיכום טיפול',
      'הסבר AI',
      'הודעה אחרונה',
    ];

    const rows = (escalations || []).map((e: any) => {
      const responseSeconds = e.assigned_at && e.created_at
        ? (new Date(e.assigned_at).getTime() - new Date(e.created_at).getTime()) / 1000
        : null;
      const resolutionSeconds = e.resolved_at && e.created_at
        ? (new Date(e.resolved_at).getTime() - new Date(e.created_at).getTime()) / 1000
        : null;

      return [
        fmtDate(e.created_at),
        e.title || '',
        e.source_phone || '',
        REASON_LABELS_HE[e.reason] || e.reason || '',
        PRIORITY_LABELS_HE[e.priority] || e.priority || '',
        STATUS_LABELS_HE[e.status] || e.status || '',
        fmtDate(e.assigned_at),
        fmtDate(e.resolved_at),
        fmtDuration(responseSeconds),
        fmtDuration(resolutionSeconds),
        e.resolution_note || '',
        e.ai_explanation || '',
        e.last_message_excerpt || '',
      ];
    });

    // BOM (UTF-8) כדי שExcel יזהה עברית נכון
    const BOM = '\uFEFF';
    const csv = BOM + [
      headers.map(csvEscape).join(','),
      ...rows.map((row: any[]) => row.map(csvEscape).join(',')),
    ].join('\r\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="inbox-export-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });

  } catch (err) {
    console.error('inbox export error:', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'שגיאה',
    }, { status: 500 });
  }
}
