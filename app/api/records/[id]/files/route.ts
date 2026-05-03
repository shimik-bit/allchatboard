import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * /api/records/[id]/files — multi-file documents folder for a record.
 *
 * GET   → list files attached to the record
 * POST  → upload a new file (FormData: file, optional description)
 *
 * Storage layout:
 *   bucket: record-files (private)
 *   path:   {workspace_id}/{record_id}/{uuid}-{sanitized-filename}
 *
 * The route uploads through the admin client (service role), so it bypasses
 * the bucket's RLS for writes. Reads still go through workspace-membership
 * RLS on the storage.objects policies, plus our own check below.
 */

const BUCKET = 'record-files';
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

// File-name sanitization: strip path separators, control chars, and reserved
// chars. Preserves the extension. Falls back to "file" if the name becomes
// empty after sanitization (e.g. all-emoji filenames on iOS).
function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[\x00-\x1f\x7f]/g, '')   // control characters
    .replace(/[\\/]/g, '-')             // path separators
    .replace(/["'`]/g, '')              // quotes that confuse storage paths
    .trim();
  if (!cleaned) return 'file';
  // Keep length sane for storage backends
  return cleaned.length > 200 ? cleaned.slice(0, 200) : cleaned;
}

async function requireMembership(recordId: string, userId: string) {
  const admin = createAdminClient();
  const { data: rec } = await admin
    .from('records')
    .select('workspace_id')
    .eq('id', recordId)
    .single();
  if (!rec) return null;

  const { data: m } = await admin
    .from('workspace_members')
    .select('role, accepted_at')
    .eq('workspace_id', rec.workspace_id)
    .eq('user_id', userId)
    .single();
  if (!m || !m.accepted_at) return null;

  return { workspaceId: rec.workspace_id, role: m.role };
}

// ────────────────────── GET: list files ──────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const member = await requireMembership(params.id, user.id);
  if (!member) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('record_files')
    .select(
      'id, storage_path, file_name, file_size, mime_type, description, uploaded_by, uploaded_at'
    )
    .eq('record_id', params.id)
    .order('uploaded_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ files: data || [] });
}

// ────────────────────── POST: upload a file ──────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const member = await requireMembership(params.id, user.id);
  if (!member) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 });
  }
  if (!['owner', 'admin', 'editor'].includes(member.role)) {
    return NextResponse.json(
      { error: 'forbidden — file upload requires editor role' },
      { status: 403 }
    );
  }

  // Parse the multipart form. We use the platform FormData parser which
  // handles boundary parsing for us; Next.js exposes it via req.formData().
  let form: FormData;
  try {
    form = await req.formData();
  } catch (e) {
    return NextResponse.json({ error: 'invalid multipart body' }, { status: 400 });
  }

  const file = form.get('file');
  const description = (form.get('description') || '').toString().trim() || null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file field required' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'empty file' }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `file too large (max ${Math.floor(MAX_FILE_SIZE / 1024 / 1024)}MB)` },
      { status: 413 }
    );
  }
  if (description && description.length > 500) {
    return NextResponse.json(
      { error: 'description too long (max 500)' },
      { status: 400 }
    );
  }

  const safeName = sanitizeFilename(file.name);
  const fileId = randomUUID();
  const storagePath = `${member.workspaceId}/${params.id}/${fileId}-${safeName}`;

  const admin = createAdminClient();

  // Upload to storage. We pass the file Body directly; Supabase storage
  // accepts Blob/Buffer/ReadableStream. The contentType is inferred from
  // the File object if not provided.
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json(
      { error: 'upload failed: ' + uploadError.message },
      { status: 500 }
    );
  }

  // Register the row. If this fails AFTER upload, the file is orphaned in
  // storage — we delete it to keep things tidy.
  const { data: row, error: insertError } = await admin
    .from('record_files')
    .insert({
      workspace_id: member.workspaceId,
      record_id: params.id,
      storage_path: storagePath,
      file_name: safeName,
      file_size: file.size,
      mime_type: file.type || null,
      description,
      uploaded_by: user.id,
    })
    .select(
      'id, storage_path, file_name, file_size, mime_type, description, uploaded_by, uploaded_at'
    )
    .single();

  if (insertError) {
    await admin.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json(
      { error: 'failed to register file: ' + insertError.message },
      { status: 500 }
    );
  }

  // Best-effort activity log entry
  await admin.from('record_activity_log').insert({
    workspace_id: member.workspaceId,
    record_id: params.id,
    actor_id: user.id,
    event_type: 'file_uploaded',
    summary: `העלה קובץ: ${safeName}`,
    metadata: { file_id: row.id, file_size: file.size, mime_type: file.type },
  });

  return NextResponse.json({ file: row });
}
