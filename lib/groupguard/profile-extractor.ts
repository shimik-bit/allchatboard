/**
 * Member Profile AI Extractor
 * ============================
 * Analyzes a member's recent messages and updates their profile fields.
 *
 * Strategy: cumulative refinement
 *   - Don't overwrite existing fields with empty values
 *   - Each run can refine/expand what's known
 *   - Cost-aware: only run when there's enough new data
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Types
// ============================================================================

export interface ExtractedProfile {
  full_name?: string | null;
  profession?: string | null;
  specialization?: string | null;
  business_name?: string | null;
  business_type?: string | null;
  websites?: string[];
  social_handles?: Record<string, string>;
  city?: string | null;
  skills?: string[];
  interests?: string[];
  languages?: string[];
  bio?: string | null;
  notable_topics?: string[];
}


// ============================================================================
// Main extraction function
// ============================================================================

/**
 * Process a single member: pull their recent messages, extract a profile,
 * merge with existing profile, save back.
 *
 * Returns true if profile was updated, false if skipped.
 */
export async function extractProfileForMember(
  supabase: SupabaseClient,
  profileId: string,
): Promise<boolean> {
  // Load current profile
  const { data: profile, error: profileErr } = await supabase
    .from('gg_member_profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (profileErr || !profile) {
    console.error('[GG][extract] profile not found:', profileId);
    return false;
  }

  // Skip if very recently extracted (less than 1 hour ago) and few new messages
  if (profile.last_extracted_at) {
    const hoursSince = (Date.now() - new Date(profile.last_extracted_at).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 1) {
      return false;
    }
  }

  // Pull recent messages from this member (last 50 messages, last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: messages, error: msgErr } = await supabase
    .from('wa_messages')
    .select('text, received_at')
    .eq('workspace_id', profile.workspace_id)
    .eq('sender_phone', profile.phone)
    .not('text', 'is', null)
    .gte('received_at', thirtyDaysAgo)
    .order('received_at', { ascending: false })
    .limit(50);

  if (msgErr) {
    console.error('[GG][extract] failed to load messages:', msgErr);
    return false;
  }

  // Need at least 3 messages with text to do meaningful extraction
  const textMessages = (messages || []).filter((m) => m.text && m.text.trim().length > 5);
  if (textMessages.length < 3) {
    // Just update last_extracted_at to avoid retry storms
    await supabase
      .from('gg_member_profiles')
      .update({ last_extracted_at: new Date().toISOString() })
      .eq('id', profileId);
    return false;
  }

  // Call OpenAI to extract
  const extracted = await callOpenAIExtraction(textMessages, profile);
  if (!extracted) {
    return false;
  }

  // Merge extracted with existing - don't overwrite with nulls/empty
  const merged = mergeProfile(profile, extracted);

  // Save merged profile
  const { error: updateErr } = await supabase
    .from('gg_member_profiles')
    .update({
      ...merged,
      last_extracted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', profileId);

  if (updateErr) {
    console.error('[GG][extract] failed to update profile:', updateErr);
    return false;
  }

  // Recalculate completeness
  const { data: completenessRes } = await supabase
    .rpc('gg_calculate_profile_completeness', { p_profile_id: profileId });

  if (typeof completenessRes === 'number') {
    await supabase
      .from('gg_member_profiles')
      .update({ completeness_pct: completenessRes })
      .eq('id', profileId);
  }

  return true;
}


// ============================================================================
// OpenAI extraction
// ============================================================================

async function callOpenAIExtraction(
  messages: Array<{ text: string; received_at: string }>,
  existingProfile: any,
): Promise<ExtractedProfile | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  // Concatenate messages with separators
  const messageText = messages
    .map((m, i) => `[${i + 1}] ${m.text}`)
    .join('\n')
    .substring(0, 6000); // cap at ~6000 chars to control cost

  const systemPrompt = `אתה מחלץ פרטי פרופיל מהודעות WhatsApp של אדם בקבוצה.
המטרה: לבנות תמונה מקצועית עליו - שם, מקצוע, עסק, התמחות, אתרים, ערים, וכו'.

חוקים חשובים:
1. החזר JSON בלבד - אסור preamble או הסבר.
2. אם אינך בטוח לגבי שדה - השאר אותו null.
3. אל תמציא מידע. רק מה שכתוב מפורשות בהודעות.
4. רק 1-2 משפטים ל-bio.
5. skills/interests = עד 5 פריטים כל אחד, בעברית.

החזר אובייקט JSON עם המבנה הבא בדיוק:
{
  "full_name": null או "שם מלא",
  "profession": null או "מקצוע (למשל: עורך דין, מתכנת, רופא)",
  "specialization": null או "תחום התמחות ספציפי",
  "business_name": null או "שם העסק/מיזם",
  "business_type": null או "סוג עסק",
  "websites": [] או ["url1", "url2"],
  "social_handles": {} או {"instagram": "@user", "linkedin": "url"},
  "city": null או "עיר/אזור",
  "skills": [] או ["כישור1", "כישור2"],
  "interests": [] או ["תחום1", "תחום2"],
  "languages": [] או ["עברית", "אנגלית"],
  "bio": null או "סיכום של 1-2 משפטים",
  "notable_topics": [] או ["נושא1", "נושא2"]
}`;

  const userPrompt = `${
    existingProfile.full_name || existingProfile.profession
      ? `מידע קיים: ${JSON.stringify({
          full_name: existingProfile.full_name,
          profession: existingProfile.profession,
          business_name: existingProfile.business_name,
        })}\n\n`
      : ''
  }הודעות שלו (מקבוצות וואטסאפ):
"""
${messageText}
"""

החזר את הפרופיל ב-JSON:`;

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
        temperature: 0.2,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '?');
      console.error('[GG][extract] openai err:', response.status, errText);
      return null;
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;

    return parseExtraction(content);
  } catch (err) {
    console.error('[GG][extract] exception:', err);
    return null;
  }
}


function parseExtraction(raw: string): ExtractedProfile | null {
  try {
    const parsed = JSON.parse(raw);

    return {
      full_name: cleanString(parsed.full_name),
      profession: cleanString(parsed.profession),
      specialization: cleanString(parsed.specialization),
      business_name: cleanString(parsed.business_name),
      business_type: cleanString(parsed.business_type),
      websites: cleanArray(parsed.websites, 10, 200),
      social_handles: cleanObject(parsed.social_handles, 10, 200),
      city: cleanString(parsed.city),
      skills: cleanArray(parsed.skills, 8, 60),
      interests: cleanArray(parsed.interests, 8, 60),
      languages: cleanArray(parsed.languages, 5, 30),
      bio: cleanString(parsed.bio, 300),
      notable_topics: cleanArray(parsed.notable_topics, 8, 60),
    };
  } catch (err) {
    console.error('[GG][extract] parse failed:', err);
    return null;
  }
}


function cleanString(v: unknown, maxLen = 200): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.toLowerCase() === 'null') return null;
  return trimmed.substring(0, maxLen);
}


function cleanArray(v: unknown, maxItems: number, maxItemLen: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === 'string')
    .map((x) => x.trim())
    .filter((x) => x.length > 0 && x.length <= maxItemLen)
    .slice(0, maxItems);
}


function cleanObject(
  v: unknown,
  maxKeys: number,
  maxValLen: number,
): Record<string, string> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
  const result: Record<string, string> = {};
  let count = 0;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (count >= maxKeys) break;
    if (typeof val === 'string' && val.trim().length > 0) {
      result[k.trim().substring(0, 30)] = val.trim().substring(0, maxValLen);
      count++;
    }
  }
  return result;
}


// ============================================================================
// Merge logic - never overwrite existing data with nothing
// ============================================================================

function mergeProfile(existing: any, incoming: ExtractedProfile): Record<string, any> {
  const result: Record<string, any> = {};

  // Strings: take incoming if non-null, else keep existing
  const stringFields: Array<keyof ExtractedProfile> = [
    'full_name', 'profession', 'specialization', 'business_name',
    'business_type', 'city', 'bio',
  ];
  for (const field of stringFields) {
    const incomingVal = incoming[field] as string | null | undefined;
    if (incomingVal && typeof incomingVal === 'string') {
      result[field] = incomingVal;
    }
    // If no incoming value, keep what's there (no DB write needed)
  }

  // Arrays: union of existing + incoming, deduplicated
  const arrayFields: Array<keyof ExtractedProfile> = [
    'websites', 'skills', 'interests', 'languages', 'notable_topics',
  ];
  for (const field of arrayFields) {
    const incomingArr = (incoming[field] as string[] | undefined) || [];
    const existingArr = (existing[field] as string[] | null) || [];
    if (incomingArr.length > 0 || existingArr.length > 0) {
      const merged = Array.from(new Set([...existingArr, ...incomingArr]))
        .filter((x) => typeof x === 'string' && x.length > 0)
        .slice(0, 15);
      result[field] = merged;
    }
  }

  // Object: merge
  if (incoming.social_handles && Object.keys(incoming.social_handles).length > 0) {
    result.social_handles = {
      ...(existing.social_handles || {}),
      ...incoming.social_handles,
    };
  }

  return result;
}
