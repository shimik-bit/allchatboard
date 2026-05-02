import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/plans/upload
 *
 * Registers a construction plan in the DB AFTER the file has been uploaded
 * to Supabase Storage by the client. We do this client-side direct upload
 * pattern (instead of multipart-through-the-API) because:
 *   1. Vercel serverless functions have a 4.5MB body limit
 *   2. Plans can be 10-50MB PDFs
 *   3. RLS on storage.objects already enforces workspace isolation
 *
 * Body (JSON):
 *   - workspace_id: UUID
 *   - project_id: UUID (optional - record id from the projects table)
 *   - file_name: string
 *   - file_path: string  (the path in the construction-plans bucket)
 *   - file_size_bytes: number
 *   - file_type: 'pdf' | 'image' | 'dwg'
 *
 * Response:
 *   { plan_id: string, status: 'uploaded' }
 */

type UploadBody = {
  workspace_id?: string;
  project_id?: string | null;
  file_name?: string;
  file_path?: string;
  file_size_bytes?: number;
  file_type?: string;
};

const ALLOWED_TYPES = ['pdf', 'image', 'dwg'] as const;
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: UploadBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { workspace_id, project_id, file_name, file_path, file_size_bytes, file_type } = body;

  // Validation
  if (!workspace_id || !file_name || !file_path || !file_type || typeof file_size_bytes !== 'number') {
    return NextResponse.json(
      { error: 'workspace_id, file_name, file_path, file_size_bytes, file_type are required' },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.includes(file_type as typeof ALLOWED_TYPES[number])) {
    return NextResponse.json({ error: 'invalid_file_type' }, { status: 400 });
  }

  if (file_size_bytes > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 400 });
  }

  // Verify the path starts with the workspace_id (defense-in-depth in addition to storage RLS)
  if (!file_path.startsWith(`${workspace_id}/`)) {
    return NextResponse.json({ error: 'invalid_file_path' }, { status: 400 });
  }

  // Verify membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership || !['owner', 'admin', 'editor'].includes((membership as { role: string }).role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Build public(ish) URL — bucket is private but we expose the storage path so
  // the analyze edge function can fetch it via service role.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const file_url = `${supabaseUrl}/storage/v1/object/authenticated/construction-plans/${file_path}`;

  const admin = createAdminClient();
  const { data: plan, error: insertError } = await admin
    .from('construction_plans')
    .insert({
      workspace_id,
      project_id: project_id || null,
      file_name,
      file_path,
      file_url,
      file_type,
      file_size_bytes,
      status: 'uploaded',
      uploaded_by: user.id,
    })
    .select('id, status')
    .single();

  if (insertError || !plan) {
    console.error('[plans/upload] insert failed:', insertError);
    return NextResponse.json({ error: 'insert_failed', details: insertError?.message }, { status: 500 });
  }

  const planRow = plan as { id: string; status: string };

  return NextResponse.json({
    plan_id: planRow.id,
    status: planRow.status,
  });
}
