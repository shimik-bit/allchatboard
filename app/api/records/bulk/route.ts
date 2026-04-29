import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/records/bulk
 *
 * Body:
 *   {
 *     action: 'delete' | 'update_field' | 'set_status' | 'approve' | 'reject',
 *     record_ids: string[],
 *     payload?: any   // depends on action:
 *                     //   update_field → { field_slug, value }
 *                     //   set_status   → { value }
 *                     //   reject       → { reason }
 *   }
 *
 * Authorization:
 *   - Member of workspace (any role) for read-related actions
 *   - editor/admin/owner for delete/update
 *   - Approver list match for approve/reject
 *
 * Returns:
 *   { processed, succeeded, failed, errors }
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action, record_ids, payload } = body;

  if (!action || !Array.isArray(record_ids) || record_ids.length === 0) {
    return NextResponse.json(
      { error: 'action and record_ids[] required' },
      { status: 400 }
    );
  }

  // Cap batch size to prevent runaway operations
  if (record_ids.length > 500) {
    return NextResponse.json(
      { error: 'maximum 500 records per bulk operation' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Load all records (we need workspace_id + table_id for auth checks)
  const { data: records } = await admin
    .from('records')
    .select('id, workspace_id, table_id, data, is_approved, record_number')
    .in('id', record_ids);

  if (!records || records.length === 0) {
    return NextResponse.json({ error: 'no records found' }, { status: 404 });
  }

  // All records must belong to the same workspace (cross-workspace bulk = abuse vector)
  const workspaceIds = [...new Set(records.map((r: any) => r.workspace_id))];
  if (workspaceIds.length > 1) {
    return NextResponse.json(
      { error: 'all records must belong to the same workspace' },
      { status: 400 }
    );
  }
  const workspaceId = workspaceIds[0];

  // Verify the user is a member with sufficient permissions
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const role = membership.role;
  const canEdit = role === 'owner' || role === 'admin' || role === 'editor';

  // ===== Action dispatch =====
  const results = {
    processed: records.length,
    succeeded: 0,
    failed: 0,
    errors: [] as { id: string; error: string }[],
  };

  switch (action) {
    case 'delete': {
      if (!canEdit) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
      const { error } = await admin
        .from('records')
        .delete()
        .in('id', record_ids);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      results.succeeded = records.length;
      break;
    }

    case 'update_field': {
      if (!canEdit) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
      const { field_slug, value } = payload || {};
      if (!field_slug) {
        return NextResponse.json({ error: 'field_slug required' }, { status: 400 });
      }
      // Update each record's data jsonb individually so we don't clobber
      // other fields. Postgres jsonb_set would be ideal but we need to
      // handle null values too.
      for (const record of records) {
        const newData = { ...(record.data || {}), [field_slug]: value };
        const { error } = await admin
          .from('records')
          .update({ data: newData })
          .eq('id', record.id);
        if (error) {
          results.failed++;
          results.errors.push({ id: record.id, error: error.message });
        } else {
          results.succeeded++;
        }
      }
      break;
    }

    case 'set_status': {
      if (!canEdit) {
        return NextResponse.json({ error: 'forbidden' }, { status: 403 });
      }
      // Special-case for the common "change status" action — same as
      // update_field with field_slug='status' but more discoverable.
      const { value } = payload || {};
      if (!value) {
        return NextResponse.json({ error: 'value required' }, { status: 400 });
      }
      for (const record of records) {
        const newData = { ...(record.data || {}), status: value };
        const { error } = await admin
          .from('records')
          .update({ data: newData })
          .eq('id', record.id);
        if (error) {
          results.failed++;
          results.errors.push({ id: record.id, error: error.message });
        } else {
          results.succeeded++;
        }
      }
      break;
    }

    case 'approve':
    case 'reject': {
      // Bulk approval — need to verify the user is an authorized approver
      // for EVERY record's table. Different tables can have different
      // approver lists.
      const tableIds = [...new Set(records.map((r: any) => r.table_id))];
      const { data: tables } = await admin
        .from('tables')
        .select('id, approver_phone_ids, approval_required')
        .in('id', tableIds);

      const { data: userPhones } = await admin
        .from('authorized_phones')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .eq('is_active', true);
      const userPhoneIds = (userPhones || []).map((p: any) => p.id);

      const isOwnerOrAdmin = role === 'owner' || role === 'admin';

      // Check each table — fail fast if user can't approve any of them
      for (const table of tables || []) {
        if (!table.approval_required) continue; // skip — table doesn't use approval
        const approvers = table.approver_phone_ids || [];
        const hasMatch = approvers.length === 0
          || userPhoneIds.some((id: string) => approvers.includes(id));
        if (!isOwnerOrAdmin && !hasMatch) {
          return NextResponse.json(
            { error: `not authorized to ${action} records in this table` },
            { status: 403 }
          );
        }
      }

      const now = new Date().toISOString();
      const approverName = user.email || 'משתמש';

      for (const record of records) {
        const updateData: any = {};
        if (action === 'approve') {
          updateData.is_approved = true;
          updateData.approved_at = now;
          updateData.approved_by_phone_id = userPhoneIds[0] || null;
          updateData.approved_by_name = approverName;
          updateData.rejected_at = null;
          updateData.rejection_reason = null;
          // Update status field too if it exists
          const newData = { ...(record.data || {}) };
          if ('status' in newData) newData.status = 'approved';
          updateData.data = newData;
        } else {
          updateData.is_approved = false;
          updateData.rejected_at = now;
          updateData.rejected_by_phone_id = userPhoneIds[0] || null;
          updateData.rejection_reason = payload?.reason || null;
          updateData.approved_at = null;
          const newData = { ...(record.data || {}) };
          if ('status' in newData) newData.status = 'rejected';
          updateData.data = newData;
        }

        const { error } = await admin
          .from('records')
          .update(updateData)
          .eq('id', record.id);
        if (error) {
          results.failed++;
          results.errors.push({ id: record.id, error: error.message });
        } else {
          results.succeeded++;
        }
      }
      break;
    }

    default:
      return NextResponse.json({ error: `unknown action: ${action}` }, { status: 400 });
  }

  return NextResponse.json(results);
}
