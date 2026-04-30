/**
 * POST /api/escalations/[id]/reply
 *
 * Sends a WhatsApp reply to the escalation's source phone via Green API,
 * then logs the outbound message to wa_messages so it appears in the
 * thread on next refresh.
 *
 * Body: { text: string }
 *
 * Side effect: also moves the escalation to status='in_progress' if it's
 * still 'open' AND auto-assigns it to the replying user. Rationale: if
 * you replied, you've taken the escalation. No need to click "קבל לטיפול"
 * separately.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getInstanceBaseUrl } from '@/lib/instances/green-api-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const text = String(body?.text || '').trim();
  if (!text) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  // Load escalation + workspace WhatsApp credentials. Need both to send.
  const { data: esc, error: escErr } = await supabase
    .from('escalations')
    .select('id, workspace_id, source_phone, status')
    .eq('id', params.id)
    .single();

  if (escErr || !esc) {
    return NextResponse.json({ error: 'escalation not found' }, { status: 404 });
  }

  if (!esc.source_phone) {
    return NextResponse.json(
      { error: 'this escalation has no source phone — cannot reply' },
      { status: 400 }
    );
  }

  const { data: ws } = await supabase
    .from('workspaces')
    .select('whatsapp_instance_id, whatsapp_token')
    .eq('id', esc.workspace_id)
    .single();

  if (!ws?.whatsapp_instance_id || !ws?.whatsapp_token) {
    return NextResponse.json(
      { error: 'workspace has no WhatsApp instance configured' },
      { status: 400 }
    );
  }

  // Build chatId. Green API expects "{phone-without-+}@c.us" format.
  // Strip leading + and any non-digits.
  const chatId = esc.source_phone.replace(/^\+/, '').replace(/\D/g, '') + '@c.us';

  // Send via Green API
  const url = `${getInstanceBaseUrl(ws.whatsapp_instance_id)}/waInstance${ws.whatsapp_instance_id}/sendMessage/${ws.whatsapp_token}`;
  let sentMessageId: string | null = null;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        message: text,
        linkPreview: false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json(
        { error: `Green API rejected: HTTP ${res.status}: ${errText}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    sentMessageId = data?.idMessage || null;
  } catch (e: any) {
    return NextResponse.json(
      { error: `network error: ${e?.message || 'unknown'}` },
      { status: 502 }
    );
  }

  // Log the outbound message to wa_messages so it appears in the thread.
  // We use admin client because RLS on wa_messages may not allow the
  // current user to insert directly (it usually only allows the webhook
  // service role).
  const admin = createAdminClient();
  await admin.from('wa_messages').insert({
    workspace_id: esc.workspace_id,
    sender_phone: esc.source_phone, // recipient, since direction='out'
    text,
    direction: 'out',
    status: 'sent',
    received_at: new Date().toISOString(),
    sent_message_id: sentMessageId,
  });

  // Auto-take the escalation if still open. Mirrors the "if you replied,
  // you've taken it" UX. If it's already in_progress (someone took it
  // earlier), or resolved/dismissed, we leave the status alone.
  if (esc.status === 'open') {
    await supabase
      .from('escalations')
      .update({
        status: 'in_progress',
        assigned_to_user_id: user.id,
        assigned_at: new Date().toISOString(),
        last_message_excerpt: text.slice(0, 200),
      })
      .eq('id', params.id);
  } else {
    // Just refresh the excerpt
    await supabase
      .from('escalations')
      .update({ last_message_excerpt: text.slice(0, 200) })
      .eq('id', params.id);
  }

  return NextResponse.json({ ok: true, sent_message_id: sentMessageId });
}
