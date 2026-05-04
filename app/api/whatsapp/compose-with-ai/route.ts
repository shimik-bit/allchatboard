import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/whatsapp/compose-with-ai
 *
 * Takes a short topic / headline and returns 3 alternative WhatsApp message
 * drafts in Hebrew, ranging in tone (formal / friendly / energetic).
 * Used by the broadcast composer to help admins write quickly without
 * staring at a blank textarea.
 *
 * Body:
 *   {
 *     topic: string (1..500 chars) — short prompt, e.g. "הנחת חורף 20% עד יום שישי"
 *     workspace_id: string — used for membership check + business context
 *     tone?: 'auto' | 'formal' | 'friendly' | 'energetic' — default 'auto' (returns all 3)
 *     length?: 'short' | 'medium' | 'long' — default 'medium' (~ 3-5 lines)
 *   }
 *
 * Returns: { drafts: [{label, body, length_chars}, ...] }
 *
 * Cost: ~50 tokens input + 300 tokens output = $0.0002 per request.
 *
 * Auth: workspace member. We don't gate this to admin/owner because composing
 * is a thinking aid — only the act of pressing Send (broadcast creation) is
 * gated. A regular member playing with the AI doesn't cost much; restricting
 * it would be needlessly paternalistic.
 */

type Tone = 'auto' | 'formal' | 'friendly' | 'energetic';
type Length = 'short' | 'medium' | 'long';

const TONE_DESCRIPTIONS: Record<Exclude<Tone, 'auto'>, { label: string; instruction: string }> = {
  formal: {
    label: 'רשמי',
    instruction: 'נימה רשמית, מקצועית, ללא אמוג׳ים. מתאים להודעות עסקיות, לקוחות B2B.',
  },
  friendly: {
    label: 'ידידותי',
    instruction: 'נימה חמה, אישית, אמוג׳י אחד או שניים במקומות מתאימים. מתאים לקבוצות לקוחות, קהילה.',
  },
  energetic: {
    label: 'אנרגטי',
    instruction: 'נימה דינמית, חיובית, אמוג׳ים, סימני קריאה. מתאים לקמפיינים, מבצעים, השקות.',
  },
};

const LENGTH_INSTRUCTIONS: Record<Length, string> = {
  short: '1-2 שורות. ישר לעניין, ללא מבוא.',
  medium: '3-5 שורות. כותרת + תוכן + קריאה לפעולה.',
  long: '6-10 שורות. כולל פירוט, יתרונות, וקריאה לפעולה ברורה.',
};

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // ----- Validation -----
  const topic = typeof body?.topic === 'string' ? body.topic.trim() : '';
  const workspaceId = typeof body?.workspace_id === 'string' ? body.workspace_id : '';
  const tone: Tone = ['auto', 'formal', 'friendly', 'energetic'].includes(body?.tone) ? body.tone : 'auto';
  const length: Length = ['short', 'medium', 'long'].includes(body?.length) ? body.length : 'medium';

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }
  if (!topic) {
    return NextResponse.json({ error: 'topic required' }, { status: 400 });
  }
  if (topic.length > 500) {
    return NextResponse.json(
      { error: 'topic too long (max 500 chars). Try summarizing it.' },
      { status: 400 }
    );
  }

  // ----- Membership check -----
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: 'workspace not found' }, { status: 404 });
  }

  // ----- Optional business context to make drafts more relevant -----
  // If the workspace has a business_description (e.g. "studio for fitness
  // classes"), feed that to the AI so the tone matches the brand. Missing
  // is fine — the AI defaults to a generic professional voice.
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name, business_description')
    .eq('id', workspaceId)
    .single();

  // ----- Build the prompt -----
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI is not configured on this server' }, { status: 503 });
  }

  // Decide which tones to generate. 'auto' = all three; specific = just one (3 variants of it)
  const tonesToGenerate: Array<keyof typeof TONE_DESCRIPTIONS> =
    tone === 'auto'
      ? ['formal', 'friendly', 'energetic']
      : [tone];

  const businessContext = workspace?.business_description
    ? `\nההקשר העסקי: ${workspace.business_description}`
    : '';

  // We ask for one model call that returns all variants in JSON. Cheaper and
  // faster than 3 separate calls. The model is instructed to keep each variant
  // tight (under 800 chars) so we don't hit WhatsApp's 4096 limit accidentally.
  const systemPrompt = `אתה כותב הודעות WhatsApp בעברית עבור עסקים שמפרסמים בקבוצות.
המשתמש נותן לך נושא קצר ואתה מחזיר ${tonesToGenerate.length === 1 ? '3 גרסאות באותה נימה אבל עם זוויות שונות' : `${tonesToGenerate.length} גרסאות, כל אחת בנימה שונה`}.

חוקים חשובים:
- כתוב בעברית טבעית, ללא תרגום מילולי מאנגלית
- אורך כל גרסה: ${LENGTH_INSTRUCTIONS[length]}
- אל תכתוב "הודעה X:" או כותרות מטא — רק הטקסט עצמו
- שמור על הטקסט מתחת ל-800 תווים
- אל תוסיף קישורים אם הם לא בנושא המקורי${businessContext}

החזר תשובה ב-JSON תקני עם המבנה:
{
  "drafts": [
    { "label": "תווית קצרה (2-3 מילים)", "body": "טקסט ההודעה המלא" }
  ]
}`;

  const userPrompt = `נושא: ${topic}

${tonesToGenerate.length === 1
  ? `נימה: ${TONE_DESCRIPTIONS[tonesToGenerate[0]].label} (${TONE_DESCRIPTIONS[tonesToGenerate[0]].instruction})\n3 גרסאות שונות באותה נימה — נסה זוויות שונות (יתרון פרקטי, חיבור רגשי, FOMO/דחיפות).`
  : tonesToGenerate.map(t => `- ${TONE_DESCRIPTIONS[t].label}: ${TONE_DESCRIPTIONS[t].instruction}`).join('\n')
}`;

  // ----- Call OpenAI -----
  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8, // Some creativity, but not chaotic
      max_tokens: 1200, // ~3 variants × 400 tokens worst case
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: 'AI returned no content' }, { status: 502 });
    }

    let parsed: { drafts?: Array<{ label: string; body: string }> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: 'AI returned invalid JSON', raw },
        { status: 502 }
      );
    }

    if (!Array.isArray(parsed.drafts) || parsed.drafts.length === 0) {
      return NextResponse.json({ error: 'AI returned no drafts' }, { status: 502 });
    }

    // Cap each draft at 4096 chars (the WhatsApp message limit) just in case
    // the model went overboard. Also strip any trailing whitespace.
    const drafts = parsed.drafts
      .filter((d) => d && typeof d.label === 'string' && typeof d.body === 'string')
      .map((d) => ({
        label: d.label.trim().slice(0, 50),
        body: d.body.trim().slice(0, 4096),
        length_chars: d.body.trim().length,
      }))
      .filter((d) => d.body.length > 0);

    if (drafts.length === 0) {
      return NextResponse.json({ error: 'AI drafts were all empty' }, { status: 502 });
    }

    return NextResponse.json({ drafts });
  } catch (err: any) {
    // Two common modes here: rate limit (429) and bad API key (401). Surface
    // them clearly so the user knows whether to retry or check env vars.
    const status = err?.status || 500;
    const message =
      status === 429
        ? 'AI מעמיס כרגע — נסה שוב בעוד כמה שניות'
        : status === 401
          ? 'AI לא מחובר נכון בשרת'
          : err?.message || 'AI שגיאה';
    return NextResponse.json({ error: message }, { status: status === 429 ? 429 : 500 });
  }
}
