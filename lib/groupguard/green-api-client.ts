/**
 * Green API Client - GroupGuard
 * ==============================
 * עוטף את הקריאות ל-Green API לפעולות שהבוט עושה:
 * - מחיקת הודעה
 * - הוצאת משתמש מקבוצה
 * - שליחת תגובת אזהרה
 * - שליפת מידע על קבוצה
 *
 * תיעוד: https://green-api.com/en/docs/api/
 */

// ============================================================================
// Types
// ============================================================================

interface GreenApiCredentials {
  instanceId: string;
  apiToken: string;
  apiUrl?: string; // ברירת מחדל: https://api.green-api.com
}

interface GreenApiResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

interface GroupInfo {
  groupId: string;
  subject: string;          // שם הקבוצה
  owner: string;
  participants: Array<{
    id: string;             // "972xxx@c.us"
    isAdmin: boolean;
    isSuperAdmin: boolean;
  }>;
}


// ============================================================================
// Helper: build URL for Green API endpoint
// ============================================================================

function buildUrl(
  creds: GreenApiCredentials,
  method: string,
): string {
  const base = creds.apiUrl ?? 'https://api.green-api.com';
  return `${base}/waInstance${creds.instanceId}/${method}/${creds.apiToken}`;
}


// ============================================================================
// Internal: POST request with error handling
// ============================================================================

async function greenApiPost<T = unknown>(
  creds: GreenApiCredentials,
  method: string,
  body: Record<string, unknown>,
): Promise<GreenApiResult<T>> {
  try {
    const url = buildUrl(creds, method);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        statusCode: response.status,
        error: `Green API ${method} failed: ${response.status} ${JSON.stringify(responseData)}`,
        data: responseData as T,
      };
    }

    return { ok: true, data: responseData as T };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error in Green API call',
    };
  }
}


// ============================================================================
// Public API
// ============================================================================

/**
 * מחיקת הודעה מקבוצה.
 * דורש שהבוט יהיה אדמין בקבוצה.
 *
 * @param creds - פרטי Green API instance
 * @param chatId - "120363xxx@g.us"
 * @param messageId - ה-stanzaId של ההודעה למחיקה
 */
export async function deleteMessage(
  creds: GreenApiCredentials,
  chatId: string,
  messageId: string,
): Promise<GreenApiResult> {
  return greenApiPost(creds, 'deleteMessage', {
    chatId,
    idMessage: messageId,
  });
}


/**
 * הוצאת משתמש מקבוצה.
 * דורש שהבוט יהיה אדמין בקבוצה.
 *
 * @param creds - פרטי Green API instance
 * @param groupId - "120363xxx@g.us"
 * @param participantPhone - "972xxx@c.us" או רק "972xxx"
 */
export async function removeGroupParticipant(
  creds: GreenApiCredentials,
  groupId: string,
  participantPhone: string,
): Promise<GreenApiResult> {
  // Normalize: ensure @c.us suffix
  const participantId = participantPhone.includes('@')
    ? participantPhone
    : `${participantPhone}@c.us`;

  return greenApiPost(creds, 'removeGroupParticipant', {
    groupId,
    participantChatId: participantId,
  });
}


/**
 * שליחת הודעה לקבוצה (משמש לאזהרה / הודעת מערכת).
 *
 * @param creds - פרטי Green API instance
 * @param chatId - "120363xxx@g.us"
 * @param message - הטקסט לשליחה
 * @param quotedMessageId - אופציונלי - ID של הודעה לציטוט
 */
export async function sendMessage(
  creds: GreenApiCredentials,
  chatId: string,
  message: string,
  quotedMessageId?: string,
): Promise<GreenApiResult<{ idMessage: string }>> {
  const body: Record<string, unknown> = {
    chatId,
    message,
  };
  if (quotedMessageId) {
    body.quotedMessageId = quotedMessageId;
  }
  return greenApiPost<{ idMessage: string }>(creds, 'sendMessage', body);
}


/**
 * שליפת פרטי קבוצה - כולל רשימת משתתפים והאם המספר שלנו אדמין.
 *
 * @param creds - פרטי Green API instance
 * @param groupId - "120363xxx@g.us"
 */
export async function getGroupData(
  creds: GreenApiCredentials,
  groupId: string,
): Promise<GreenApiResult<GroupInfo>> {
  return greenApiPost<GroupInfo>(creds, 'getGroupData', { groupId });
}


/**
 * Helper: בדיקה האם המספר שלנו אדמין בקבוצה.
 * שימושי לפני שמנסים למחוק/לבעוט.
 */
export async function isBotAdmin(
  creds: GreenApiCredentials,
  groupId: string,
  botPhone: string,
): Promise<boolean> {
  const result = await getGroupData(creds, groupId);
  if (!result.ok || !result.data) return false;

  const botId = botPhone.includes('@') ? botPhone : `${botPhone}@c.us`;
  const participant = result.data.participants?.find((p) => p.id === botId);
  return participant?.isAdmin === true || participant?.isSuperAdmin === true;
}


// ============================================================================
// Phone normalization helpers
// ============================================================================

/**
 * הופך "972501234567@c.us" ל-"972501234567"
 */
export function stripWhatsAppSuffix(jid: string): string {
  return jid.replace(/@.+$/, '');
}


/**
 * שולף את הקידומת מטלפון.
 * דוגמה: "972501234567" -> "972", "234801234567" -> "234"
 *
 * הנחה: קידומת היא 1-3 ספרות בתחילת המספר.
 * עבור Israel (972), Pakistan (92), USA (1), זה עובד.
 */
export function extractPhonePrefix(phone: string): string {
  const clean = stripWhatsAppSuffix(phone).replace(/^\+/, '');
  // 1 digit prefixes (USA, Russia)
  if (/^[17]/.test(clean)) return clean.substring(0, 1);
  // 2 digit prefixes (most countries)
  // 3 digit prefixes (Israel 972, etc)
  // ברירת מחדל: 3 ספרות (כיסוי הרחב ביותר)
  return clean.substring(0, 3);
}
