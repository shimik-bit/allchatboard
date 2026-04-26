import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { GreenApiWebhook } from '@/lib/types/groupguard';
import { runDetectionPipeline } from '@/lib/groupguard/detection-pipeline';
import { executeAction } from '@/lib/groupguard/action-executor';
import { stripWhatsAppSuffix } from '@/lib/groupguard/green-api-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GroupGuard Webhook
 * ===================
 * POST /api/groupguard/webhook
 *
 * נקודת הכניסה לכל הודעה שמגיעה מ-Green API.
 * מבצע:
 *   1. שמירת ההודעה ב-wa_messages
 *   2. בדיקה אם הקבוצה מנוטרת (gg_enabled)
 *   3. הרצת Detection Pipeline (4 רמות)
 *   4. ביצוע Action (אם יש)
 *   5. החזרת 200 (תמיד - שלא יחזרו עליו)
 *
 * GET /api/groupguard/webhook
 *   Health check.
 */

// ============================================================================
// POST handler
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as GreenApiWebhook;

    // אנחנו מטפלים רק בהודעות נכנסות
    if (
      payload.typeWebhook !== 'incomingMessageReceived' &&
      payload.typeWebhook !== 'outgoingMessageReceived'
    ) {
      return NextResponse.json({ ok: true, skipped: 'not a message webhook' });
    }

    const chatId = payload.senderData?.chatId;
    const sender = payload.senderData?.sender;
    if (!chatId || !sender) {
      return NextResponse.json({ ok: true, skipped: 'missing chatId or sender' });
    }

    // אנחנו מטפלים רק בהודעות מקבוצות
    if (!chatId.endsWith('@g.us')) {
      return NextResponse.json({ ok: true, skipped: 'not a group chat' });
    }

    // Admin client - bypasses RLS, needed for webhook
    const supabase = createAdminClient();

    // ----- שלב 1: מצא את הקבוצה ב-DB -----
    const { data: group, error: groupErr } = await supabase
      .from('whatsapp_groups')
      .select(`
        id,
        workspace_id,
        green_api_chat_id,
        group_name,
        classification_hint,
        gg_enabled,
        gg_is_admin,
        gg_detections,
        gg_manual_tag_threshold,
        gg_ai_sensitivity
      `)
      .eq('green_api_chat_id', chatId)
      .maybeSingle();

    if (groupErr || !group) {
      // קבוצה לא רשומה - מתעלמים
      return NextResponse.json({ ok: true, skipped: 'unknown group' });
    }

    // ----- שלב 2: שלוף פרטי workspace (Green API credentials) -----
    const { data: workspace, error: wsErr } = await supabase
      .from('workspaces')
      .select('id, whatsapp_instance_id, whatsapp_token')
      .eq('id', group.workspace_id)
      .single();

    if (wsErr || !workspace) {
      console.error('[GG] webhook: workspace not found', { groupId: group.id });
      return NextResponse.json({ ok: true, skipped: 'workspace not found' });
    }

    // ----- שלב 3: חלץ פרטי ההודעה -----
    const messageInfo = extractMessageInfo(payload);
    const senderPhone = stripWhatsAppSuffix(sender);
    const senderName = payload.senderData?.senderName ?? null;

    // ----- שלב 4: שמור את ההודעה ב-wa_messages -----
    const { data: insertedMsg, error: msgInsertErr } = await supabase
      .from('wa_messages')
      .insert({
        workspace_id: group.workspace_id,
        group_id: group.id,
        green_api_message_id: payload.idMessage,
        sender_phone: senderPhone,
        sender_name: senderName,
        text: messageInfo.text,
        media_url: messageInfo.mediaUrl,
        media_type: messageInfo.mediaType,
        status: 'received',
        direction: 'in',
        quoted_message_id: messageInfo.quotedMessageId,
      })
      .select('id')
      .single();

    if (msgInsertErr || !insertedMsg) {
      console.error('[GG] webhook: failed to insert message', msgInsertErr);
      return NextResponse.json({ ok: true, error: 'insert failed' });
    }

    // ----- שלב 5: אם הקבוצה לא מנוטרת ע"י GG, סיימנו -----
    if (!group.gg_enabled) {
      return NextResponse.json({ ok: true, skipped: 'gg not enabled for group' });
    }

    // ----- שלב 6: הרץ את ה-Detection Pipeline -----
    const decision = await runDetectionPipeline(supabase, {
      workspaceId: group.workspace_id,
      groupId: group.id,
      whatsappGroupId: chatId,
      messageId: insertedMsg.id,
      whatsappMessageId: payload.idMessage ?? '',
      senderPhone,
      senderName,
      messageText: messageInfo.text,
      isQuoted: !!messageInfo.quotedMessageId,
      quotedMessageWaId: messageInfo.quotedMessageId,
      groupName: group.group_name,
      groupContext: group.classification_hint,
      groupSettings: {
        detections: group.gg_detections,
        manual_tag_threshold: group.gg_manual_tag_threshold,
        ai_sensitivity: group.gg_ai_sensitivity,
      },
      botPhone: payload.instanceData.wid,
    });

    // ----- שלב 7: בצע את הפעולה (אם יש) -----
    let actionResult = null;
    if (decision.shouldAct || decision.source === 'manual_report') {
      // עבור manual_report, היעד הוא הספאמר המצוטט
      const targetPhone =
        decision.source === 'manual_report' && decision.details?.reportedPhone
          ? (decision.details.reportedPhone as string)
          : senderPhone;
      const targetMessageId =
        decision.source === 'manual_report' && decision.details?.reportedMessageId
          ? (decision.details.reportedMessageId as string)
          : insertedMsg.id;
      const targetWaMessageId =
        decision.source === 'manual_report' && decision.details?.reportedMessageWaId
          ? (decision.details.reportedMessageWaId as string)
          : payload.idMessage ?? null;

      actionResult = await executeAction(supabase, {
        decision,
        workspaceId: group.workspace_id,
        groupId: group.id,
        whatsappGroupId: chatId,
        messageId: targetMessageId,
        whatsappMessageId: targetWaMessageId,
        targetPhone,
        targetName: senderName,
        greenApi: {
          instanceId: workspace.whatsapp_instance_id ?? '',
          apiToken: workspace.whatsapp_token ?? '',
        },
      });
    }

    return NextResponse.json({
      ok: true,
      decision: {
        shouldAct: decision.shouldAct,
        source: decision.source,
        action: decision.action,
        reason: decision.reason,
      },
      actionResult,
    });
  } catch (err) {
    // אף פעם לא להחזיר 500 - אחרת Green API יחזור שוב ושוב
    console.error('[GG] webhook fatal error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 200 },
    );
  }
}


// ============================================================================
// GET handler - health check
// ============================================================================

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'GroupGuard Webhook',
    version: '1.0.0',
  });
}


// ============================================================================
// Helper: extract message info from various WhatsApp message types
// ============================================================================

function extractMessageInfo(payload: GreenApiWebhook): {
  text: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  quotedMessageId: string | null;
} {
  const md = payload.messageData;
  if (!md) {
    return { text: null, mediaUrl: null, mediaType: null, quotedMessageId: null };
  }

  // Plain text
  if (md.typeMessage === 'textMessage' && md.textMessageData) {
    return {
      text: md.textMessageData.textMessage,
      mediaUrl: null,
      mediaType: null,
      quotedMessageId: null,
    };
  }

  // Extended text (תיוגים, תשובות)
  if (md.typeMessage === 'extendedTextMessage' && md.extendedTextMessageData) {
    return {
      text: md.extendedTextMessageData.text,
      mediaUrl: null,
      mediaType: null,
      quotedMessageId: md.extendedTextMessageData.stanzaId ?? null,
    };
  }

  // Quoted message
  if (md.typeMessage === 'quotedMessage' && md.quotedMessage) {
    return {
      text: md.textMessageData?.textMessage ?? md.quotedMessage.textMessage ?? null,
      mediaUrl: null,
      mediaType: null,
      quotedMessageId: md.quotedMessage.stanzaId ?? null,
    };
  }

  // Media (image/video/document/audio)
  if (
    (md.typeMessage === 'imageMessage' ||
      md.typeMessage === 'videoMessage' ||
      md.typeMessage === 'documentMessage' ||
      md.typeMessage === 'audioMessage') &&
    md.fileMessageData
  ) {
    return {
      text: md.fileMessageData.caption ?? null,
      mediaUrl: md.fileMessageData.downloadUrl,
      mediaType: md.typeMessage.replace('Message', ''),
      quotedMessageId: null,
    };
  }

  return { text: null, mediaUrl: null, mediaType: null, quotedMessageId: null };
}
