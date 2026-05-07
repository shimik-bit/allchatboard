/**
 * AI usage logging
 * ================
 *
 * Thin wrapper around the log_ai_usage Postgres RPC. Every OpenAI / LLM
 * call in the app should pipe through this so we can:
 *   1. Show users a breakdown of WHERE their AI quota went (this is the
 *      direct user request — see app/dashboard/ai-usage/AIUsageClient).
 *   2. Track per-feature costs for product decisions (which features
 *      actually justify their token budget).
 *   3. Properly attribute wallet charges (the RPC also debits the
 *      ai_wallets table when it's been initialized).
 *
 * Until now only the knowledge_bot endpoint called log_ai_usage. The
 * rest (group summaries, profile extraction, spam classifier, focus
 * briefing, excel-import analyze, compose-with-ai, lead routing in the
 * whatsapp webhook) were silent — costs were real but invisible. This
 * helper standardizes the call so adding a new AI feature just means
 * importing one function.
 *
 * IMPORTANT: log calls are best-effort fire-and-forget by default. We
 * do NOT want a logging failure to break the actual feature. The RPC
 * has its own try/catch and returns an error JSON; we swallow errors
 * here too. If the caller wants the result (e.g. the knowledge bot
 * surfaces cost back to the customer), they can pass throwOnError:true.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The canonical set of feature identifiers. Keep this enum-like so we
 * have ONE place to look at "what's being tracked". The values are
 * written to ai_usage_log.feature verbatim and shown in the UI via the
 * FEATURE_LABELS map below.
 */
export const AI_FEATURES = {
  /** GroupGuard: AI classification of incoming messages as spam/safe. */
  spam_classification: 'spam_classification',
  /** GroupGuard: daily group conversation summary. */
  group_summary: 'group_summary',
  /** GroupGuard: profile field extraction from a member's message history. */
  profile_extraction: 'profile_extraction',
  /** Inbox/Hub: WhatsApp webhook message understanding + routing to CRM/lead/etc. */
  lead_routing: 'lead_routing',
  /** Excel import: schema/column inference for an uploaded spreadsheet. */
  excel_analysis: 'excel_analysis',
  /** WhatsApp compose: AI-drafted reply suggestions. */
  message_compose: 'message_compose',
  /** Focus mode: morning briefing generated from yesterday's activity. */
  focus_briefing: 'focus_briefing',
  /** Knowledge bot: customer-facing Q&A over knowledge base. */
  knowledge_bot: 'knowledge_bot',
} as const;

export type AIFeature = (typeof AI_FEATURES)[keyof typeof AI_FEATURES];

/**
 * Hebrew labels for the UI. English fallback handled at render time so
 * Locales other than 'he' can still show something readable.
 */
export const FEATURE_LABELS_HE: Record<AIFeature, string> = {
  spam_classification: 'סינון ספאם בקבוצות',
  group_summary: 'סיכום יומי של קבוצות',
  profile_extraction: 'חילוץ פרופילים של חברי קבוצה',
  lead_routing: 'ניתוב הודעות וזיהוי לידים',
  excel_analysis: 'ניתוח קבצי Excel בייבוא',
  message_compose: 'ניסוח תשובות עם AI',
  focus_briefing: 'תדריך בוקר (Focus)',
  knowledge_bot: 'בוט שאלות ותשובות',
};

export const FEATURE_LABELS_EN: Record<AIFeature, string> = {
  spam_classification: 'Group spam classification',
  group_summary: 'Daily group summaries',
  profile_extraction: 'Member profile extraction',
  lead_routing: 'Message routing & lead detection',
  excel_analysis: 'Excel import analysis',
  message_compose: 'AI compose suggestions',
  focus_briefing: 'Morning briefing (Focus)',
  knowledge_bot: 'Knowledge Q&A bot',
};

/**
 * Per-feature short descriptions — shown as a hover tooltip / subtitle
 * in the UI so users know what each feature actually does to their wallet.
 */
export const FEATURE_DESCRIPTIONS_HE: Record<AIFeature, string> = {
  spam_classification:
    'הבוט שולח כל הודעה נכנסת מקבוצה מנוטרת ל-AI כדי להחליט אם היא ספאם.',
  group_summary:
    'פעם ביום, AI קורא את כל ההודעות מהקבוצה ומחזיר תקציר עם נקודות מפתח והקשר.',
  profile_extraction:
    'AI מנתח את ההודעות של חבר קבוצה כדי להוציא מקצוע, עסק, מיקום והתמחויות.',
  lead_routing:
    'הודעה נכנסת מטופלת ע"י AI שמחליט לאיזו טבלה / זרימת עבודה היא שייכת.',
  excel_analysis:
    'בייבוא Excel, AI מזהה כותרות עמודות וממפה אותן לשדות הטבלה.',
  message_compose:
    'כשאתה מבקש מהמערכת לנסח תשובה, AI כותב לך כמה אופציות.',
  focus_briefing:
    'מסך Focus מקבל תקציר בוקר של מה שקרה אתמול ומה דחוף היום.',
  knowledge_bot:
    'בוט שעונה על שאלות לקוחות מתוך מאגר הידע שהוגדר.',
};

export type LogAiUsageInput = {
  /**
   * A Supabase client with permission to call log_ai_usage. The function
   * is SECURITY DEFINER so any client (anon, authed, service) works,
   * but typically callers have a service-role client at hand for the
   * underlying feature already.
   */
  supabase: SupabaseClient;
  workspaceId: string;
  feature: AIFeature;
  /** e.g. 'openai' or 'anthropic'. The RPC uses this to pick pricing. */
  provider: string;
  /** e.g. 'gpt-4o-mini'. The RPC uses this to pick pricing. */
  model: string;
  tokensInput: number;
  tokensOutput: number;
  /** Optional: ties this AI call to a domain entity (e.g. a summary id, message id). */
  referenceType?: string | null;
  referenceId?: string | null;
  /**
   * Default false. When true, throws on RPC errors rather than swallowing.
   * Use only when the caller actively cares about the cost result (e.g.
   * billing-display surfaces it back to the customer).
   */
  throwOnError?: boolean;
};

export type LogAiUsageResult = {
  log_id: string;
  cost_usd: number;
  cost_ils: number;
  charged_ils: number;
  is_overage: boolean;
  messages_this_month: number;
  quota: number;
  wallet?: unknown;
} | null;

/**
 * Record an AI call to ai_usage_log. Returns the cost details, or null
 * on a swallowed error (when throwOnError is false, the default).
 *
 * Tokens of zero are still recorded — a 0-token call still costs
 * a request-level fee with some providers, and we want the count
 * regardless. The RPC handles 0 gracefully.
 */
export async function logAiUsage(
  input: LogAiUsageInput,
): Promise<LogAiUsageResult> {
  const {
    supabase,
    workspaceId,
    feature,
    provider,
    model,
    tokensInput,
    tokensOutput,
    referenceType = null,
    referenceId = null,
    throwOnError = false,
  } = input;

  try {
    const { data, error } = await supabase.rpc('log_ai_usage', {
      p_workspace_id: workspaceId,
      p_feature: feature,
      p_ai_provider: provider,
      p_ai_model: model,
      p_tokens_input: tokensInput,
      p_tokens_output: tokensOutput,
      p_reference_type: referenceType,
      p_reference_id: referenceId,
    });

    if (error) {
      if (throwOnError) throw error;
      console.error(`[ai-usage] log failed feature=${feature}:`, error);
      return null;
    }

    return (data as LogAiUsageResult) || null;
  } catch (err) {
    if (throwOnError) throw err;
    console.error(`[ai-usage] log threw feature=${feature}:`, err);
    return null;
  }
}
