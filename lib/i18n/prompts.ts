/**
 * AI System Prompts - locale-aware versions of the OpenAI system prompts
 * used in the WhatsApp webhook for classification, update detection, and
 * read-query handling.
 *
 * Each function takes the workspace context and returns a complete prompt
 * in the appropriate language. Schemas (table names, field names) are
 * passed through as-is - the user already wrote them in their language.
 */

import type { Locale } from './locales';

// ─────────────────────────────────────────────────────────────────────────
// Prompt 1: Classify a new WhatsApp message into a table
// ─────────────────────────────────────────────────────────────────────────

export function getClassifyPrompt(
  locale: Locale,
  schema: any,
  businessDescription: string | null,
  senderInfo: string,
): string {
  if (locale === 'en') {
    return `You are an AI assistant that classifies WhatsApp messages into tables.
${businessDescription ? `Business description: ${businessDescription}\n` : ''}
Available tables:
${JSON.stringify(schema, null, 2)}

Sender: ${senderInfo}

Return ONLY valid JSON:
{
  "table_slug": "<slug or null>",
  "confidence": <0.0-1.0>,
  "data": { "<field_slug>": <value> },
  "reasoning": "<brief>"
}

Rules:
- table_slug: null if this is not data to save (small talk, question)
- select/status: only values from options
- date: YYYY-MM-DD | datetime: ISO 8601 | number/currency: number
- Don't invent fields
- confidence < 0.5 = uncertain

⚠️ IMPORTANT - conversation context:
- Previous messages (if any) are shown only to help you resolve references and completions the user explicitly makes (e.g. "at Yossi's" as a follow-up to a fault just described).
- If the user doesn't clearly reference the previous message (e.g. just sends a new task) - ignore the history completely and don't carry over fields (assignee, property, status etc.) from the previous message.
- Example: history="task for Yossi to fix car", current message="clean column" → create new task with description=clean column only, no assignee.`;
  }

  // Hebrew (default)
  return `אתה עוזר שמסווג הודעות וואטסאפ בעברית לטבלאות.
${businessDescription ? `תיאור העסק: ${businessDescription}\n` : ''}
הטבלאות הזמינות:
${JSON.stringify(schema, null, 2)}

המשתמש: ${senderInfo}

החזר אך ורק JSON תקין:
{
  "table_slug": "<slug או null>",
  "confidence": <0.0-1.0>,
  "data": { "<field_slug>": <value> },
  "reasoning": "<קצר>"
}

כללים:
- table_slug: null אם זה לא נתון לשמירה (שיחת חולין, שאלה)
- select/status: רק ערך מתוך options
- date: YYYY-MM-DD | datetime: ISO 8601 | number/currency: מספר
- אל תמציא שדות
- confidence < 0.5 = לא בטוח

⚠️ חשוב מאוד - הקשר השיחה:
- הודעות קודמות (אם יש) מוצגות לך רק כדי לפענח התייחסויות והשלמות שהמשתמש מבטא במפורש (כמו "אצל יוסי" כהמשך לתקלה שתואר רגע קודם).
- אם המשתמש לא מתייחס בבירור להודעה הקודמת (למשל פשוט שולח משימה חדשה) - התעלם מההיסטוריה לחלוטין ואל תעתיק שדות (assignee, property, status וכו') מההודעה הקודמת.
- דוגמה: היסטוריה="משימה ליוסי לתקן רכב", הודעה נוכחית="לנקות עמוד" → צור משימה חדשה עם description=לנקות עמוד בלבד, ללא assignee.`;
}

// ─────────────────────────────────────────────────────────────────────────
// Prompt 2: Detect if a reply is updating an existing record
// ─────────────────────────────────────────────────────────────────────────

export function getUpdatePrompt(
  locale: Locale,
  tableName: string,
  recordData: any,
  fieldsSchema: any,
  businessDescription: string | null,
  senderInfo: string,
): string {
  if (locale === 'en') {
    return `You are an AI assistant updating an existing record based on a WhatsApp user reply.
${businessDescription ? `Business description: ${businessDescription}\n` : ''}
Current record from "${tableName}" table:
${JSON.stringify(recordData, null, 2)}

Available fields for update:
${JSON.stringify(fieldsSchema, null, 2)}

The user (${senderInfo}) sent a reply. You need to determine:
1. Which fields they want to update
2. If there's a "status" field - words like "done", "fixed", "completed", "closed", "✅" → status to final value
3. If they're just asking for info (question) - don't update

⚠️ Previous conversation messages are only for resolving pronouns and references (like "and add a note"). The update must be based ONLY on the current message - don't update fields the user didn't mention now.

Return ONLY valid JSON:
{
  "action": "update" | "query" | "ignore",
  "updates": { "<field_slug>": <new_value> },
  "summary": "<brief description in English of what was done>"
}`;
  }

  // Hebrew (default)
  return `אתה עוזר שמעדכן רשומה קיימת לפי תגובת משתמש בוואטסאפ.
${businessDescription ? `תיאור העסק: ${businessDescription}\n` : ''}
הרשומה הנוכחית מטבלת "${tableName}":
${JSON.stringify(recordData, null, 2)}

השדות הזמינים לעדכון:
${JSON.stringify(fieldsSchema, null, 2)}

המשתמש (${senderInfo}) שלח תגובה. עליך להבין:
1. אילו שדות הוא רוצה לעדכן
2. אם יש שדה "סטטוס" / "status" — מילים כמו "טופל", "בוצע", "סגור", "סיימתי", "✅" → סטטוס לערך הסופי
3. אם הוא רק מבקש מידע (שאלה) — אל תעדכן

⚠️ הודעות קודמות בשיחה הן רק לפענוח כינויים והפניות (כמו "וגם תוסיף הערה"). העדכון חייב להיות מבוסס אך ורק על ההודעה הנוכחית - אל תעדכן שדות שהמשתמש לא הזכיר עכשיו.

החזר אך ורק JSON:
{
  "action": "update" | "query" | "ignore",
  "updates": { "<field_slug>": <new_value> },
  "summary": "<תיאור קצר בעברית של מה התבצע>"
}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Prompt 3: Detect read-query and translate into search filters
// ─────────────────────────────────────────────────────────────────────────

export function getQueryPrompt(
  locale: Locale,
  schema: any,
  businessDescription: string | null,
): string {
  if (locale === 'en') {
    return `You are an AI assistant that detects read-queries from WhatsApp messages and translates them into table searches.
${businessDescription ? `Business description: ${businessDescription}\n` : ''}
Tables:
${JSON.stringify(schema, null, 2)}

The user asked a question. Return JSON:
{
  "is_query": true | false,
  "table_slug": "<which table to search>",
  "filters": [
    { "field_slug": "...", "operator": "eq|neq|in|not_in|gt|lt|contains", "value": <value> }
  ],
  "intent": "list" | "count" | "detail",
  "limit": <max records, default 10>,
  "summary": "<how to label the result, e.g. 'Open tickets' or 'Vacant properties'>"
}

Examples:
- "list of open tickets" → table: issues, filter: status neq resolved, intent: list
- "how many urgent tickets are there?" → table: issues, filter: urgency eq high, intent: count
- "vacant properties" → table: properties, filter: status eq vacant, intent: list
- "tenants whose lease ends this month" → table: tenants, filter: lease_end between...
- "John Smith's tickets" → find John in existing_records of relation field, filter: <relation_field> eq "<uuid>", intent: list

⚠️ Important: Previous conversation messages are shown only to help resolve pronouns and references (like "add a date", "give me the location too"). When the user asks a brand new question unrelated to the previous query - ignore the history.

If this is not a read-query (it's a create/update) → return {"is_query": false}`;
  }

  // Hebrew (default)
  return `אתה עוזר שמזהה שאילתות-קריאה מהודעות וואטסאפ בעברית ומתרגם אותן לחיפוש בטבלאות.
${businessDescription ? `תיאור העסק: ${businessDescription}\n` : ''}
הטבלאות:
${JSON.stringify(schema, null, 2)}

המשתמש שאל. החזר JSON:
{
  "is_query": true | false,
  "table_slug": "<באיזו טבלה לחפש>",
  "filters": [
    { "field_slug": "...", "operator": "eq|neq|in|not_in|gt|lt|contains", "value": <ערך> }
  ],
  "intent": "list" | "count" | "detail",
  "limit": <מספר רשומות מקסימלי, ברירת מחדל 10>,
  "summary": "<איך לקרוא לתוצאה, לדוגמה: 'תקלות פתוחות' או 'נכסים פנויים'>"
}

דוגמאות:
- "רשימת תקלות פתוחות" → table: issues, filter: status neq resolved, intent: list
- "כמה תקלות דחופות יש?" → table: issues, filter: urgency eq high, intent: count
- "נכסים פנויים" → table: properties, filter: status eq vacant, intent: list
- "שוכרים עם חוזה שמסתיים החודש" → table: tenants, filter: lease_end between...
- "תקלות של יוסי כהן" → מצא את יוסי ב-existing_records של שדה relation, filter: <relation_field> eq "<uuid>", intent: list

⚠️ חשוב: הודעות קודמות בשיחה מוצגות לך רק לצורך פענוח כינויי גוף והפניות (כמו "תוסיף תאריך", "תן לי גם מקום"). כשהמשתמש שואל שאלה חדשה לחלוטין שלא קשורה לשאילתה הקודמת - התעלם מההיסטוריה.

אם זו לא שאילתה-קריאה (מדובר ביצירה/עדכון) → החזר {"is_query": false}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Bot reply messages - confirmations, errors, fallbacks
// ─────────────────────────────────────────────────────────────────────────

export type BotMessageKey =
  | 'classification_unclear'
  | 'permission_denied'
  | 'query_no_results'
  | 'unknown_table'
  | 'low_confidence'
  | 'audio_no_transcript'
  | 'image_no_text'
  | 'whisper_language_hint';

const BOT_MESSAGES: Record<Locale, Record<BotMessageKey, string>> = {
  he: {
    classification_unclear: 'לא בטוח לאיזו טבלה זה שייך. תוכל להבהיר?',
    permission_denied: 'אין לך הרשאה לטבלה זו',
    query_no_results: 'לא נמצאו תוצאות לשאילתה זו',
    unknown_table: 'הטבלה לא נמצאה',
    low_confidence: 'לא בטוח שהבנתי, תוכל לפרט יותר?',
    audio_no_transcript: 'לא הצלחתי לתמלל את ההקלטה',
    image_no_text: 'לא הצלחתי לחלץ נתונים מהתמונה',
    whisper_language_hint: 'he',
  },
  en: {
    classification_unclear: "I'm not sure which table this belongs to. Can you clarify?",
    permission_denied: "You don't have permission for this table",
    query_no_results: 'No results found for this query',
    unknown_table: 'Table not found',
    low_confidence: "I'm not sure I understood — can you elaborate?",
    audio_no_transcript: "Couldn't transcribe the audio",
    image_no_text: "Couldn't extract data from the image",
    whisper_language_hint: 'en',
  },
};

export function getBotMessage(locale: Locale, key: BotMessageKey): string {
  return BOT_MESSAGES[locale]?.[key] ?? BOT_MESSAGES.he[key];
}
