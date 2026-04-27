import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

/**
 * POST /api/focus/add-to-tasks
 * Body: {
 *   workspace_id, session_id, task_index, task_title, task_reason,
 *   priority, table_id?, assignee_user_id?, assignee_phone_id?, due_date?
 * }
 *
 * Creates a record in the workspace's "tasks" table from a Focus suggestion.
 * Marks the focus_actions row as 'added_to_table'.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const {
    workspace_id, session_id, task_index, task_title, task_reason,
    priority, table_id, assignee_user_id, assignee_phone_id, due_date,
  } = body;

  if (!workspace_id || !task_title) {
    return NextResponse.json({ error: 'workspace_id and task_title required' }, { status: 400 });
  }

  // Verify membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role, display_name')
    .eq('workspace_id', workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // ─── Find or determine the target table ───
  let targetTableId = table_id;
  if (!targetTableId) {
    // Auto-find a "tasks" table in the workspace
    const { data: tasksTables } = await service
      .from('tables')
      .select('id, name')
      .eq('workspace_id', workspace_id)
      .eq('is_archived', false)
      .or('name.ilike.%משימ%,name.ilike.%task%')
      .order('position')
      .limit(1);

    if (!tasksTables || tasksTables.length === 0) {
      return NextResponse.json({
        error: 'לא נמצאה טבלת משימות בסביבה. צור טבלה בשם "משימות" או בחר טבלה ידנית.',
        no_tasks_table: true,
      }, { status: 404 });
    }
    targetTableId = tasksTables[0].id;
  }

  // ─── Get fields of target table ───
  const { data: fields } = await service
    .from('fields')
    .select('id, name, slug, type, is_primary')
    .eq('table_id', targetTableId)
    .order('position');

  if (!fields || fields.length === 0) {
    return NextResponse.json({ error: 'Target table has no fields' }, { status: 500 });
  }

  // ─── Build the data payload ───
  // Map AI task properties to whatever field slugs the table has
  const data: Record<string, any> = {};

  // Title/Description: find the primary text field
  const titleField = fields.find(f => f.is_primary && (f.type === 'text' || f.type === 'longtext'))
    || fields.find(f => f.is_primary)
    || fields.find(f => ['title', 'description', 'name'].includes(f.slug));
  if (titleField) {
    data[titleField.slug] = task_title;
  }

  // Description / notes - put the AI reason if there's a separate longtext/notes field
  const notesField = fields.find(f =>
    f.id !== titleField?.id &&
    (f.type === 'longtext' || f.slug.includes('note') || f.slug.includes('description'))
  );
  if (notesField && task_reason) {
    data[notesField.slug] = task_reason;
  }

  // Priority
  const priorityField = fields.find(f => ['priority', 'דחיפות', 'urgency'].some(s => f.slug.includes(s)));
  if (priorityField && priority) {
    // Map AI priority to common values
    const priorityMap: Record<string, string> = {
      critical: 'דחוף',
      high: 'גבוהה',
      medium: 'בינונית',
      suggestion: 'נמוכה',
    };
    data[priorityField.slug] = priorityMap[priority] || priority;
  }

  // Due date
  const dueDateField = fields.find(f => f.type === 'date' || f.slug.includes('due'));
  if (dueDateField && due_date) {
    data[dueDateField.slug] = due_date;
  } else if (dueDateField) {
    // Default to today + 1 day if priority is critical, else +3 days
    const days = priority === 'critical' ? 1 : priority === 'high' ? 2 : 3;
    const due = new Date();
    due.setDate(due.getDate() + days);
    data[dueDateField.slug] = due.toISOString().split('T')[0];
  }

  // Assignee (text field) - use display name of selected user
  const assigneeField = fields.find(f => ['assignee', 'אחראי', 'owner'].some(s => f.slug.includes(s)));
  if (assigneeField) {
    if (assignee_user_id) {
      // Look up that member's display name
      const { data: targetMember } = await service
        .from('workspace_members')
        .select('display_name')
        .eq('workspace_id', workspace_id)
        .eq('user_id', assignee_user_id)
        .maybeSingle();
      if (targetMember) {
        data[assigneeField.slug] = targetMember.display_name || 'משתמש';
      }
    } else if (assignee_phone_id) {
      const { data: phone } = await service
        .from('authorized_phones')
        .select('display_name, phone')
        .eq('id', assignee_phone_id)
        .maybeSingle();
      if (phone) {
        data[assigneeField.slug] = phone.display_name || phone.phone;
      }
    } else {
      // Default to current user
      data[assigneeField.slug] = membership.display_name || user.email?.split('@')[0] || 'אני';
    }
  }

  // Status - set to "open" / "פתוח" / first option
  const statusField = fields.find(f => f.type === 'status' || f.slug === 'status');
  if (statusField) {
    data[statusField.slug] = 'פתוח';
  }

  // ─── Insert the record ───
  const insertPayload: any = {
    table_id: targetTableId,
    workspace_id,
    data,
    source: 'focus_mode',
    created_by: user.id,
  };

  // If assignee is a phone, set assignee_phone_id
  if (assignee_phone_id) {
    insertPayload.assignee_phone_id = assignee_phone_id;
  }

  const { data: record, error: insertError } = await service
    .from('records')
    .insert(insertPayload)
    .select('id')
    .single();

  if (insertError || !record) {
    return NextResponse.json({
      error: insertError?.message || 'Failed to create task record'
    }, { status: 500 });
  }

  // ─── Log the focus action ───
  if (session_id && task_index !== undefined) {
    await service.from('focus_actions').insert({
      session_id,
      user_id: user.id,
      task_index,
      task_title: task_title.slice(0, 200),
      action: 'added_to_table',
      created_record_id: record.id,
      delegated_to_phone_id: assignee_phone_id || null,
    });
  }

  return NextResponse.json({
    ok: true,
    record_id: record.id,
    table_id: targetTableId,
  });
}

/**
 * GET /api/focus/add-to-tasks/options?workspace_id=xxx
 * Returns members + phones for the assignee dropdown
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get('workspace_id');
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });

  // Verify membership AND check if user is admin/owner (allowed to delegate)
  const { data: myMembership } = await supabase
    .from('workspace_members')
    .select('role, display_name')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!myMembership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const canDelegate = ['owner', 'admin'].includes(myMembership.role);

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Get members
  const { data: members } = await service
    .from('workspace_members')
    .select('user_id, role, display_name')
    .eq('workspace_id', workspaceId);

  // Get user emails
  const userIds = (members || []).map(m => m.user_id);
  const { data: usersData } = await service.auth.admin.listUsers({ perPage: 1000 });
  const userMap = new Map((usersData?.users || []).map(u => [u.id, u.email]));

  const enrichedMembers = (members || []).map(m => ({
    user_id: m.user_id,
    role: m.role,
    display_name: m.display_name || userMap.get(m.user_id)?.split('@')[0] || 'משתמש',
    email: userMap.get(m.user_id),
    is_self: m.user_id === user.id,
  }));

  // Get authorized phones
  const { data: phones } = await service
    .from('authorized_phones')
    .select('id, phone, display_name, job_title')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true);

  // Find tasks tables for the table picker
  const { data: tablesList } = await service
    .from('tables')
    .select('id, name, icon')
    .eq('workspace_id', workspaceId)
    .eq('is_archived', false)
    .order('position');

  return NextResponse.json({
    members: enrichedMembers,
    phones: phones || [],
    tables: tablesList || [],
    can_delegate: canDelegate,
    my_user_id: user.id,
    my_display_name: myMembership.display_name || user.email?.split('@')[0],
  });
}
