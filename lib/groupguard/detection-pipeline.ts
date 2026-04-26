/**
 * Detection Pipeline - GroupGuard
 * ================================
 * הלוגיקה הלבבית של GroupGuard:
 * מקבלת הודעה -> עוברת על 4 רמות זיהוי -> מחזירה החלטה.
 *
 * סדר הבדיקה (חשוב!):
 *   1. Whitelist check       (אם מתאים -> מסיימים מיד, לא נוגעים)
 *   2. Global blocklist      (זול - lookup בDB)
 *   3. Phone prefix          (זול - lookup בDB)
 *   4. Manual report flow    (רק אם זה תיוג של הבוט)
 *   5. AI content analysis   (יקר - אחרון)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  DetectionResult,
  DetectionSource,
  ActionType,
  AiSensitivity,
} from '@/lib/types/groupguard';
import { extractPhonePrefix } from './green-api-client';

// ============================================================================
// Input to the pipeline
// ============================================================================

export interface PipelineInput {
  workspaceId: string;
  groupId: string;                       // UUID של הקבוצה ב-DB
  whatsappGroupId: string;               // chat ID של WhatsApp
  messageId: string;                     // UUID של ההודעה ב-DB
  whatsappMessageId: string;             // stanzaId
  senderPhone: string;                   // ללא suffix
  senderName: string | null;
  messageText: string | null;
  isQuoted: boolean;
  quotedMessageWaId: string | null;      // אם זו הודעת ציטוט - מה ה-stanzaId המצוטט
  // הגדרות הקבוצה (מועברות מבחוץ כדי לא לקרוא ל-DB שוב)
  groupSettings: {
    detections: {
      ai_content: boolean;
      manual_tagging: boolean;
      phone_prefix: boolean;
      global_blocklist: boolean;
    };
    manual_tag_threshold: number;
    ai_sensitivity: AiSensitivity;
  };
  botPhone: string;                      // המספר של הבוט (לזיהוי תיוג)
}


// ============================================================================
// LAYER 0 - Whitelist check
// ============================================================================
// אם המשתמש ב-whitelist - לא לעשות כלום, לא חשוב מה.
// מחזיר true אם השולח מוגן.

export async function isProtectedByWhitelist(
  supabase: SupabaseClient,
  workspaceId: string,
  groupId: string,
  senderPhone: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc('gg_is_whitelisted', {
    p_workspace_id: workspaceId,
    p_group_id: groupId,
    p_phone: senderPhone,
  });

  if (error) {
    console.error('[GG] whitelist check failed:', error);
    return false; // fail-open: אם הבדיקה נכשלת, נמשיך לבדיקות הבאות
  }

  return data === true;
}


// ============================================================================
// LAYER 1 - Global blocklist check
// ============================================================================
// אם המספר נמצא במאגר global ו-confirmed - kick מיידי.

async function checkGlobalBlocklist(
  supabase: SupabaseClient,
  senderPhone: string,
): Promise<DetectionResult | null> {
  const { data, error } = await supabase
    .from('gg_global_blocklist')
    .select('phone, is_confirmed, report_count, reason_summary')
    .eq('phone', senderPhone)
    .eq('is_confirmed', true)
    .maybeSingle();

  if (error) {
    console.error('[GG] blocklist check failed:', error);
    return null;
  }

  if (!data) return null;

  return {
    shouldAct: true,
    source: 'global_blocklist',
    action: 'kick',
    reason: `Phone in global blocklist (${data.report_count} reports)`,
    details: { reasonSummary: data.reason_summary },
  };
}


// ============================================================================
// LAYER 2 - Phone prefix check
// ============================================================================
// אם הקידומת חסומה - הפעולה לפי הכלל.

async function checkPhonePrefix(
  supabase: SupabaseClient,
  workspaceId: string,
  senderPhone: string,
): Promise<DetectionResult | null> {
  const prefix = extractPhonePrefix(senderPhone);

  // נבדוק כמה גרסאות של הקידומת (1, 2, 3 ספרות)
  // כי לא תמיד יודעים כמה ספרות יש בקידומת
  const candidates = [
    senderPhone.substring(0, 1),
    senderPhone.substring(0, 2),
    senderPhone.substring(0, 3),
  ];

  const { data, error } = await supabase
    .from('gg_phone_prefix_rules')
    .select('prefix, action, country_name')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .in('prefix', candidates)
    .order('prefix', { ascending: false }); // ארוך יותר = ספציפי יותר

  if (error) {
    console.error('[GG] prefix check failed:', error);
    return null;
  }

  if (!data || data.length === 0) return null;

  // בחר את הקידומת הארוכה ביותר שמתאימה
  const matchedRule = data[0];

  return {
    shouldAct: true,
    source: 'phone_prefix',
    action: matchedRule.action as ActionType,
    reason: `Phone prefix +${matchedRule.prefix} blocked (${matchedRule.country_name ?? 'unknown'})`,
    details: { matchedPrefix: matchedRule.prefix, prefix },
  };
}


// ============================================================================
// LAYER 3 - Manual report flow
// ============================================================================
// אם ההודעה הנוכחית היא תיוג של הבוט בתשובה להודעה אחרת,
// זה manual report.

export interface ManualReportContext {
  isReport: boolean;
  reportedMessageWaId?: string;          // ה-stanzaId המצוטט
  reporterPhone: string;
  reporterName: string | null;
}


/**
 * זיהוי האם הודעה היא תיוג של הבוט.
 * תנאים:
 *  - יש @mention של מספר הבוט בטקסט
 *  - ההודעה היא תשובה (יש quoted message)
 */
export function detectManualReport(
  messageText: string | null,
  isQuoted: boolean,
  quotedMessageWaId: string | null,
  botPhone: string,
  senderPhone: string,
  senderName: string | null,
): ManualReportContext {
  if (!messageText || !isQuoted || !quotedMessageWaId) {
    return { isReport: false, reporterPhone: senderPhone, reporterName: senderName };
  }

  // האם יש תיוג של הבוט בהודעה?
  // WhatsApp mentions הם בפורמט @972XXX
  const botPhoneClean = botPhone.replace(/^\+/, '').replace(/@.+$/, '');
  const mentionRegex = new RegExp(`@${botPhoneClean}\\b`, 'i');

  if (!mentionRegex.test(messageText)) {
    return { isReport: false, reporterPhone: senderPhone, reporterName: senderName };
  }

  return {
    isReport: true,
    reportedMessageWaId: quotedMessageWaId,
    reporterPhone: senderPhone,
    reporterName: senderName,
  };
}


/**
 * רישום manual report וקבלת החלטה.
 * אם הגענו ל-threshold -> kick.
 * אחרת -> רק לוג.
 */
export async function processManualReport(
  supabase: SupabaseClient,
  params: {
    workspaceId: string;
    groupId: string;
    reportedMessageWaId: string;        // stanzaId המצוטט
    reportedMessageWaGroupId: string;   // chat ID של הקבוצה
    reporterPhone: string;
    reporterName: string | null;
    threshold: number;
  },
): Promise<DetectionResult | null> {
  // צעד 1: למצוא את ההודעה המצוטטת ב-wa_messages
  const { data: reportedMsg, error: msgErr } = await supabase
    .from('wa_messages')
    .select('id, sender_phone, sender_name')
    .eq('green_api_message_id', params.reportedMessageWaId)
    .eq('workspace_id', params.workspaceId)
    .maybeSingle();

  if (msgErr || !reportedMsg) {
    console.warn('[GG] manual report: cannot find reported message', {
      waId: params.reportedMessageWaId,
      err: msgErr,
    });
    return null;
  }

  // לא ניתן לדווח על עצמך
  if (reportedMsg.sender_phone === params.reporterPhone) {
    return {
      shouldAct: false,
      source: 'manual_report',
      action: null,
      reason: 'Self-report ignored',
    };
  }

  // צעד 2: רישום ה-report (UNIQUE constraint מונע כפילות)
  const { error: reportErr } = await supabase
    .from('gg_manual_reports')
    .insert({
      workspace_id: params.workspaceId,
      group_id: params.groupId,
      reported_message_id: reportedMsg.id,
      reporter_phone: params.reporterPhone,
      reporter_name: params.reporterName,
      reported_phone: reportedMsg.sender_phone,
    });

  // אם זה duplicate (UNIQUE violation), עדיין נמשיך לספור
  if (reportErr && !reportErr.message.includes('unique_report_per_user')) {
    console.error('[GG] failed to insert manual report:', reportErr);
    return null;
  }

  // צעד 3: ספירה - כמה דיווחים יש להודעה
  const { data: countData } = await supabase.rpc('gg_count_message_reports', {
    p_message_id: reportedMsg.id,
  });

  const reportCount = (countData as number) ?? 0;

  if (reportCount < params.threshold) {
    return {
      shouldAct: false,
      source: 'manual_report',
      action: null,
      reason: `Manual report logged (${reportCount}/${params.threshold})`,
      details: { reportCount, threshold: params.threshold },
    };
  }

  // הגענו ל-threshold!
  return {
    shouldAct: true,
    source: 'manual_report',
    action: 'kick',
    reason: `Manual report threshold reached (${reportCount}/${params.threshold})`,
    details: {
      reportCount,
      threshold: params.threshold,
      reportedPhone: reportedMsg.sender_phone,
      reportedMessageId: reportedMsg.id,
      reportedMessageWaId: params.reportedMessageWaId,
    },
  };
}


// ============================================================================
// LAYER 4 - AI content classification (placeholder for Phase 4)
// ============================================================================
// בפאזה 4 נחבר לפונקציית Edge gg-classify.
// כאן רק פלייסהולדר.

async function checkAiContent(
  _supabase: SupabaseClient,
  _messageText: string,
  _sensitivity: AiSensitivity,
): Promise<DetectionResult | null> {
  // TODO Phase 4: קריאה ל-Edge Function gg-classify
  return null;
}


// ============================================================================
// MAIN PIPELINE - מחבר את הכל
// ============================================================================

/**
 * מריץ את כל ה-detection pipeline על הודעה אחת.
 * מחזיר את ה-DetectionResult הראשון שדורש פעולה,
 * או null אם הכל נקי.
 */
export async function runDetectionPipeline(
  supabase: SupabaseClient,
  input: PipelineInput,
): Promise<DetectionResult> {
  const { groupSettings } = input;
  const detections = groupSettings.detections;

  // ---- LAYER 0: Whitelist (always runs) ----
  const isProtected = await isProtectedByWhitelist(
    supabase,
    input.workspaceId,
    input.groupId,
    input.senderPhone,
  );
  if (isProtected) {
    return {
      shouldAct: false,
      source: null,
      action: 'whitelist_skip',
      reason: 'Sender is whitelisted',
    };
  }

  // ---- LAYER 1: Global blocklist ----
  if (detections.global_blocklist) {
    const result = await checkGlobalBlocklist(supabase, input.senderPhone);
    if (result?.shouldAct) return result;
  }

  // ---- LAYER 2: Phone prefix ----
  if (detections.phone_prefix) {
    const result = await checkPhonePrefix(supabase, input.workspaceId, input.senderPhone);
    if (result?.shouldAct) return result;
  }

  // ---- LAYER 3: Manual report flow ----
  if (detections.manual_tagging) {
    const reportContext = detectManualReport(
      input.messageText,
      input.isQuoted,
      input.quotedMessageWaId,
      input.botPhone,
      input.senderPhone,
      input.senderName,
    );

    if (reportContext.isReport && reportContext.reportedMessageWaId) {
      const result = await processManualReport(supabase, {
        workspaceId: input.workspaceId,
        groupId: input.groupId,
        reportedMessageWaId: reportContext.reportedMessageWaId,
        reportedMessageWaGroupId: input.whatsappGroupId,
        reporterPhone: reportContext.reporterPhone,
        reporterName: reportContext.reporterName,
        threshold: groupSettings.manual_tag_threshold,
      });
      if (result?.shouldAct) return result;
      // אם זה היה manual report (גם אם לא הגיע ל-threshold), אנחנו מסיימים פה.
      // ההודעה עצמה היא תיוג, לא ספאם.
      if (reportContext.isReport) {
        return result ?? {
          shouldAct: false,
          source: 'manual_report',
          action: null,
          reason: 'Manual report processed without action',
        };
      }
    }
  }

  // ---- LAYER 4: AI content (Phase 4 - לא פעיל עדיין) ----
  if (detections.ai_content && input.messageText) {
    const result = await checkAiContent(
      supabase,
      input.messageText,
      groupSettings.ai_sensitivity,
    );
    if (result?.shouldAct) return result;
  }

  // ---- כל הבדיקות עברו - הודעה נקייה ----
  return {
    shouldAct: false,
    source: null,
    action: null,
    reason: 'No spam detected',
  };
}
