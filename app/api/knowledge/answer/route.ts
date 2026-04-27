import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/knowledge/answer
 * Body: { workspace_id, customer_phone, customer_name?, query, green_api_message_id? }
 * 
 * The webhook calls this when an external customer message arrives at a workspace.
 * We:
 * 1. Build a prompt with relevant sources
 * 2. Send to Claude/OpenAI
 * 3. Save the conversation
 * 4. Return the answer (caller will send via WhatsApp)
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

  // Build prompt with relevant sources from DB
  const { data: promptData, error: promptError } = await service
    .rpc('build_knowledge_bot_prompt', { p_workspace_id: workspace_id, p_customer_query: query });

  if (promptError) return NextResponse.json({ error: promptError.message }, { status: 500 });
  if (!promptData || (promptData as any).error) {
    return NextResponse.json({ error: (promptData as any)?.error || 'Bot not configured' }, { status: 400 });
  }

  const data = promptData as any;
  const sourceIds: string[] = data.source_ids || [];
  const hasSources = (data.source_count || 0) > 0;

  // Save inbound message
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

  if (!hasSources) {
    // Pull bot's fallback message
    const { data: botRow } = await service
      .from('knowledge_bots').select('fallback_message').eq('id', data.bot_id).maybeSingle();
    answerText = botRow?.fallback_message || 'מצטער, אין לי תשובה לשאלה הזו.';
    wasFallback = true;
  } else {
    // Call Claude
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: data.ai_model || 'claude-sonnet-4-5',
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
      // Claude Sonnet pricing: $3/M input, $15/M output
      aiCost = (aiTokensInput / 1_000_000 * 3) + (aiTokensOutput / 1_000_000 * 15);
      
      if (!answerText) {
        answerText = 'מצטער, נתקלתי בבעיה. אעביר אותך לנציג בהקדם.';
        wasFallback = true;
      }
    } catch (err: any) {
      console.error('AI error:', err);
      answerText = 'מצטער, נתקלתי בבעיה. אעביר אותך לנציג בהקדם.';
      wasFallback = true;
    }
  }

  // Save outbound
  await service.rpc('save_knowledge_conversation_message', {
    p_workspace_id: workspace_id,
    p_bot_id: data.bot_id,
    p_customer_phone: customer_phone,
    p_customer_name: customer_name || null,
    p_direction: 'outbound',
    p_text: answerText,
    p_ai_provider: 'anthropic',
    p_ai_model: data.ai_model,
    p_ai_tokens_input: aiTokensInput,
    p_ai_tokens_output: aiTokensOutput,
    p_ai_cost_usd: aiCost,
    p_sources_used: sourceIds,
    p_was_fallback: wasFallback,
  });

  // Increment bot counters
  await service.rpc('increment_bot_message_count', {
    p_bot_id: data.bot_id,
    p_was_answered: !wasFallback,
  });

  return NextResponse.json({
    answer: answerText,
    sources_used: sourceIds.length,
    was_fallback: wasFallback,
    bot_id: data.bot_id,
  });
}
