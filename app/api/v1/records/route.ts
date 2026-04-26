import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, checkTableAccess, logApiRequest } from '@/lib/api/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/records?table_id=xxx&limit=50&offset=0&search=foo
 *
 * List records from a table. Supports:
 *   - table_id (required) - which table to query
 *   - limit (default 50, max 200)
 *   - offset (for pagination)
 *   - search - free-text search across primary field
 *   - order_by - 'created_at' (default) or any field slug
 *   - order_dir - 'asc' or 'desc' (default 'desc')
 *
 * Returns: { records: [...], total, limit, offset }
 */
export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const tableId = searchParams.get('table_id');
  if (!tableId) {
    return logAndRespond(auth, req, startedAt, NextResponse.json(
      { error: 'missing_param', message: 'table_id query parameter is required' },
      { status: 400 }
    ));
  }

  const access = await checkTableAccess(admin, key, tableId);
  if (!access.ok) return logAndRespond(auth, req, startedAt, access.errorResponse);

  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const orderBy = searchParams.get('order_by') || 'created_at';
  const orderDir = searchParams.get('order_dir') === 'asc' ? 'asc' : 'desc';
  const search = searchParams.get('search');

  let query = admin
    .from('records')
    .select('id, data, source, ai_confidence, assignee_phone_id, attachment_url, attachment_type, created_at, updated_at', { count: 'exact' })
    .eq('table_id', tableId);

  // Free-text search on the JSONB data field
  if (search) {
    query = query.textSearch('data', search, { type: 'websearch' }) as any;
  }

  // Ordering
  if (orderBy === 'created_at' || orderBy === 'updated_at') {
    query = query.order(orderBy, { ascending: orderDir === 'asc' });
  } else {
    // Sort by a JSON field
    query = query.order(`data->>${orderBy}`, { ascending: orderDir === 'asc' });
  }

  query = query.range(offset, offset + limit - 1);

  const { data: records, count, error } = await query;
  if (error) {
    return logAndRespond(auth, req, startedAt, NextResponse.json(
      { error: 'db_error', message: error.message },
      { status: 500 }
    ));
  }

  return logAndRespond(auth, req, startedAt, NextResponse.json({
    records: records || [],
    total: count ?? 0,
    limit,
    offset,
  }));
}

/**
 * POST /api/v1/records
 * Body: { table_id: string, data: { ...field values... }, assignee_phone_id?: string }
 *
 * Creates a new record in the specified table.
 * The 'data' object is keyed by field slug.
 *
 * Returns: { record: {...} }
 */
export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const auth = await authenticateApiRequest(req);
  if (!auth.ok) return auth.errorResponse;

  const { key, admin } = auth;

  if (!key.can_create) {
    return logAndRespond(auth, req, startedAt, NextResponse.json(
      { error: 'forbidden', message: 'API key does not have create permission' },
      { status: 403 }
    ));
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return logAndRespond(auth, req, startedAt, NextResponse.json(
      { error: 'invalid_json', message: 'Request body must be valid JSON' },
      { status: 400 }
    ));
  }

  const { table_id, data, assignee_phone_id } = body;

  if (!table_id) {
    return logAndRespond(auth, req, startedAt, NextResponse.json(
      { error: 'missing_field', message: 'table_id is required in body' },
      { status: 400 }
    ));
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return logAndRespond(auth, req, startedAt, NextResponse.json(
      { error: 'missing_field', message: 'data must be an object of field slug → value' },
      { status: 400 }
    ));
  }

  const access = await checkTableAccess(admin, key, table_id);
  if (!access.ok) return logAndRespond(auth, req, startedAt, access.errorResponse);

  // Validate fields exist + check required fields
  const { data: fields } = await admin
    .from('fields')
    .select('slug, type, is_required')
    .eq('table_id', table_id);

  if (fields && fields.length > 0) {
    const validSlugs = new Set(fields.map((f: any) => f.slug));
    const unknownKeys = Object.keys(data).filter((k) => !validSlugs.has(k));
    if (unknownKeys.length > 0) {
      return logAndRespond(auth, req, startedAt, NextResponse.json(
        {
          error: 'unknown_fields',
          message: `Unknown field(s) in data: ${unknownKeys.join(', ')}`,
          valid_fields: Array.from(validSlugs),
        },
        { status: 400 }
      ));
    }

    const missing = fields
      .filter((f: any) => f.is_required && (data[f.slug] === undefined || data[f.slug] === null || data[f.slug] === ''))
      .map((f: any) => f.slug);
    if (missing.length > 0) {
      return logAndRespond(auth, req, startedAt, NextResponse.json(
        {
          error: 'missing_required',
          message: `Required field(s) missing: ${missing.join(', ')}`,
        },
        { status: 400 }
      ));
    }
  }

  // Get table workspace + default assignee
  const { data: table } = await admin
    .from('tables')
    .select('workspace_id, default_assignee_phone_id')
    .eq('id', table_id)
    .single();

  // Create the record
  const { data: record, error: insertErr } = await admin
    .from('records')
    .insert({
      table_id,
      workspace_id: table!.workspace_id,
      data,
      source: 'api',
      assignee_phone_id: assignee_phone_id || table!.default_assignee_phone_id || null,
      ai_confidence: null,
      created_by_api_key_id: key.id,
    } as any)
    .select('id, data, source, assignee_phone_id, created_at')
    .single();

  if (insertErr) {
    return logAndRespond(auth, req, startedAt, NextResponse.json(
      { error: 'db_error', message: insertErr.message },
      { status: 500 }
    ));
  }

  return logAndRespond(auth, req, startedAt, NextResponse.json({ record }, { status: 201 }));
}

/**
 * Convenience helper - log the request after building the response.
 */
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
