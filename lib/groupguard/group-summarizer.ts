/**
 * Group Daily Summarizer
 * =======================
 * Generates an end-of-day AI summary of a WhatsApp group's activity.
 *
 * Design choices:
 *   - Bullet-list output (not prose) — easier to scan on a phone screen
 *   - 5-8 bullets max — enforces signal-to-noise discipline
 *   - "Day" is interpreted as the last 24 hours from the trigger time,
 *     not strictly midnight-to-midnight. This is more useful for an evening
 *     digest run at 21:00 (covers the whole day's activity, not just up to
 *     midnight last night).
 *   - Skips when fewer than 5 messages exist — no point AI-summarizing 2
 *     "תודה" messages
 *   - Costs are bounded: we cap the message text we send to OpenAI at ~8k
 *     chars, which is roughly 200 average messages. Beyond that we sample
 *     evenly across the day rather than truncating (truncating loses the
 *     end of the day, which often has the most important content).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendMessage } from './green-api-client';
import { logAiUsage, AI_FEATURES } from '@/lib/ai/log-usage';

// ============================================================================
// Types
// ============================================================================

export type GroupSummary = {
  /**
   * 2-3 sentence narrative paragraph describing the overall theme/vibe/
   * direction of the day. Sits above the bullets so a reader gets the
   * frame before drilling into specifics. Optional — older summaries
   * (pre-PR adding this field) won't have it, and the AI is allowed to
   * omit it when the day was so unstructured that there's no through-line.
   */
  context?: string | null;

  /**
   * 6-10 single-sentence bullet points covering substantive content.
   * Excludes pleasantries, greetings, off-topic chatter. Ordered by
   * importance (action-required first, decisions next, discussions, etc).
   */
  bullets: string[];

  /**
   * Decisions or action items that came out of the conversation —
   * 'who needs to do what next' kind of stuff. Higher-signal than
   * regular bullets. Empty array when nothing actionable was discussed.
   * Often empty for casual social groups.
   */
  key_decisions?: string[];

  /** 1-line overview of the day's main theme. */
  headline: string;

  /** How many messages the AI saw. */
  message_count: number;

  /** Unique senders that day. */
  participant_count: number;
};

export type SummarizeResult = {
  ok: true;
  summary: GroupSummary;
  summary_id: string;
  skipped?: false;
} | {
  ok: true;
  skipped: true;
  reason: 'too_few_messages' | 'no_messages' | 'already_summarized';
  // Diagnostic counts so the UI can show "you have 4 text messages, need at
  // least 3" instead of just "too few messages" (which used to leave users
  // confused about WHY their group with 13 messages couldn't be summarized).
  total_messages?: number;
  text_messages?: number;
  min_required?: number;
} | {
  ok: false;
  error: string;
};

export type SummarizeOptions = {
  // Override the "now" used for the 24-hour window. Mostly for testing or
  // generating a summary for a specific past day.
  now?: Date;
  // Who triggered this run — affects logging and the stored row
  triggeredBy: 'manual' | 'auto' | 'backfill';
  triggeredByUserId?: string;
  // If true, replaces an existing summary for the same day (otherwise skips)
  force?: boolean;
};

/**
 * Minimum number of TEXT messages (not media-only, not system events like
 * "X joined the group") required before we attempt an AI summary.
 *
 * Lowered from 5 → 3 after observing real-world cases where active social
 * groups have many member-add/leave events + media but only a handful of
 * actual text messages on a given day. With 3 substantive messages the AI
 * can still produce a useful summary; below 3 the result tends to be
 * trivial ("X said hi, then Y replied").
 */
export const MIN_TEXT_MESSAGES_FOR_SUMMARY = 3;

// ============================================================================
// Main entry point
// ============================================================================

/**
 * Generate (or regenerate) a daily summary for a single group.
 *
 * Returns one of:
 *   - {ok:true, summary} on success
 *   - {ok:true, skipped:true, reason:...} for soft skips (not enough data,
 *     or already summarized today and force=false)
 *   - {ok:false, error} on hard failures (API errors, etc)
 */
export async function summarizeGroup(
  supabase: SupabaseClient,
  groupId: string,
  options: SummarizeOptions,
): Promise<SummarizeResult> {
  const now = options.now ?? new Date();

  // 1. Load the group row + workspace info we'll need for credentials later
  const { data: group, error: groupErr } = await supabase
    .from('whatsapp_groups')
    .select(`
      id,
      workspace_id,
      group_name,
      green_api_chat_id,
      summary_send_to_whatsapp,
      summary_whatsapp_target
    `)
    .eq('id', groupId)
    .single();

  if (groupErr || !group) {
    return { ok: false, error: 'group_not_found' };
  }

  // 2. Determine the day window. We use a rolling 24-hour window ending NOW
  //    rather than calendar midnight-to-midnight: a 21:00 evening run wants
  //    to cover today, not yesterday.
  const windowEnd = now.toISOString();
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  // The "summary_date" we file under is the calendar date of the END of the
  // window (in workspace TZ — for now we assume UTC/Israel; a future migration
  // could store workspace timezone explicitly).
  const summaryDate = now.toISOString().slice(0, 10); // YYYY-MM-DD

  // 3. Dedupe: if a summary already exists for this group+date and not
  //    forcing, return early. This protects the cron from generating the
  //    same summary twice if it's triggered multiple times in one day.
  if (!options.force) {
    const { data: existing } = await supabase
      .from('gg_group_summaries')
      .select('id')
      .eq('group_id', groupId)
      .eq('summary_date', summaryDate)
      .maybeSingle();
    if (existing) {
      return { ok: true, skipped: true, reason: 'already_summarized' };
    }
  }

  // 4. Pull the messages from the window
  const { data: messages, error: msgErr } = await supabase
    .from('wa_messages')
    .select('text, sender_phone, sender_name, received_at')
    .eq('workspace_id', group.workspace_id)
    .eq('group_id', groupId)
    .eq('direction', 'in')
    .not('text', 'is', null)
    .gte('received_at', windowStart)
    .lte('received_at', windowEnd)
    .order('received_at', { ascending: true });

  if (msgErr) {
    return { ok: false, error: `db_error: ${msgErr.message}` };
  }

  const validMessages = (messages || []).filter(
    (m) => typeof m.text === 'string' && m.text.trim().length > 0,
  );

  if (validMessages.length === 0) {
    return {
      ok: true,
      skipped: true,
      reason: 'no_messages',
      total_messages: messages?.length ?? 0,
      text_messages: 0,
      min_required: MIN_TEXT_MESSAGES_FOR_SUMMARY,
    };
  }

  // Heuristic threshold — see MIN_TEXT_MESSAGES_FOR_SUMMARY constant.
  if (validMessages.length < MIN_TEXT_MESSAGES_FOR_SUMMARY) {
    return {
      ok: true,
      skipped: true,
      reason: 'too_few_messages',
      total_messages: messages?.length ?? 0,
      text_messages: validMessages.length,
      min_required: MIN_TEXT_MESSAGES_FOR_SUMMARY,
    };
  }

  // 5. Compute participant count BEFORE sampling (since sampling drops senders)
  const uniqueSenders = new Set(validMessages.map((m) => m.sender_phone));
  const participantCount = uniqueSenders.size;

  // 6. Build the prompt input. If the day was very chatty (>200 msgs), sample
  //    evenly rather than truncating to the first N — we want representation
  //    across the whole day, not just early-morning chat.
  const sampledMessages = sampleMessages(validMessages, 200);
  const conversationText = buildConversationText(sampledMessages);

  // 7. Call the LLM
  const summary = await callOpenAISummary(
    conversationText,
    group.group_name || 'הקבוצה',
    validMessages.length,
    participantCount,
    supabase,
    group.workspace_id,
  );

  if (!summary) {
    return { ok: false, error: 'ai_extraction_failed' };
  }

  // 8. UPSERT into the summaries table (so re-runs replace cleanly)
  const { data: insertedRow, error: insertErr } = await supabase
    .from('gg_group_summaries')
    .upsert(
      {
        workspace_id: group.workspace_id,
        group_id: groupId,
        summary_date: summaryDate,
        context: summary.context ?? null,
        bullets: summary.bullets,
        key_decisions: summary.key_decisions ?? null,
        headline: summary.headline,
        message_count: summary.message_count,
        participant_count: summary.participant_count,
        triggered_by: options.triggeredBy,
        triggered_by_user_id: options.triggeredByUserId ?? null,
      },
      { onConflict: 'group_id,summary_date' },
    )
    .select('id')
    .single();

  if (insertErr || !insertedRow) {
    return { ok: false, error: `insert_failed: ${insertErr?.message}` };
  }

  // 9. Update last_summary_at on the group (separate from the dedupe check
  //    so it reflects the most recent attempt regardless of outcome)
  await supabase
    .from('whatsapp_groups')
    .update({ last_summary_at: new Date().toISOString() })
    .eq('id', groupId);

  // 10. Optional: push to WhatsApp if configured
  if (group.summary_send_to_whatsapp) {
    await deliverViaWhatsApp(supabase, group, insertedRow.id, summary).catch((err) => {
      // Don't fail the whole summary on delivery error — the user can still
      // see it in the dashboard. Just log the error and move on.
      console.error('[GG][summary] whatsapp delivery failed:', err);
    });
  }

  return {
    ok: true,
    summary,
    summary_id: insertedRow.id,
  };
}

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Evenly sample up to N messages from an array. Used when the day is so
 * chatty we'd blow OpenAI's token budget — we want a representative
 * cross-section, not just the first or last N.
 */
function sampleMessages<T>(arr: T[], maxSize: number): T[] {
  if (arr.length <= maxSize) return arr;
  const step = arr.length / maxSize;
  const result: T[] = [];
  for (let i = 0; i < maxSize; i++) {
    result.push(arr[Math.floor(i * step)]);
  }
  return result;
}

/**
 * Render messages as a clean transcript for the LLM. Format:
 *   [HH:MM] שם השולח: טקסט
 * The sender name (or last 4 of phone if unknown) helps the AI attribute
 * topics to specific people in the bullets.
 */
function buildConversationText(
  messages: Array<{ text: string | null; sender_phone: string | null; sender_name: string | null; received_at: string }>,
): string {
  const lines = messages.map((m) => {
    const ts = new Date(m.received_at);
    const hh = String(ts.getHours()).padStart(2, '0');
    const mm = String(ts.getMinutes()).padStart(2, '0');
    const sender = m.sender_name?.trim() || (m.sender_phone ? `…${m.sender_phone.slice(-4)}` : 'משתמש');
    // Cap individual message length to avoid one long forward dominating
    const text = (m.text || '').trim().substring(0, 500);
    return `[${hh}:${mm}] ${sender}: ${text}`;
  });
  // Final cap on total characters as a safety belt
  return lines.join('\n').substring(0, 8000);
}

async function callOpenAISummary(
  conversationText: string,
  groupName: string,
  totalMessages: number,
  uniqueSenders: number,
  // Passed through so we can log token usage to ai_usage_log under
  // feature='group_summary'. Same supabase client the rest of this
  // module uses — log_ai_usage is SECURITY DEFINER so any client works.
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<GroupSummary | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[GG][summary] OPENAI_API_KEY not set, skipping');
    return null;
  }

  const systemPrompt = `אתה מסכם פעילות יומית של קבוצת WhatsApp עבור מישהו שלא קרא את הקבוצה כל היום.

המטרה: לתת לקורא הקשר רחב + מידע מדויק תוך 60 שניות.

כללים:
1. החזר JSON בלבד - אין preamble או הסבר.
2. כתוב בעברית, גוף שלישי.
3. 'context' - פסקה של 2-3 משפטים שמתארת את האווירה הכללית של היום, על מה דובר באופן כללי, מה היה המצב. זה הפריים — מה שהקורא יקרא קודם לפני הנקודות. אם אין באמת אווירה ספציפית (יום שקט, סתם שיחת חולין), אפשר להחזיר string ריק.
4. 'bullets' - 6-10 נקודות מפתח. נקודה = משפט אחד ברור. סדר חשיבות: נושאים שדורשים פעולה > החלטות > דיונים מהותיים > הכרזות > שיחת חולין. אל תכלול ברכות, שיחות חולין, או הודעות אקראיות בלי תוכן.
5. 'key_decisions' - מערך של החלטות או משימות שהוסכמו ("X יעשה Y", "החלטנו ש-Z"). אם אין החלטות, החזר מערך ריק [].
6. אם מישהו ספציפי ביקש משהו, הציג שאלה חשובה, או הביע עמדה — ציין את שמו.
7. הכותרת (headline) - משפט אחד שמסכם את היום בקליפת אגוז.
8. אסור להמציא. אם משהו לא הוזכר - אל תכלול אותו. אם 'context' או 'key_decisions' לא רלוונטיים — תחזיר string ריק / מערך ריק.

החזר אובייקט JSON עם המבנה:
{
  "context": "פסקה של 2-3 משפטים על האווירה והנושאים הכלליים, או string ריק.",
  "headline": "משפט אחד שמסכם את היום",
  "bullets": ["נקודה 1", "נקודה 2", "נקודה 3"],
  "key_decisions": ["החלטה/משימה 1", "החלטה/משימה 2"]
}`;

  const userPrompt = `קבוצה: ${groupName}
${totalMessages} הודעות מ-${uniqueSenders} אנשים ב-24 השעות האחרונות.

תמלול ההודעות:
"""
${conversationText}
"""

החזר את הסיכום ב-JSON:`;

  try {
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
        temperature: 0.3,
        max_tokens: 1400,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '?');
      console.error('[GG][summary] openai err:', response.status, errText);
      return null;
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;

    // Best-effort log to ai_usage_log so this call shows up under
    // feature='group_summary' on the AI usage dashboard. Errors here
    // never break the summary itself — see logAiUsage docs.
    const usage = json.usage || {};
    void logAiUsage({
      supabase,
      workspaceId,
      feature: AI_FEATURES.group_summary,
      provider: 'openai',
      model: 'gpt-4o-mini',
      tokensInput: Number(usage.prompt_tokens) || 0,
      tokensOutput: Number(usage.completion_tokens) || 0,
    });

    return parseSummary(content, totalMessages, uniqueSenders);
  } catch (err) {
    console.error('[GG][summary] exception:', err);
    return null;
  }
}

function parseSummary(
  raw: string,
  messageCount: number,
  participantCount: number,
): GroupSummary | null {
  try {
    const parsed = JSON.parse(raw);
    const headline = typeof parsed.headline === 'string'
      ? parsed.headline.trim().substring(0, 200)
      : '';
    const bullets = Array.isArray(parsed.bullets)
      ? parsed.bullets
        .filter((b: unknown) => typeof b === 'string')
        .map((b: string) => b.trim())
        .filter((b: string) => b.length > 0 && b.length <= 300)
        .slice(0, 10)
      : [];

    if (bullets.length === 0) {
      console.warn('[GG][summary] parsed no bullets from response');
      return null;
    }

    // Optional new fields. The AI is allowed to return empty strings /
    // arrays when nothing applies — we accept that and don't fail. Length
    // caps protect against runaway output blowing up the UI.
    const context = typeof parsed.context === 'string'
      ? parsed.context.trim().substring(0, 800)
      : '';

    const key_decisions = Array.isArray(parsed.key_decisions)
      ? parsed.key_decisions
        .filter((d: unknown) => typeof d === 'string')
        .map((d: string) => d.trim())
        .filter((d: string) => d.length > 0 && d.length <= 300)
        .slice(0, 8)
      : [];

    return {
      context: context || null,
      headline,
      bullets,
      key_decisions: key_decisions.length > 0 ? key_decisions : undefined,
      message_count: messageCount,
      participant_count: participantCount,
    };
  } catch (err) {
    console.error('[GG][summary] parse failed:', err);
    return null;
  }
}

/**
 * Push a generated summary as a WhatsApp message.
 *
 * Target resolution:
 *   - If summary_whatsapp_target is set on the group, send to that number
 *     (DM to a manager — most common case)
 *   - Otherwise send back to the group itself
 *
 * Records success/error timestamps on the summary row so the dashboard
 * can show delivery state.
 */
async function deliverViaWhatsApp(
  supabase: SupabaseClient,
  group: {
    id: string;
    workspace_id: string;
    green_api_chat_id: string;
    group_name: string | null;
    summary_whatsapp_target: string | null;
  },
  summaryId: string,
  summary: GroupSummary,
): Promise<void> {
  // Fetch workspace credentials
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('whatsapp_instance_id, whatsapp_token')
    .eq('id', group.workspace_id)
    .single();

  if (!workspace?.whatsapp_instance_id || !workspace?.whatsapp_token) {
    await supabase
      .from('gg_group_summaries')
      .update({ whatsapp_send_error: 'workspace_credentials_missing' })
      .eq('id', summaryId);
    return;
  }

  // Decide chatId. WhatsApp expects:
  //   - Personal: 972501234567@c.us
  //   - Group:    1234567890-12345@g.us  (this is what's in green_api_chat_id)
  let chatId: string;
  if (group.summary_whatsapp_target) {
    // Strip any non-digits from the phone number, then append @c.us
    const cleaned = group.summary_whatsapp_target.replace(/\D/g, '');
    chatId = `${cleaned}@c.us`;
  } else {
    chatId = group.green_api_chat_id;
  }

  // Format the message — header + bullets, with the group name and date so
  // the recipient knows what it's about even if they get summaries from
  // multiple groups.
  const dateStr = new Date().toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
  const messageText =
    `📋 *סיכום יומי - ${group.group_name || 'הקבוצה'}*\n` +
    `${dateStr}\n\n` +
    (summary.headline ? `${summary.headline}\n\n` : '') +
    summary.bullets.map((b) => `• ${b}`).join('\n') +
    `\n\n_סוכמו ${summary.message_count} הודעות מ-${summary.participant_count} אנשים._`;

  const result = await sendMessage(
    {
      instanceId: workspace.whatsapp_instance_id,
      apiToken: workspace.whatsapp_token,
    },
    chatId,
    messageText,
  );

  if (result.ok) {
    await supabase
      .from('gg_group_summaries')
      .update({ whatsapp_sent_at: new Date().toISOString() })
      .eq('id', summaryId);
  } else {
    await supabase
      .from('gg_group_summaries')
      .update({ whatsapp_send_error: result.error || 'send_failed' })
      .eq('id', summaryId);
  }
}
