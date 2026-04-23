import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/records/[id]/notify-assignee
 *
 * Manually send a WhatsApp notification to the record's currently-assigned
 * person. Useful for:
 *   - records created before assignee_rules existed
 *   - records where the rule didn't fire (no category match) but the user
 *     wants the assignee to know anyway
 *   - re-sending a notification if the original failed
 *
 * Auth: standard Supabase session — only workspace members can trigger.
 * RLS on the records select handles access control.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 1 — Auth check via the session-aware client
  const userClient = createServerClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 2 — Load the record and its assignee. RLS ensures the user can only
  // see records in their workspace.
  const { data: record, error: recordErr } = await userClient
    .from('records')
    .select(`
      id, table_id, workspace_id, data,
      assignee_phone_id, assignee_raw_phone, assignee_raw_name,
      authorized_phones:assignee_phone_id ( phone, display_name ),
      tables ( name )
    `)
    .eq('id', params.id)
    .maybeSingle();

  if (recordErr || !record) {
    return NextResponse.json({ error: 'record_not_found' }, { status: 404 });
  }

  // 3 — Resolve assignee phone + name (joined data may be array or object)
  const ap = Array.isArray(record.authorized_phones)
    ? record.authorized_phones[0]
    : record.authorized_phones;
  const phone: string | null = ap?.phone || record.assignee_raw_phone;
  const name: string = ap?.display_name || record.assignee_raw_name || 'נציג';

  if (!phone) {
    return NextResponse.json(
      { error: 'no_assignee', message: 'אין נציג מטפל מוגדר ברשומה' },
      { status: 400 }
    );
  }

  // 4 — Need the workspace's WhatsApp credentials. Use admin client to
  // bypass RLS — we already verified the user is a member above.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: workspace } = await admin
    .from('workspaces')
    .select('whatsapp_instance_id, whatsapp_token')
    .eq('id', record.workspace_id)
    .maybeSingle();

  if (!workspace?.whatsapp_instance_id || !workspace?.whatsapp_token) {
    return NextResponse.json(
      { error: 'no_whatsapp', message: 'WhatsApp לא מחובר ל-workspace' },
      { status: 400 }
    );
  }

  // 5 — Build & send the message. Reuse the same format as the auto
  // notification sent by the webhook for visual consistency.
  const tableName = (Array.isArray(record.tables) ? record.tables[0]?.name : (record.tables as any)?.name) || 'רשומה';
  const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://allchatboard.vercel.app';

  const lines: string[] = [];
  lines.push(`היי ${name} 👋`);
  lines.push(`קיבלת ${tableName} לטיפול:`);
  lines.push('');

  const SKIP = new Set(['id', 'created_at', 'updated_at']);
  const entries = Object.entries(record.data as Record<string, any>)
    .filter(([k, v]) => !SKIP.has(k) && v !== null && v !== undefined && v !== '')
    .slice(0, 5);
  for (const [key, value] of entries) {
    const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
    lines.push(`• ${key}: ${displayValue}`);
  }

  lines.push('');
  lines.push(`👁 לצפייה ועדכון: ${dashboardUrl}/r/${record.id}`);
  const text = lines.join('\n');

  // 6 — Normalize phone to chatId
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '972' + digits.slice(1);
  if (digits.startsWith('00')) digits = digits.slice(2);
  const chatId = `${digits}@c.us`;

  // 7 — Send via Green API
  try {
    const url = `https://api.green-api.com/waInstance${workspace.whatsapp_instance_id}/sendMessage/${workspace.whatsapp_token}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId, message: text }),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: 'send_failed', detail: body },
        { status: 502 }
      );
    }

    // 8 — Mark notified + return success
    const notifiedAt = new Date().toISOString();
    await admin.from('records')
      .update({ assignee_notified_at: notifiedAt })
      .eq('id', record.id);

    return NextResponse.json({ ok: true, notifiedAt, assigneeName: name });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'send_exception', message: e?.message || 'unknown' },
      { status: 500 }
    );
  }
}
