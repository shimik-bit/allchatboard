import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Update a record + optionally notify the original WhatsApp sender.
 *
 * POST /api/records/[id]/update
 * Body: { data?: {...}, notes?: string, notify?: boolean, notifyMessage?: string }
 *
 * If `notify=true` and the record was created via WhatsApp,
 * we'll send a reply to the original sender quoting their original message.
 */
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
  const { data: dataPatch, notes, assignee_phone_id, notify, notifyMessage } = body;

  // Get the record (RLS-protected — user must be a workspace member)
  const { data: record, error: recordError } = await supabase
    .from('records')
    .select('id, workspace_id, table_id, data, source_chat_id, source_message_green_id, tables(name)')
    .eq('id', params.id)
    .single();

  if (recordError || !record) {
    return NextResponse.json({ error: 'record not found' }, { status: 404 });
  }

  // Build update
  const updatePayload: any = {
    updated_at: new Date().toISOString(),
    last_updated_by: user.id,
  };
  if (dataPatch) {
    updatePayload.data = { ...(record.data || {}), ...dataPatch };
  }
  if (notes !== undefined) {
    updatePayload.notes = notes || null;
  }
  if (assignee_phone_id !== undefined) {
    updatePayload.assignee_phone_id = assignee_phone_id;
  }

  const { error: updateError } = await supabase
    .from('records')
    .update(updatePayload)
    .eq('id', params.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Optionally notify original WhatsApp sender
  let notifyResult: any = null;
  if (notify && record.source_chat_id) {
    notifyResult = await sendNotification({
      workspaceId: record.workspace_id,
      chatId: record.source_chat_id,
      quotedMessageId: record.source_message_green_id || null,
      message: notifyMessage || buildAutoMessage(dataPatch, record),
    });
  }

  return NextResponse.json({ ok: true, notify: notifyResult });
}

function buildAutoMessage(dataPatch: any, record: any): string {
  const tableName = record.tables?.name || 'הרשומה';
  if (!dataPatch) return `📋 ${tableName} — עודכנה במערכת`;

  // If status was updated, mention it
  if (dataPatch.status || dataPatch.סטטוס) {
    return `✅ עודכן: ${tableName} — סטטוס שונה ל-"${dataPatch.status || dataPatch.סטטוס}"`;
  }

  const fields = Object.entries(dataPatch).slice(0, 3)
    .map(([k, v]) => `${k}: ${v}`).join(', ');
  return `📋 ${tableName} — עודכן: ${fields}`;
}

async function sendNotification(opts: {
  workspaceId: string;
  chatId: string;
  quotedMessageId: string | null;
  message: string;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const admin = createAdminClient();

  // Get Green API credentials
  const { data: workspace } = await admin
    .from('workspaces')
    .select('whatsapp_instance_id, whatsapp_token')
    .eq('id', opts.workspaceId)
    .single();

  if (!workspace?.whatsapp_instance_id || !workspace?.whatsapp_token) {
    return { success: false, error: 'WhatsApp not configured' };
  }

  try {
    const url = `https://api.green-api.com/waInstance${workspace.whatsapp_instance_id}/sendMessage/${workspace.whatsapp_token}`;
    const payload: any = { chatId: opts.chatId, message: opts.message };
    if (opts.quotedMessageId) payload.quotedMessageId = opts.quotedMessageId;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Green API ${res.status}: ${errText.slice(0, 200)}` };
    }

    const data = await res.json();
    const sentId = data.idMessage;

    // Log it as outgoing message
    await admin.from('wa_messages').insert({
      workspace_id: opts.workspaceId,
      green_api_message_id: sentId,
      sent_message_id: sentId,
      quoted_message_id: opts.quotedMessageId,
      text: opts.message,
      status: 'inserted',
      direction: 'out',
      processed_at: new Date().toISOString(),
    });

    return { success: true, messageId: sentId };
  } catch (e: any) {
    return { success: false, error: e?.message };
  }
}
