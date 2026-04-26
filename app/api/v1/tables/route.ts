import { NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, logApiRequest } from '@/lib/api/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/tables
 *
 * Returns all tables in the workspace that the API key has access to,
 * along with their fields/schemas. Useful for autocomplete in integrations.
 *
 * Returns: { tables: [{ id, name, slug, fields: [{ slug, name, type, is_required, options? }] }] }
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

  // Build query: workspace tables, filtered by table_ids whitelist if any
  let tablesQuery = admin
    .from('tables')
    .select('id, name, slug, icon, color, description, ai_keywords')
    .eq('workspace_id', key.workspace_id)
    .eq('is_archived', false)
    .order('position');

  if (key.table_ids !== null && key.table_ids.length > 0) {
    tablesQuery = tablesQuery.in('id', key.table_ids);
  }

  const { data: tables, error } = await tablesQuery;
  if (error) {
    return logAndRespond(auth, req, startedAt, NextResponse.json(
      { error: 'db_error', message: error.message },
      { status: 500 }
    ));
  }

  if (!tables || tables.length === 0) {
    return logAndRespond(auth, req, startedAt, NextResponse.json({ tables: [] }));
  }

  // Get fields for all tables in one query
  const tableIds = tables.map((t: any) => t.id);
  const { data: fields } = await admin
    .from('fields')
    .select('id, table_id, name, slug, type, is_required, is_primary, position, config, ai_extraction_hint')
    .in('table_id', tableIds)
    .order('position');

  const fieldsByTable = (fields || []).reduce((acc: any, f: any) => {
    if (!acc[f.table_id]) acc[f.table_id] = [];
    acc[f.table_id].push({
      slug: f.slug,
      name: f.name,
      type: f.type,
      is_required: f.is_required,
      is_primary: f.is_primary,
      ai_hint: f.ai_extraction_hint,
      // Expose options for select/status fields
      options: ['select', 'multiselect', 'status'].includes(f.type)
        ? f.config?.options?.map((o: any) => ({ value: o.value, label: o.label }))
        : undefined,
      // Expose target table for relations
      relation_table_id: f.type === 'relation' ? f.config?.relation_table_id : undefined,
    });
    return acc;
  }, {} as Record<string, any[]>);

  const result = tables.map((t: any) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    icon: t.icon,
    description: t.description,
    fields: fieldsByTable[t.id] || [],
  }));

  return logAndRespond(auth, req, startedAt, NextResponse.json({ tables: result }));
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
