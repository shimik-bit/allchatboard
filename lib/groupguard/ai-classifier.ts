/**
 * AI Content Classifier - GroupGuard
 * ====================================
 * משתמש ב-OpenAI gpt-4o-mini לזיהוי תוכן ספאם בהודעות WhatsApp.
 *
 * - עלות: ~$0.0002 לכל סיווג (150 input + 100 output tokens)
 * - 1000 הודעות ביום ≈ $0.20/יום
 *
 * רגישות:
 *  - 'low'    -> רק high-risk מסומן (scam, phishing, פורנו)
 *  - 'medium' -> high + medium מסומן (גם פרסומות מובהקות)
 *  - 'high'   -> כל דבר חשוד מסומן (כולל off-topic)
 */

import type { AiClassification, AiSensitivity } from '@/lib/types/groupguard';

// ============================================================================
// In-memory cache (per Lambda instance)
// ============================================================================
// קאש פשוט: מונע סיווגים חוזרים של אותה הודעה במקרה של retry/duplicate.
// TTL 5 דקות, מקסימום 200 entries.

interface CacheEntry {
  result: AiClassification;
  expiresAt: number;
}

const CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 דקות
const CACHE_MAX_SIZE = 200;

function cacheKey(text: string): string {
  // נורמליזציה: lowercase, trim, ראשי 200 תווים
  return text.toLowerCase().trim().substring(0, 200);
}

function cleanCache() {
  const now = Date.now();
  // הסרת entries שפגו
  for (const [key, entry] of CACHE.entries()) {
    if (entry.expiresAt < now) CACHE.delete(key);
  }
  // אם עדיין גדול מדי, מסיר את ה-50 הישנים ביותר
  if (CACHE.size > CACHE_MAX_SIZE) {
    const sorted = Array.from(CACHE.entries()).sort(
      (a, b) => a[1].expiresAt - b[1].expiresAt,
    );
    for (let i = 0; i < 50; i++) CACHE.delete(sorted[i][0]);
  }
}


// ============================================================================
// Main API
// ============================================================================

export interface ClassifyOptions {
  groupName?: string | null;
  groupContext?: string | null; // hint על נושא הקבוצה
  sensitivity: AiSensitivity;
}

/**
 * מסווג הודעה כספאם או תקינה.
 * מחזיר null אם הסיווג נכשל (אז ה-pipeline ידלג עליו).
 */
export async function classifyMessage(
  text: string,
  options: ClassifyOptions,
): Promise<AiClassification | null> {
  // הודעות קצרות מאוד לא צריכות סיווג - חסכון של עלות
  const cleaned = text.trim();
  if (cleaned.length < 5) {
    return {
      is_spam: false,
      risk: 'none',
      categories: [],
      confidence: 1.0,
      explanation: 'הודעה קצרה מדי לסיווג',
    };
  }

  // בדיקת cache
  const key = cacheKey(cleaned);
  const cached = CACHE.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  // קריאה ל-AI
  try {
    const result = await callOpenAI(cleaned, options);
    if (result) {
      // שמירה ב-cache
      CACHE.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
      cleanCache();
    }
    return result;
  } catch (err) {
    console.error('[GG][AI] classification failed:', err);
    return null; // fail-open: בכישלון, לא מסמנים כספאם
  }
}


// ============================================================================
// OpenAI call
// ============================================================================

async function callOpenAI(
  text: string,
  options: ClassifyOptions,
): Promise<AiClassification | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[GG][AI] OPENAI_API_KEY not configured');
    return null;
  }

  const systemPrompt = buildSystemPrompt(options);
  const userPrompt = buildUserPrompt(text, options);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1, // נמוך - אנחנו רוצים החלטות עקביות
      max_tokens: 200,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown');
    console.error('[GG][AI] OpenAI error:', response.status, errText);
    return null;
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) return null;

  return parseClassification(content);
}


function buildSystemPrompt(options: ClassifyOptions): string {
  const sensitivityGuide: Record<AiSensitivity, string> = {
    low: `סווג כספאם רק תוכן ברור וחמור: scam, phishing, פורנו, תרמיות מובהקות.
פרסומות רגילות, הודעות off-topic, או קישורים לגיטימיים - לא יסומנו.`,
    medium: `סווג כספאם: scam, phishing, פרסומות מובהקות (במיוחד לקבוצות לא מסחריות),
קישורים חשודים, schemes "התעשר מהר", פורנו.
שיחה רגילה, שאלות, חלק תורן וכדומה - לא יסומנו.`,
    high: `סווג כספאם: כל דבר חשוד או לא במקום - פרסומות, קישורים זרים,
הודעות שיווק, off-topic ברור, scam, phishing, פורנו.
רק שיחה רלוונטית לנושא הקבוצה תיחשב כתקינה.`,
  };

  return `אתה מסווג הודעות WhatsApp בקבוצה. עליך להחזיר JSON בלבד.

רגישות: ${options.sensitivity}
${sensitivityGuide[options.sensitivity]}

החזר אובייקט JSON עם המבנה הבא בדיוק:
{
  "is_spam": boolean,
  "risk": "none" | "low" | "medium" | "high",
  "categories": [string],
  "confidence": number בין 0 ל-1,
  "explanation": "הסבר קצר בעברית, עד 15 מילים"
}

categories יכול לכלול: "ad", "scam", "phishing", "porn", "off_topic", "suspicious_link", "marketing"

רמות risk:
- "high": scam, phishing, פורנו, fake offers - הוצאה מהקבוצה מיידית
- "medium": פרסומות מובהקות, קישורים חשודים - מחיקה + אזהרה
- "low": off-topic קל, הודעות פחות חמורות - רק לוג
- "none": שיחה תקינה`;
}


function buildUserPrompt(text: string, options: ClassifyOptions): string {
  const lines: string[] = [];

  if (options.groupName) {
    lines.push(`קבוצה: "${options.groupName}"`);
  }
  if (options.groupContext) {
    lines.push(`נושא הקבוצה: ${options.groupContext}`);
  }
  lines.push(`הודעה לסיווג:`);
  lines.push(`"""`);
  lines.push(text);
  lines.push(`"""`);
  lines.push(``);
  lines.push(`החזר JSON בלבד.`);

  return lines.join('\n');
}


function parseClassification(rawContent: string): AiClassification | null {
  try {
    const parsed = JSON.parse(rawContent);

    // ולידציה של השדות
    if (typeof parsed.is_spam !== 'boolean') return null;

    const validRisks = ['none', 'low', 'medium', 'high'];
    const risk = validRisks.includes(parsed.risk) ? parsed.risk : 'none';

    const categories = Array.isArray(parsed.categories)
      ? parsed.categories.filter((c: unknown) => typeof c === 'string').slice(0, 5)
      : [];

    let confidence = Number(parsed.confidence);
    if (Number.isNaN(confidence) || confidence < 0) confidence = 0.5;
    if (confidence > 1) confidence = 1;

    const explanation =
      typeof parsed.explanation === 'string'
        ? parsed.explanation.substring(0, 200)
        : '';

    return {
      is_spam: parsed.is_spam,
      risk: risk as AiClassification['risk'],
      categories,
      confidence,
      explanation,
    };
  } catch (err) {
    console.error('[GG][AI] failed to parse classification:', rawContent, err);
    return null;
  }
}


// ============================================================================
// Action mapping - ממיר risk level לפעולה
// ============================================================================

/**
 * ממיר רמת סיכון מ-AI לפעולה לפי הרגישות שהוגדרה לקבוצה.
 *
 * רגישות נמוכה - רק high מפעיל kick
 * רגישות בינונית - high=kick, medium=delete
 * רגישות גבוהה - high=kick, medium=delete, low=warn
 */
export function riskToAction(
  risk: AiClassification['risk'],
  sensitivity: AiSensitivity,
): 'kick' | 'delete_message' | 'warn' | null {
  if (risk === 'high') return 'kick';

  if (risk === 'medium') {
    if (sensitivity === 'low') return null;
    return 'delete_message';
  }

  if (risk === 'low') {
    if (sensitivity === 'high') return 'warn';
    return null;
  }

  return null; // 'none'
}
