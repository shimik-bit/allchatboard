import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, checkTableAccess, logApiRequest } from '@/lib/api/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/records/{id}    - fetch one record
 * PATCH /api/v1/records/{id}  - merge-update fields
 * DELETE /api/v1/records/{id} - delete record
 */

async function fetchRecordOrError(admin: any, id: string) {
  const { data: record, error } = await admin
    .from('records')
    .select('id, table_id, workspace_id, data, source, ai_confidence, assignee_phone_id, attachment_url, attachment_type, created_at, updated_at')
    .eq('id', id)
    .single();
  if (error || !record) return { record: null, error: 'record_not_found' as const };
  return { record, error: null };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const startedAt = Date.now();
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.errorResponse;

  const { key, admin } = auth;

  if (!key.can_read) {
    return logAndRespond(auth, req, startedAt, NextResponse.json(
      { error: 'forbidden', message: 'API key does not have read permission' },
      { status: 403 }
    ));
  }

  const { record, error } = await fetchRecordOrError(admin, params.id);
  if (!record) {
    return logAndRespond(auth, req, startedAt, NextResponse.json(
      { error: error || 'record_not_found', message: 'Record not found' },
      { status: 404 }
    ));
  }

  const access = await checkTableAccess(admin, key, record.table_id);
  if (!access.ok) return logAndRespond(auth, req, startedAt, access.errorResponse);

  return logAndRespond(auth, req, startedAt, NextResponse.json({ record }));
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const startedAt = Date.now();
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.errorResponse;

  const { key, admin } = auth;

  if (!key.can_update) {
    return logAndRespond(auth, req, startedAt, NextResponse.json(
      { error: 'forbidden', message: 'API key does not have update permission' },
      { status: 403 }
    ));
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return logAndRespond(auth, req, startedAt, NextResponse.json(
      { error: 'invalid_json', message: 'Body must be valid JSON' },
      { status: 400 }
    ));
  }

  const { data: patchData, assignee_phone_id } = body;
  if (!patchData && assignee_phone_id === undefined) {
    return logAndRespond(auth, req, startedAt, NextResponse.json(
      { error: 'no_changes', message: 'Provide at least data or assignee_phone_id to update' },
      { status: 400 }
    ));
  }

  const { record, error } = await fetchRecordOrError(admin, params.id);
  if (!record) {
    return logAndRespond(auth, req, startedAt, NextResponse.json(
      { error: error || 'record_not_found', message: 'Record not found' },
      { status: 404 }
    ));
  }

  const access = await checkTableAccess(admin, key, record.table_id);
  if (!access.ok) return logAndRespond(auth, req, startedAt, access.errorResponse);

  // Merge data (don't replace - PATCH semantics)
  const update: any = {};
  if (patchData && typeof patchData === 'object') {
    // Validate slugs
    const { data: fields } = await admin.from('fields').select('slug').eq('table_id', record.table_id);
    if (fields) {
      const validSlugs = new Set(fields.map((f: any) => f.slug));
      const unknown = Object.keys(patchData).filter((k) => !validSlugs.has(k));
      if (unknown.length > 0) {
        return logAndRespond(auth, req, startedAt, NextResponse.json(
          { error: 'unknown_fields', message: `Unknown field(s): ${unknown.join(', ')}` },
          { status: 400 }
        ));
      }
    }
    update.data = { ...(record.data || {}), ...patchData };
  }
  if (assignee_phone_id !== undefined) {
    update.assignee_phone_id = assignee_phone_id || null;
  }

  const { data: updated, error: updErr } = await admin
    .from('records')
    .update(update)
    .eq('id', params.id)
    .select('id, data, source, assignee_phone_id, created_at, updated_at')
    .single();

  if (updErr) {
    return logAndRespond(auth, req, startedAt, NextResponse.json(
      { error: 'db_error', message: updErr.message },
      { status: 500 }
    ));
  }

  return logAndRespond(auth, req, startedAt, NextResponse.json({ record: updated }));
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const startedAt = Date.now();
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.errorResponse;

  const { key, admin } = auth;

  if (!key.can_delete) {
    return logAndRespond(auth, req, startedAt, NextResponse.json(
      { error: 'forbidden', message: 'API key does not have delete permission' },
      { status: 403 }
    ));
  }

  const { record, error } = await fetchRecordOrError(admin, params.id);
  if (!record) {
    return logAndRespond(auth, req, startedAt, NextResponse.json(
      { error: error || 'record_not_found', message: 'Record not found' },
      { status: 404 }
    ));
  }

  const access = await checkTableAccess(admin, key, record.table_id);
  if (!access.ok) return logAndRespond(auth, req, startedAt, access.errorResponse);

  const { error: delErr } = await admin.from('records').delete().eq('id', params.id);
  if (delErr) {
    return logAndRespond(auth, req, startedAt, NextResponse.json(
      { error: 'db_error', message: delErr.message },
      { status: 500 }
    ));
  }

  return logAndRespond(auth, req, startedAt, NextResponse.json({ success: true, deleted_id: params.id }));
}

function logAndRespond(
  auth: { ok: true; key: any; admin: any },
  req: NextRequest,
  startedAt: number,
  response: NextResponse
): NextResponse {
  logApiRequest({
    admin: auth.admin,
    apiKeyId: auth.key.id,
    workspaceId: auth.key.workspace_id,
    method: req.method,
    path: new URL(req.url).pathname,
    statusCode: response.status,
    durationMs: Date.now() - startedAt,
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    userAgent: req.headers.get('user-agent'),
  });
  return response;
}
