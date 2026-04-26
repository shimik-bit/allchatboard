/**
 * Action Executor - GroupGuard
 * =============================
 * מקבל החלטה מה-Detection Pipeline ומבצע אותה:
 *  - delete_message  -> מחיקת הודעה
 *  - kick            -> מחיקת הודעה + הוצאה מהקבוצה + הוספה ל-blocklist
 *  - warn            -> שליחת הודעת אזהרה
 *  - whitelist_skip  -> רק לוג, אין פעולה
 *
 * כל פעולה נרשמת ב-gg_actions_log.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ActionType,
  ActionResult,
  DetectionResult,
  DetectionSource,
} from '@/lib/types/groupguard';
import {
  deleteMessage,
  removeGroupParticipant,
  sendMessage,
  stripWhatsAppSuffix,
} from './green-api-client';


// ============================================================================
// Input
// ============================================================================

export interface ExecuteParams {
  decision: DetectionResult;
  workspaceId: string;
  groupId: string;                       // UUID
  whatsappGroupId: string;               // chat ID
  messageId: string | null;              // UUID of wa_messages row (אם רלוונטי)
  whatsappMessageId: string | null;      // stanzaId
  targetPhone: string;                   // ללא suffix
  targetName: string | null;
  greenApi: {
    instanceId: string;
    apiToken: string;
  };
}


// ============================================================================
// Main
// ============================================================================

export async function executeAction(
  supabase: SupabaseClient,
  params: ExecuteParams,
): Promise<ActionResult> {
  const { decision } = params;

  // אין פעולה לבצע
  if (!decision.shouldAct || !decision.action) {
    // עדיין נרשום ב-log (חוץ ממקרים של "no spam detected")
    if (decision.source) {
      await logAction(supabase, {
        ...params,
        actionType: decision.action ?? 'whitelist_skip',
        source: decision.source,
        successful: true,
        triggerDetails: decision.details ?? null,
        reason: decision.reason,
      });
    }
    return {
      success: true,
      action: decision.action ?? 'whitelist_skip',
      targetPhone: params.targetPhone,
    };
  }

  // יש פעולה לבצע
  let actionResult: ActionResult;
  switch (decision.action) {
    case 'delete_message':
      actionResult = await doDeleteMessage(params);
      break;
    case 'kick':
      actionResult = await doKickAndDelete(supabase, params);
      break;
    case 'warn':
      actionResult = await doWarn(params, decision.reason);
      break;
    default:
      actionResult = {
        success: false,
        action: decision.action,
        targetPhone: params.targetPhone,
        error: `Unsupported action: ${decision.action}`,
      };
  }

  // לוג של הפעולה
  await logAction(supabase, {
    ...params,
    actionType: decision.action,
    source: decision.source!,
    successful: actionResult.success,
    error: actionResult.error,
    triggerDetails: decision.details ?? null,
    reason: decision.reason,
  });

  // עדכון gg_was_deleted ב-wa_messages אם רלוונטי
  if (actionResult.success && params.messageId &&
      (decision.action === 'kick' || decision.action === 'delete_message')) {
    await supabase
      .from('wa_messages')
      .update({
        gg_was_flagged: true,
        gg_was_deleted: true,
        gg_flag_reason: decision.source,
      })
      .eq('id', params.messageId);
  }

  return actionResult;
}


// ============================================================================
// Action handlers
// ============================================================================

async function doDeleteMessage(params: ExecuteParams): Promise<ActionResult> {
  if (!params.whatsappMessageId) {
    return {
      success: false,
      action: 'delete_message',
      targetPhone: params.targetPhone,
      error: 'No WhatsApp message ID to delete',
    };
  }

  const result = await deleteMessage(
    params.greenApi,
    params.whatsappGroupId,
    params.whatsappMessageId,
  );

  return {
    success: result.ok,
    action: 'delete_message',
    targetPhone: params.targetPhone,
    error: result.error,
    greenApiResponse: result.data,
  };
}


async function doKickAndDelete(
  supabase: SupabaseClient,
  params: ExecuteParams,
): Promise<ActionResult> {
  // צעד 1: מחיקת ההודעה (אם יש)
  if (params.whatsappMessageId) {
    await deleteMessage(
      params.greenApi,
      params.whatsappGroupId,
      params.whatsappMessageId,
    );
    // לא נכשלים אם המחיקה לא הצליחה - העיקר זה ה-kick
  }

  // צעד 2: הוצאה מהקבוצה
  const kickResult = await removeGroupParticipant(
    params.greenApi,
    params.whatsappGroupId,
    params.targetPhone,
  );

  if (!kickResult.ok) {
    return {
      success: false,
      action: 'kick',
      targetPhone: params.targetPhone,
      error: kickResult.error,
      greenApiResponse: kickResult.data,
    };
  }

  // צעד 3: הוספה למאגר global
  const phoneClean = stripWhatsAppSuffix(params.targetPhone);
  await supabase.rpc('gg_blocklist_upsert', {
    p_phone: phoneClean,
    p_workspace_id: params.workspaceId,
    p_group_id: params.groupId,
    p_reason: params.decision.source ?? 'unknown',
  });

  return {
    success: true,
    action: 'kick',
    targetPhone: params.targetPhone,
    greenApiResponse: kickResult.data,
  };
}


async function doWarn(
  params: ExecuteParams,
  reason: string,
): Promise<ActionResult> {
  const warningText = `⚠️ אזהרה: ההודעה זוהתה כספאם.\nסיבה: ${reason}`;

  const result = await sendMessage(
    params.greenApi,
    params.whatsappGroupId,
    warningText,
    params.whatsappMessageId ?? undefined,
  );

  return {
    success: result.ok,
    action: 'warn',
    targetPhone: params.targetPhone,
    error: result.error,
    greenApiResponse: result.data,
  };
}


// ============================================================================
// Logging
// ============================================================================

interface LogParams {
  workspaceId: string;
  groupId: string;
  messageId: string | null;
  targetPhone: string;
  targetName: string | null;
  actionType: ActionType;
  source: DetectionSource;
  successful: boolean;
  error?: string;
  triggerDetails: Record<string, unknown> | null;
  reason: string;
}

async function logAction(
  supabase: SupabaseClient,
  params: LogParams,
): Promise<void> {
  const { error } = await supabase.from('gg_actions_log').insert({
    workspace_id: params.workspaceId,
    group_id: params.groupId,
    message_id: params.messageId,
    target_phone: stripWhatsAppSuffix(params.targetPhone),
    target_name: params.targetName,
    action_type: params.actionType,
    trigger_source: params.source,
    trigger_details: {
      ...(params.triggerDetails ?? {}),
      reason: params.reason,
    },
    was_successful: params.successful,
    error_message: params.error ?? null,
  });

  if (error) {
    console.error('[GG] failed to log action:', error);
  }
}
