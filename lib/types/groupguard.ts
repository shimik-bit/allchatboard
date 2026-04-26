/**
 * GroupGuard - TypeScript Types
 * ==============================
 * הטיפוסים מתאימים לסכמה ב-Supabase.
 * אם משנים את הסכמה, צריך לעדכן גם כאן.
 */

// ============================================================================
// Detection layers - 4 רמות הזיהוי
// ============================================================================

export type DetectionSource =
  | 'ai_content'        // זיהוי AI
  | 'manual_report'     // תיוג ידני של חברי הקבוצה
  | 'phone_prefix'      // קידומת חסומה
  | 'global_blocklist'; // מאגר גלובלי

export type ActionType =
  | 'warn'              // אזהרה (תגובה בקבוצה)
  | 'delete_message'    // מחיקת הודעה בלבד
  | 'kick'              // הוצאה מהקבוצה (כולל מחיקה)
  | 'blocklist_add'     // הוספה למאגר גלובלי
  | 'whitelist_skip';   // לא בוצעה פעולה כי המשתמש ב-whitelist

export type AiRiskLevel = 'none' | 'low' | 'medium' | 'high';

export type AiSensitivity = 'low' | 'medium' | 'high';


// ============================================================================
// Group config - הגדרות per-group של GroupGuard
// ============================================================================

export interface GroupGuardSettings {
  gg_enabled: boolean;
  gg_is_admin: boolean;                  // האם המספר שלנו אדמין בקבוצה
  gg_detections: {
    ai_content: boolean;
    manual_tagging: boolean;
    phone_prefix: boolean;
    global_blocklist: boolean;
  };
  gg_manual_tag_threshold: number;       // 3 by default
  gg_ai_sensitivity: AiSensitivity;
  gg_participants_count: number;
  gg_enabled_at: string | null;          // ISO timestamp
}


// ============================================================================
// Message metadata - מה ה-Detection מוסיף ל-wa_messages
// ============================================================================

export interface MessageGuardData {
  gg_was_flagged: boolean;
  gg_was_deleted: boolean;
  gg_flag_reason: DetectionSource | null;
  gg_ai_score: number | null;            // 0.00 - 1.00
  gg_ai_categories: AiClassification | null;
  gg_ai_risk: AiRiskLevel | null;
}

export interface AiClassification {
  is_spam: boolean;
  risk: AiRiskLevel;
  categories: string[];                  // ['ad', 'scam', 'phishing', ...]
  confidence: number;
  explanation: string;                   // קצר בעברית
}


// ============================================================================
// Green API Webhook Payload (incoming messages)
// ============================================================================
// מסמכי Green API: https://green-api.com/en/docs/api/receiving/notifications-format/

export type GreenApiWebhookType =
  | 'incomingMessageReceived'
  | 'outgoingMessageReceived'
  | 'outgoingAPIMessageReceived'
  | 'outgoingMessageStatus'
  | 'stateInstanceChanged'
  | 'deviceInfo';

export interface GreenApiWebhook {
  typeWebhook: GreenApiWebhookType;
  instanceData: {
    idInstance: number;
    wid: string;                         // המספר שלנו
    typeInstance: string;
  };
  timestamp: number;
  idMessage?: string;
  senderData?: {
    chatId: string;                      // "120363xxx@g.us" (group) או "972xxx@c.us" (private)
    chatName?: string;
    sender: string;                      // "972xxx@c.us"
    senderName?: string;
  };
  messageData?: {
    typeMessage:
      | 'textMessage'
      | 'extendedTextMessage'
      | 'imageMessage'
      | 'videoMessage'
      | 'documentMessage'
      | 'audioMessage'
      | 'pollMessage'
      | 'quotedMessage';
    textMessageData?: {
      textMessage: string;
    };
    extendedTextMessageData?: {
      text: string;
      stanzaId?: string;                 // ID של ההודעה המצוטטת
      participant?: string;              // השולח של ההודעה המצוטטת
    };
    quotedMessage?: {
      stanzaId: string;
      participant: string;
      typeMessage: string;
      textMessage?: string;
    };
    fileMessageData?: {
      downloadUrl: string;
      caption?: string;
      fileName?: string;
      mimeType?: string;
    };
  };
}


// ============================================================================
// Detection Pipeline result
// ============================================================================

export interface DetectionResult {
  shouldAct: boolean;
  source: DetectionSource | null;
  action: ActionType | null;
  reason: string;
  details?: Record<string, unknown>;
}


// ============================================================================
// Action result (after running Green API call)
// ============================================================================

export interface ActionResult {
  success: boolean;
  action: ActionType;
  targetPhone: string;
  error?: string;
  greenApiResponse?: unknown;
}
