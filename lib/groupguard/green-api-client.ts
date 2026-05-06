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
  apiUrl?: string; // ברירת מחדל: per-instance prefix (https://{prefix}.api.greenapi.com)
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
  // Use the per-instance prefix host (e.g. https://7107.api.greenapi.com).
  // The generic api.green-api.com host does NOT auto-redirect for newer instances.
  const prefix = String(creds.instanceId).substring(0, 4);
  const base = creds.apiUrl ?? `https://${prefix}.api.greenapi.com`;
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

    // Green API has a quirk: when the instance is mid-restart it returns
    // HTTP 200 with a STRING body like "instance is starting or not authorized"
    // instead of the expected JSON object. Without this guard, the caller
    // gets back ok:true with data: "...string..." and tries to read
    // .participants on it, which blows up downstream as a confusing
    // "Group not found" because the data shape isn't what we expected.
    if (typeof responseData === 'string') {
      const lower = responseData.toLowerCase();
      const isStarting =
        lower.includes('starting') || lower.includes('not authorized');
      return {
        ok: false,
        statusCode: response.status,
        error: isStarting
          ? 'ה-WhatsApp בתהליך התחברות, נסה שוב בעוד דקה'
          : `Green API ${method}: ${responseData}`,
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


/**
 * שליפת תמונת פרופיל של משתמש מ-WhatsApp.
 *
 * Green API endpoint: /getAvatar
 * Returns either:
 *   { available: false }                         — user has no avatar OR
 *                                                   visibility is restricted
 *                                                   (privacy = contacts only)
 *   { urlAvatar: "https://pps.whatsapp.net/..." } — public CDN URL
 *
 * The CDN URL is stable enough for caching (days), but technically can
 * rotate, so we re-fetch periodically. The URL doesn't require auth to
 * load — the browser fetches it directly via <img src>.
 *
 * @param creds   - Green API credentials
 * @param chatId  - "972501234567@c.us" for an individual contact
 *                  (use phone + @c.us suffix; group avatars use @g.us)
 */
export async function getAvatar(
  creds: GreenApiCredentials,
  chatId: string,
): Promise<GreenApiResult<{ urlAvatar: string | null; available: boolean }>> {
  const result = await greenApiPost<{ urlAvatar?: string; available?: boolean; reason?: string }>(
    creds,
    'getAvatar',
    { chatId },
  );
  if (!result.ok) return result as GreenApiResult<{ urlAvatar: string | null; available: boolean }>;

  // Normalize the response shape — Green API returns either {urlAvatar, available:true}
  // or {available:false, reason:"..."} or sometimes just {urlAvatar:""} with no available flag.
  const urlAvatar = result.data?.urlAvatar?.trim() || null;
  const available = result.data?.available !== false && !!urlAvatar;

  return {
    ok: true,
    data: { urlAvatar: available ? urlAvatar : null, available },
  };
}

/**
 * getContactInfo: Fetches both the contact's display name AND avatar URL in
 * a single Green API call. Preferable to getAvatar() when we want the name
 * too — saves a round-trip.
 *
 * The 'name' / 'contactName' fields are usually empty for arbitrary contacts
 * (WhatsApp privacy rules — you only see saved-contact names, plus business-
 * verified names). When empty, the caller should fall back to other sources
 * (e.g. wa_messages.sender_name from past messages, which is the WhatsApp
 * pushname and IS visible because it's part of every message envelope).
 *
 * Note: the underlying Green API also returns base64Avatar (a huge inline
 * image blob). We DON'T parse it — it's pure waste of bytes when we already
 * have the URL. The CDN URL is what we store and what the browser renders.
 */
export async function getContactInfo(
  creds: GreenApiCredentials,
  chatId: string,
): Promise<
  GreenApiResult<{
    name: string | null;
    contactName: string | null;
    avatarUrl: string | null;
    isBusiness: boolean;
    category: string | null;
  }>
> {
  const result = await greenApiPost<{
    name?: string;
    contactName?: string;
    avatar?: string;
    isBusiness?: boolean;
    category?: string;
  }>(creds, 'getContactInfo', { chatId });

  if (!result.ok) {
    return result as GreenApiResult<{
      name: string | null;
      contactName: string | null;
      avatarUrl: string | null;
      isBusiness: boolean;
      category: string | null;
    }>;
  }

  const name = result.data?.name?.trim() || null;
  const contactName = result.data?.contactName?.trim() || null;
  const avatarUrl = result.data?.avatar?.trim() || null;

  return {
    ok: true,
    data: {
      name,
      contactName,
      avatarUrl,
      isBusiness: !!result.data?.isBusiness,
      category: result.data?.category?.trim() || null,
    },
  };
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
