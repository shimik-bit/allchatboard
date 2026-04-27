import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { gatherFocusContext } from '@/lib/focus/context-gathering';
import { generateFocusBriefing } from '@/lib/focus/ai-briefing';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const workspaceId = body.workspace_id as string;
  const userPrompt = (body.prompt as string) || 'תפקס אותי - מה לעשות היום?';

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
  }

  // Verify membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
  }

  // Use service role for context gathering (need access to all tables)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 500 });
  }

  try {
    const context = await gatherFocusContext(serviceClient, user.id, workspaceId);

    const { briefing, tokensInput, tokensOutput, costUsd } = await generateFocusBriefing(
      context,
      userPrompt,
      apiKey
    );

    // Save the session
    const { data: session } = await serviceClient
      .from('focus_sessions')
      .insert({
        workspace_id: workspaceId,
        user_id: user.id,
        source: 'manual',
        user_prompt: userPrompt,
        ai_response: briefing,
        context_snapshot: { stats: context.stats, table_count: context.tables.length },
        tokens_input: tokensInput,
        tokens_output: tokensOutput,
        model_used: 'gpt-4o-mini',
        cost_usd: costUsd,
      })
      .select('id')
      .single();

    return NextResponse.json({
      session_id: session?.id,
      briefing,
      stats: context.stats,
    });
  } catch (err: any) {
    console.error('Focus briefing error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate briefing' },
      { status: 500 }
    );
  }
}
