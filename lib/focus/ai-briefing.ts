/**
 * AI-powered focus briefing engine.
 *
 * Takes a FocusContext + user prompt and returns structured tasks
 * categorized by priority. Uses OpenAI structured output for reliability.
 */

import OpenAI from 'openai';
import type { FocusContext } from './context-gathering';

export type BriefingTask = {
  title: string;          // Action-oriented: "התקשר ליוסי על ההצעה"
  reason: string;         // Why this matters: "הוא ביקש תשובה לפני שבוע"
  table_name?: string;    // Source table
  record_id?: string;     // Specific record this is about
  priority: 'critical' | 'high' | 'medium' | 'suggestion';
  // Suggested action for the user
  action_hint?: 'call' | 'message' | 'meeting' | 'review' | 'decide' | 'delegate' | 'document';
  estimated_minutes?: number;
};

export type BriefingResponse = {
  greeting: string;        // Personal opening: "בוקר טוב יוסי, יום עמוס היום"
  summary: string;         // 1-line overview: "5 לידים חדשים מחכים לתגובה"
  tasks: BriefingTask[];
  closing?: string;        // Encouraging close
};

export async function generateFocusBriefing(
  context: FocusContext,
  userPrompt: string,
  apiKey: string
): Promise<{
  briefing: BriefingResponse;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
}> {
  const openai = new OpenAI({ apiKey });

  // ─── Build the system prompt ───
  const roleContext = context.user.role_title
    ? `התפקיד שלי: ${context.user.role_title}${context.user.role_description ? ` - ${context.user.role_description}` : ''}`
    : `(התפקיד שלי לא מוגדר ידנית - תזהה מההקשר ותסיק מה רלוונטי)`;

  const tablesContext = context.tables.map(t => {
    const records = t.sample_records.map(r => {
      const reasonLabel = ({
        mine: '👤 שלי',
        recent: '🆕 חדש',
        stuck: '⚠️ תקוע',
        overdue: '⏰ באיחור',
        critical: '🔥 קריטי',
      } as any)[r.reason] || '';
      return `  • [${reasonLabel}] [id:${r.id}] ${r.title}${r.status ? ` (${r.status})` : ''}\n    ${r.summary}\n    עודכן: ${formatRelativeTime(r.last_updated)}`;
    }).join('\n');

    return `📊 ${t.icon || ''} ${t.name} (${t.record_count} רשומות)${t.purpose ? `\n  ייעוד: ${t.purpose}` : ''}
${t.field_summary}
דוגמאות רשומות:
${records || '  (אין רשומות לדוגמה)'}`;
  }).join('\n\n');

  const systemPrompt = `אתה assistant אישי חכם של ${context.user.name}.
המטרה שלך: לתת לו פוקוס ויעילות - מה לעשות עכשיו כדי שהיום הזה יהיה יום מצליח.

${roleContext}

סביבת העבודה: ${context.workspace.name}
סטטיסטיקות: ${context.stats.total_records} רשומות סה"כ, ${context.stats.new_this_week} חדשים השבוע, ${context.stats.overdue} באיחור

${tablesContext}

הוראות חשובות:
1. תן בדיוק 3-7 משימות קונקרטיות (לא יותר!) - איכות לפני כמות
2. כל משימה חייבת להיות פעולתית: "התקשר/שלח/קבע/החלט/בדוק" - לא "בדוק את ה-CRM"
3. אם יש record_id ברשומה - חבר אותו למשימה (כדי שהמשתמש יוכל לקפוץ אליה)
4. עדף משימות לפי דחיפות:
   - critical: דחוף וחשוב - חייב להיעשות היום
   - high: חשוב מאוד - לעשות היום אם אפשר
   - medium: צריך להיעשות בקרוב
   - suggestion: רעיון, לא דחוף
5. תן רק 1-2 critical, ולא יותר מ-3 high - אחרת אין פוקוס
6. המשימות צריכות להיות מגוונות - לא כולן מאותה טבלה
7. עברית טבעית, חברית אבל מקצועית. בלי clichés כמו "בוקר טוב לכולם"

החזר JSON בפורמט הזה בדיוק:
{
  "greeting": "בוקר טוב יוסי. יש לך 3 לידים חמים ופגישה ב-15:00",
  "summary": "המוקד היום: סגירת עסקת לוי + מעקב אחרי לידים חדשים מהשבוע",
  "tasks": [
    {
      "title": "התקשר ליוסי לוי - הוא חיכה תשובה השבוע",
      "reason": "הליד נמצא במצב 'בטיפול' ולא עודכן 8 ימים, ערך עסקה ₪45K",
      "record_id": "abc-123",
      "table_name": "לידים",
      "priority": "critical",
      "action_hint": "call",
      "estimated_minutes": 10
    }
  ],
  "closing": "יום פרודוקטיבי ✨"
}`;

  // ─── Call OpenAI ───
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // Fast + cheap
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt || 'תפקס אותי - מה לעשות היום לפי דחיפות?' },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 1500,
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  let briefing: BriefingResponse;
  try {
    briefing = JSON.parse(raw);
  } catch {
    briefing = {
      greeting: 'מצטער, לא הצלחתי להפיק בריפינג',
      summary: 'אנא נסה שוב',
      tasks: [],
    };
  }

  // Cost calculation (gpt-4o-mini: $0.15/1M input, $0.60/1M output)
  const tokensInput = completion.usage?.prompt_tokens || 0;
  const tokensOutput = completion.usage?.completion_tokens || 0;
  const costUsd = (tokensInput * 0.15 + tokensOutput * 0.60) / 1_000_000;

  return { briefing, tokensInput, tokensOutput, costUsd };
}

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (days >= 1) return `לפני ${days} ${days === 1 ? 'יום' : 'ימים'}`;
  if (hours >= 1) return `לפני ${hours} ${hours === 1 ? 'שעה' : 'שעות'}`;
  return 'הרגע';
}
