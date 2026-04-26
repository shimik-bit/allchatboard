import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getTemplate } from '@/lib/reports/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/reports/preview
 * Body: { workspace_id, template_type, template_config, table_ids }
 *
 * Generates the report message without sending. Used by the UI to show
 * a live preview as the user is configuring the report.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { workspace_id, template_type, template_config, table_ids } = body;

  // Verify membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .single();

  if (!membership) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const template = getTemplate(template_type);
  if (!template) {
    return NextResponse.json({ error: `Unknown template: ${template_type}` }, { status: 400 });
  }

  try {
    const generated = await template.generate(
      supabase as any,
      workspace_id,
      template_config || {},
      Array.isArray(table_ids) && table_ids.length > 0 ? table_ids : null
    );

    return NextResponse.json({
      message: generated.message,
      isEmpty: generated.isEmpty,
      recordCount: generated.recordCount,
      template: {
        id: template.id,
        name: template.name,
        icon: template.icon,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'preview failed' }, { status: 500 });
  }
}
