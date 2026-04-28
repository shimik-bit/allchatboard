import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/records/[id]/approve
 *
 * Approves or rejects a record (typically an expense/invoice).
 *
 * Body:
 *   { action: 'approve' | 'reject', reason?: string }
 *
 * Authorization rules:
 *   - User must be a member of the record's workspace
 *   - The record's table must have approver_phone_ids configured
 *   - The user must own one of the approver phones (matched via authorized_phones)
 *   - OR be an owner/admin of the workspace
 *
 * On success: writes is_approved + approved_at + approved_by_phone_id +
 * approved_by_name to the record. Also updates the record's status field
 * if the table has one (status: pending → approved).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const action = body.action; // 'approve' | 'reject'
    const reason = body.reason || null;

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: 'action must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Load the record with its table info
    const { data: record } = await admin
      .from('records')
      .select('id, table_id, workspace_id, data, is_approved, record_number')
      .eq('id', params.id)
      .single();

    if (!record) {
      return NextResponse.json({ error: 'record not found' }, { status: 404 });
    }

    // Check membership + role
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', record.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // Find the user's authorized_phones for this workspace
    const { data: userPhones } = await admin
      .from('authorized_phones')
      .select('id, display_name, phone')
      .eq('workspace_id', record.workspace_id)
      .eq('user_id', user.id)
      .eq('is_active', true);

    // Load the table's approval config
    const { data: table } = await admin
      .from('tables')
      .select('approver_phone_ids, approval_required, name')
      .eq('id', record.table_id)
      .single();

    if (!table?.approval_required) {
      return NextResponse.json(
        { error: 'this table does not require approval' },
        { status: 400 }
      );
    }

    // Determine if user can approve.
    // Allowed if: (a) user is owner/admin of workspace, OR
    //             (b) one of user's phones is in approver_phone_ids
    const isOwnerOrAdmin = membership.role === 'owner' || membership.role === 'admin';
    const userPhoneIds = (userPhones || []).map((p: any) => p.id);
    const approverList = table.approver_phone_ids || [];
    const isAuthorizedApprover =
      approverList.length === 0 || // empty list = anyone
      userPhoneIds.some((id: string) => approverList.includes(id));

    if (!isOwnerOrAdmin && !isAuthorizedApprover) {
      return NextResponse.json(
        { error: 'you are not authorized to approve records in this table' },
        { status: 403 }
      );
    }

    // Pick the user's primary phone (first one) for the audit trail
    const primaryPhone = userPhones?.[0];
    const approverName = primaryPhone?.display_name || user.email || 'משתמש';
    const approverPhoneId = primaryPhone?.id || null;

    const now = new Date().toISOString();
    const updateData: any = {};

    if (action === 'approve') {
      updateData.is_approved = true;
      updateData.approved_at = now;
      updateData.approved_by_phone_id = approverPhoneId;
      updateData.approved_by_name = approverName;
      // Clear any prior rejection
      updateData.rejected_at = null;
      updateData.rejected_by_phone_id = null;
      updateData.rejection_reason = null;
      // Update status field if it exists in data
      const newData = { ...record.data };
      if ('status' in newData) {
        newData.status = 'approved';
      }
      updateData.data = newData;
    } else {
      updateData.is_approved = false;
      updateData.rejected_at = now;
      updateData.rejected_by_phone_id = approverPhoneId;
      updateData.rejection_reason = reason;
      // Clear any prior approval
      updateData.approved_at = null;
      updateData.approved_by_phone_id = null;
      updateData.approved_by_name = null;
      const newData = { ...record.data };
      if ('status' in newData) {
        newData.status = 'rejected';
      }
      updateData.data = newData;
    }

    const { error: updateErr } = await admin
      .from('records')
      .update(updateData)
      .eq('id', record.id);

    if (updateErr) {
      console.error('Failed to update record approval', updateErr);
      return NextResponse.json({ error: 'update failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      record_id: record.id,
      record_number: record.record_number,
      action,
      approved_by: approverName,
      timestamp: now,
    });
  } catch (e: any) {
    console.error('Approval error', e);
    return NextResponse.json(
      { error: e?.message || 'approval failed' },
      { status: 500 }
    );
  }
}
