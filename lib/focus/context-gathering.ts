/**
 * Smart context gathering for the Focus Mode AI briefing.
 *
 * The challenge: we can't dump 200 records into the prompt - too expensive
 * and the AI will get confused. Instead, we sample intelligently:
 *
 * - Recent records (last 7 days)
 * - Records that are "stuck" (no update in 30+ days)
 * - Records assigned to the user
 * - Records with overdue dates
 * - Records in critical status
 *
 * The output is compact JSON that fits in ~2K tokens.
 */

export type FocusContext = {
  user: {
    id: string;
    name: string | null;
    role_title: string | null;
    role_description: string | null;
  };
  workspace: {
    id: string;
    name: string;
  };
  tables: Array<{
    id: string;
    name: string;
    icon: string | null;
    record_count: number;
    purpose?: string; // From table description
    sample_records: Array<{
      id: string;
      title: string;
      status?: string;
      assignee?: string;
      created_at: string;
      last_updated: string;
      summary: string; // 1-line description
      reason: 'recent' | 'stuck' | 'mine' | 'overdue' | 'critical';
    }>;
    field_summary: string; // E.g. "10 שדות: שם, טלפון, סטטוס, סכום, ..."
  }>;
  // Aggregated stats across all tables
  stats: {
    total_records: number;
    new_this_week: number;
    pending_actions: number;
    overdue: number;
  };
};

type SupabaseAdmin = any;

export async function gatherFocusContext(
  supabaseAdmin: SupabaseAdmin,
  userId: string,
  workspaceId: string
): Promise<FocusContext> {
  // ─── Get user info + role ───
  const [userResp, roleResp, workspaceResp, memberResp] = await Promise.all([
    supabaseAdmin.auth.admin.getUserById(userId),
    supabaseAdmin
      .from('user_roles')
      .select('role_title, role_description')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .maybeSingle(),
    supabaseAdmin
      .from('workspaces')
      .select('id, name')
      .eq('id', workspaceId)
      .single(),
    supabaseAdmin
      .from('workspace_members')
      .select('display_name')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .maybeSingle(),
  ]);

  const userName = (memberResp.data as any)?.display_name
    || userResp.data?.user?.user_metadata?.full_name
    || userResp.data?.user?.email?.split('@')[0]
    || 'משתמש';

  // ─── Get user's authorized phone (for "mine" filter) ───
  const { data: phoneResp } = await supabaseAdmin
    .from('authorized_phones')
    .select('id')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  const userPhoneId = (phoneResp as any)?.id;

  // ─── Get tables in workspace ───
  const { data: tables } = await supabaseAdmin
    .from('tables')
    .select('id, name, icon, description')
    .eq('workspace_id', workspaceId)
    .eq('is_archived', false)
    .order('position');

  if (!tables || tables.length === 0) {
    return {
      user: { id: userId, name: userName, role_title: (roleResp.data as any)?.role_title || null, role_description: (roleResp.data as any)?.role_description || null },
      workspace: { id: workspaceId, name: (workspaceResp.data as any)?.name || '' },
      tables: [],
      stats: { total_records: 0, new_this_week: 0, pending_actions: 0, overdue: 0 },
    };
  }

  // ─── For each table, gather smart sample of records ───
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  let totalRecords = 0;
  let newThisWeek = 0;
  let pendingActions = 0;
  let overdue = 0;

  const tableSummaries = await Promise.all(
    tables.map(async (table: any) => {
      // Count records
      const { count: tableCount } = await supabaseAdmin
        .from('records')
        .select('id', { count: 'exact', head: true })
        .eq('table_id', table.id);
      const recordCount = tableCount || 0;
      totalRecords += recordCount;

      // Get fields for this table (to know what status field is)
      const { data: fields } = await supabaseAdmin
        .from('fields')
        .select('id, name, slug, type')
        .eq('table_id', table.id)
        .order('position');

      const statusField = fields?.find((f: any) => f.type === 'status' || f.type === 'select');
      const titleField = fields?.find((f: any) => f.is_primary) || fields?.[0];
      const dateField = fields?.find((f: any) => f.type === 'date' || f.type === 'datetime');
      const phoneField = fields?.find((f: any) => f.type === 'phone');

      const fieldSummary = `${fields?.length || 0} שדות: ${fields?.slice(0, 5).map((f: any) => f.name).join(', ') || '—'}${(fields?.length || 0) > 5 ? '...' : ''}`;

      // ─── Sample records from multiple angles ───
      const sampleRecords: any[] = [];
      const seenIds = new Set<string>();

      // 1. Records assigned to me (by phone)
      if (userPhoneId) {
        const { data: mine } = await supabaseAdmin
          .from('records')
          .select('id, data, assignee_phone_id, created_at, updated_at')
          .eq('table_id', table.id)
          .eq('assignee_phone_id', userPhoneId)
          .order('updated_at', { ascending: false })
          .limit(5);

        for (const r of (mine || [])) {
          if (seenIds.has((r as any).id)) continue;
          seenIds.add((r as any).id);
          sampleRecords.push({ ...(r as any), _reason: 'mine' });
          pendingActions++;
        }
      }

      // 2. Recent (last 7 days) - top 3
      const { data: recent } = await supabaseAdmin
        .from('records')
        .select('id, data, assignee_phone_id, created_at, updated_at')
        .eq('table_id', table.id)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(3);

      for (const r of (recent || [])) {
        newThisWeek++;
        if (seenIds.has((r as any).id)) continue;
        seenIds.add((r as any).id);
        sampleRecords.push({ ...(r as any), _reason: 'recent' });
      }

      // 3. Stuck (no update in 30+ days)
      const { data: stuck } = await supabaseAdmin
        .from('records')
        .select('id, data, assignee_phone_id, created_at, updated_at')
        .eq('table_id', table.id)
        .lt('updated_at', thirtyDaysAgo)
        .order('updated_at', { ascending: true })
        .limit(2);

      for (const r of (stuck || [])) {
        if (seenIds.has((r as any).id)) continue;
        // Skip if status is "closed" / "done" / "complete"
        const statusVal = statusField ? String(r.data?.[statusField.slug] || '').toLowerCase() : '';
        if (statusVal.includes('closed') || status.includes('done') || status.includes('סגור') || status.includes('בוצע')) continue;
        seenIds.add((r as any).id);
        sampleRecords.push({ ...(r as any), _reason: 'stuck' });
      }

      // 4. Overdue (date field in past, not done)
      if (dateField) {
        const { data: late } = await supabaseAdmin
          .from('records')
          .select('id, data, assignee_phone_id, created_at, updated_at')
          .eq('table_id', table.id)
          .order('updated_at', { ascending: false })
          .limit(20);

        for (const r of (late || [])) {
          if (seenIds.has((r as any).id)) continue;
          const dateVal = (r as any).data?.[dateField.slug];
          if (!dateVal) continue;
          if (new Date(dateVal) > new Date()) continue;
          const statusVal = statusField ? String(r.data?.[statusField.slug] || '').toLowerCase() : '';
          if (statusVal.includes('closed') || status.includes('done') || status.includes('סגור') || status.includes('בוצע')) continue;
          seenIds.add((r as any).id);
          sampleRecords.push({ ...(r as any), _reason: 'overdue' });
          overdue++;
          if (sampleRecords.filter(s => s._reason === 'overdue').length >= 3) break;
        }
      }

      // ─── Format records for AI ───
      const formatted = sampleRecords.slice(0, 8).map(r => ({
        id: r.id,
        title: titleField ? (r.data?.[titleField.slug] || '(ללא שם)') : '(ללא שם)',
        status: statusField ? r.data?.[statusField.slug] : undefined,
        created_at: r.created_at,
        last_updated: r.updated_at,
        summary: summarizeRecord(r.data, fields || []),
        reason: r._reason as any,
      }));

      return {
        id: table.id,
        name: table.name,
        icon: table.icon,
        record_count: recordCount,
        purpose: table.description || undefined,
        sample_records: formatted,
        field_summary: fieldSummary,
      };
    })
  );

  return {
    user: {
      id: userId,
      name: userName,
      role_title: (roleResp.data as any)?.role_title || null,
      role_description: (roleResp.data as any)?.role_description || null,
    },
    workspace: {
      id: workspaceId,
      name: (workspaceResp.data as any)?.name || '',
    },
    tables: tableSummaries,
    stats: {
      total_records: totalRecords,
      new_this_week: newThisWeek,
      pending_actions: pendingActions,
      overdue,
    },
  };
}

// ─── Helper: 1-line summary of record data ───
function summarizeRecord(data: any, fields: any[]): string {
  if (!data) return '';
  const parts: string[] = [];
  // Pick top 3 most informative fields
  for (const f of fields.slice(0, 5)) {
    if (parts.length >= 3) break;
    if (f.is_primary) continue; // already in title
    const v = data[f.slug];
    if (v === null || v === undefined || v === '') continue;
    if (typeof v === 'object') continue; // skip arrays/objects
    let str = String(v);
    if (str.length > 40) str = str.slice(0, 40) + '...';
    parts.push(`${f.name}: ${str}`);
  }
  return parts.join(' · ');
}
