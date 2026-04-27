import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/knowledge/answer
 * Body: { workspace_id, customer_phone, customer_name?, query, green_api_message_id? }
 *
 * Called by the WhatsApp webhook when an external customer asks a question.
 * Pipeline:
 *   1. RPC build_knowledge_bot_prompt → system prompt + matched sources
 *   2. POST to OpenAI / Anthropic (whichever has a key)
 *   3. Save inbound + outbound messages to knowledge_messages
 *   4. Return the answer for the caller to send via WhatsApp
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { workspace_id, customer_phone, customer_name, query, green_api_message_id } = body;

  if (!workspace_id || !customer_phone || !query) {
    return NextResponse.json({ error: 'workspace_id, customer_phone, query required' }, { status: 400 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // 1. Build prompt from DB
  const { data: promptData, error: promptError } = await service
    .rpc('build_knowledge_bot_prompt', { p_workspace_id: workspace_id, p_customer_query: query });

  if (promptError) return NextResponse.json({ error: promptError.message }, { status: 500 });
  if (!promptData || (promptData as any).error) {
    return NextResponse.json({ error: (promptData as any)?.error || 'Bot not configured' }, { status: 400 });
  }

  const data = promptData as any;
  const sourceIds: string[] = data.source_ids || [];
  const hasSources = (data.source_count || 0) > 0;

  // 2. Save inbound message
  await service.rpc('save_knowledge_conversation_message', {
    p_workspace_id: workspace_id,
    p_bot_id: data.bot_id,
    p_customer_phone: customer_phone,
    p_customer_name: customer_name || null,
    p_direction: 'inbound',
    p_text: query,
    p_green_api_message_id: green_api_message_id || null,
  });

  let answerText = '';
  let aiTokensInput = 0;
  let aiTokensOutput = 0;
  let aiCost = 0;
  let wasFallback = false;
  let providerUsed = '';
  let modelUsed = '';

  if (!hasSources) {
    // Pull bot's fallback message
    const { data: botRow } = await service
      .from('knowledge_bots').select('fallback_message').eq('id', data.bot_id).maybeSingle();
    answerText = botRow?.fallback_message || 'מצטער, אין לי תשובה לשאלה הזו.';
    wasFallback = true;
  } else {
    // 3. Call AI - prefer OpenAI (set up), fall back to Anthropic
    const useOpenAI = !!process.env.OPENAI_API_KEY;
    const useAnthropic = !!process.env.ANTHROPIC_API_KEY;

    if (!useOpenAI && !useAnthropic) {
      const { data: botRow } = await service
        .from('knowledge_bots').select('fallback_message').eq('id', data.bot_id).maybeSingle();
      answerText = botRow?.fallback_message || 'מצטער, נתקלתי בבעיה. אעביר אותך לנציג בהקדם.';
      wasFallback = true;
    } else if (useOpenAI) {
      // Use OpenAI (gpt-4o-mini is fast + cheap, perfect for this use case)
      try {
        providerUsed = 'openai';
        modelUsed = 'gpt-4o-mini';
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: data.ai_max_tokens || 600,
            temperature: Number(data.ai_temperature) || 0.3,
            messages: [
              { role: 'system', content: data.system_prompt },
              { role: 'user', content: query },
            ],
          }),
        });
        const json = await res.json();

        if (json.choices && json.choices[0]?.message?.content) {
          answerText = json.choices[0].message.content;
        }

        aiTokensInput = json.usage?.prompt_tokens || 0;
        aiTokensOutput = json.usage?.completion_tokens || 0;
        // gpt-4o-mini pricing: $0.15/M input, $0.60/M output
        aiCost = (aiTokensInput / 1_000_000 * 0.15) + (aiTokensOutput / 1_000_000 * 0.60);

        if (!answerText) {
          answerText = 'מצטער, נתקלתי בבעיה. אעביר אותך לנציג בהקדם.';
          wasFallback = true;
        }
      } catch (err: any) {
        console.error('[knowledge-bot] OpenAI error:', err);
        answerText = 'מצטער, נתקלתי בבעיה. אעביר אותך לנציג בהקדם.';
        wasFallback = true;
      }
    } else {
      // Anthropic
      try {
        providerUsed = 'anthropic';
        modelUsed = data.ai_model || 'claude-sonnet-4-5';
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: modelUsed,
            max_tokens: data.ai_max_tokens || 600,
            temperature: Number(data.ai_temperature) || 0.3,
            system: data.system_prompt,
            messages: [{ role: 'user', content: query }],
          }),
        });
        const json = await res.json();

        if (json.content && Array.isArray(json.content)) {
          answerText = json.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text).join('\n');
        }

        aiTokensInput = json.usage?.input_tokens || 0;
        aiTokensOutput = json.usage?.output_tokens || 0;
        aiCost = (aiTokensInput / 1_000_000 * 3) + (aiTokensOutput / 1_000_000 * 15);

        if (!answerText) {
          answerText = 'מצטער, נתקלתי בבעיה. אעביר אותך לנציג בהקדם.';
          wasFallback = true;
        }
      } catch (err: any) {
        console.error('[knowledge-bot] Anthropic error:', err);
        answerText = 'מצטער, נתקלתי בבעיה. אעביר אותך לנציג בהקדם.';
        wasFallback = true;
      }
    }
  }

  // 4. Save outbound message
  await service.rpc('save_knowledge_conversation_message', {
    p_workspace_id: workspace_id,
    p_bot_id: data.bot_id,
    p_customer_phone: customer_phone,
    p_customer_name: customer_name || null,
    p_direction: 'outbound',
    p_text: answerText,
    p_ai_provider: providerUsed || null,
    p_ai_model: modelUsed || null,
    p_ai_tokens_input: aiTokensInput,
    p_ai_tokens_output: aiTokensOutput,
    p_ai_cost_usd: aiCost,
    p_sources_used: sourceIds,
    p_was_fallback: wasFallback,
  });

  // 5. Increment counters
  await service.rpc('increment_bot_message_count', {
    p_bot_id: data.bot_id,
    p_was_answered: !wasFallback,
  });

  return NextResponse.json({
    answer: answerText,
    sources_used: sourceIds.length,
    was_fallback: wasFallback,
    bot_id: data.bot_id,
    provider: providerUsed,
    model: modelUsed,
  });
}
