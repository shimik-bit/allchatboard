import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * /api/records/[id]/files/[fileId]
 *
 * GET    → returns a short-lived signed URL for downloading the file
 * DELETE → removes the file (storage + DB row). Uploader can always delete;
 *          owners/admins can delete any file.
 *
 * We never expose the raw storage URL; signed URLs ensure the bucket can stay
 * private and access is gated by our auth checks here.
 */

const BUCKET = 'record-files';
const SIGNED_URL_TTL_SECONDS = 60 * 5; // 5 minutes — long enough to start a download/preview

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

// ────────────────────── GET: signed download URL ──────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
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
  const { data: row, error: rowError } = await admin
    .from('record_files')
    .select('id, storage_path, file_name, mime_type, record_id, workspace_id')
    .eq('id', params.fileId)
    .single();

  if (rowError || !row || row.record_id !== params.id || row.workspace_id !== member.workspaceId) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // The download flag adds a Content-Disposition: attachment header so
  // browsers offer "Save As" instead of inlining unknown types. We allow
  // the client to opt into preview mode via ?preview=1 (e.g. for PDFs/images).
  const previewMode = req.nextUrl.searchParams.get('preview') === '1';
  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: previewMode ? false : row.file_name,
    });

  if (signError || !signed) {
    return NextResponse.json(
      { error: 'failed to generate download URL: ' + (signError?.message || 'unknown') },
      { status: 500 }
    );
  }

  return NextResponse.json({
    url: signed.signedUrl,
    expires_at: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
    file_name: row.file_name,
    mime_type: row.mime_type,
  });
}

// ────────────────────── DELETE: remove file ──────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
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
  const { data: row } = await admin
    .from('record_files')
    .select('id, storage_path, uploaded_by, record_id, workspace_id')
    .eq('id', params.fileId)
    .single();

  if (!row || row.record_id !== params.id || row.workspace_id !== member.workspaceId) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // Author can always delete; owners/admins of the workspace can delete any file.
  const canDelete =
    row.uploaded_by === user.id ||
    member.role === 'owner' ||
    member.role === 'admin';
  if (!canDelete) {
    return NextResponse.json(
      { error: 'forbidden — only the uploader or workspace admin can delete' },
      { status: 403 }
    );
  }

  // Order matters: delete the row first (so the UI immediately reflects).
  // If storage-removal fails, we have an orphaned object — we log it and
  // a sweeper job can pick it up later. Better than leaving a row pointing
  // to a missing object.
  const { error: deleteRowError } = await admin
    .from('record_files')
    .delete()
    .eq('id', params.fileId);
  if (deleteRowError) {
    return NextResponse.json({ error: deleteRowError.message }, { status: 500 });
  }

  const { error: removeError } = await admin.storage
    .from(BUCKET)
    .remove([row.storage_path]);
  if (removeError) {
    // Non-fatal — the row is gone, the orphan can be cleaned up later.
    console.error('orphaned storage object after row delete:', row.storage_path, removeError);
  }

  return NextResponse.json({ deleted: true });
}
