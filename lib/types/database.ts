// Workspace types
export type WorkspacePlan = 'trial' | 'starter' | 'business' | 'enterprise';
export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer';

/** A workspace's organizational role.
 *  - standalone: a regular business that owns itself (default for all
 *    existing workspaces).
 *  - agency: a workspace that manages OTHER workspaces (accountants, agencies,
 *    salon chain HQs). Sees an "Agency Hub" instead of a regular dashboard.
 *  - client: a workspace managed by an agency. Shows a "managed by X" badge
 *    in its UI but otherwise behaves like a standalone for its own users. */
export type WorkspaceType = 'standalone' | 'agency' | 'client';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  vertical: string | null;
  business_description: string | null;
  logo_url: string | null;
  primary_color: string;
  plan: WorkspacePlan;
  trial_ends_at: string;
  ai_messages_used: number;
  ai_messages_limit: number;
  whatsapp_instance_id: string | null;
  whatsapp_token: string | null;
  settings: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
  /** 2-6 char identifier (e.g. "KBL"). Used as a prefix in global record IDs
      ("KBL-EXP-0042"). Auto-derived from name on creation; editable in settings
      by owners only. */
  workspace_code?: string | null;
  /** Organizational role of this workspace - see WorkspaceType. */
  type?: WorkspaceType;
  /** Emoji or short string shown next to the workspace name in the sidebar. */
  icon?: string | null;
}

/** Bridges an agency workspace to a client workspace it manages. Read by
 *  the Agency Hub to populate the client list, and by RLS to grant agency
 *  members access to client data. */
export interface AgencyClient {
  id: string;
  agency_workspace_id: string;
  client_workspace_id: string;
  /** Internal-to-agency nickname for the client. Doesn't affect the client's
      own name — the client still calls themselves whatever they call themselves. */
  nickname: string | null;
  can_view: boolean;
  can_edit: boolean;
  can_manage_members: boolean;
  can_view_finances: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

/** Why an escalation was created. Drives UI prioritization and per-reason
 *  routing rules in the future (e.g. complaints → manager). */
export type EscalationReason =
  | 'ai_uncertain'
  | 'client_requested_human'
  | 'complaint'
  | 'schedule_conflict'
  | 'payment_issue'
  | 'out_of_scope'
  | 'other';

export type EscalationPriority = 'urgent' | 'normal' | 'low';

export type EscalationStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';

/** A row in the escalation queue — something the AI couldn't or shouldn't
 *  handle alone, awaiting human review at /dashboard/inbox. */
export interface Escalation {
  id: string;
  workspace_id: string;
  record_id: string | null;
  chat_id: string | null;
  source_phone: string | null;
  source_phone_id: string | null;
  reason: EscalationReason;
  priority: EscalationPriority;
  status: EscalationStatus;
  title: string | null;
  last_message_excerpt: string | null;
  ai_explanation: string | null;
  assigned_to_user_id: string | null;
  assigned_at: string | null;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: MemberRole;
  display_name: string | null;
  whatsapp_phone: string | null;
  invited_at: string;
  accepted_at: string | null;
}

// Table types
export interface Table {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  description: string | null;
  ai_keywords: string[] | null;
  default_assignee_phone_id: string | null;
  position: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // Approval workflow fields - optional because not every workspace uses them.
  // When approval_required=true, new records start with is_approved=null and
  // need an authorized phone (in approver_phone_ids) to call /api/records/[id]/approve.
  approval_required?: boolean;
  approver_phone_ids?: string[] | null;
}

// Field types
export type FieldType =
  | 'text' | 'longtext' | 'number' | 'currency'
  | 'date' | 'datetime' | 'select' | 'multiselect'
  | 'checkbox' | 'phone' | 'email' | 'url'
  | 'user' | 'attachment' | 'rating' | 'status'
  | 'relation' | 'city' | 'formula';

export interface Field {
  id: string;
  table_id: string;
  name: string;
  slug: string;
  type: FieldType;
  is_required: boolean;
  is_primary: boolean;
  position: number;
  config: {
    options?: { label: string; value: string; color?: string }[];
    min?: number;
    max?: number;
    currency?: string;
    // Relation fields:
    relation_table_id?: string;
    display_field?: string;
    display_columns?: string[];
    allow_create?: boolean;
    many?: boolean;
  };
  ai_extraction_hint: string | null;
  summary_aggregation: string | null;
  created_at: string;
}

// Record types
export interface RecordRow {
  id: string;
  table_id: string;
  workspace_id: string;
  data: Record<string, any>;
  source: 'manual' | 'whatsapp' | 'import' | 'api';
  source_message_id: string | null;
  ai_confidence: number | null;
  notes: string | null;
  source_phone: string | null;
  source_chat_id: string | null;
  source_message_green_id: string | null;
  authorized_phone_id: string | null;
  assignee_phone_id: string | null;
  assignee_raw_phone: string | null;
  assignee_raw_name: string | null;
  assignee_notified_at: string | null;
  last_wa_message_id: string | null;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  created_by: string | null;
  last_updated_by: string | null;
  status_updated_at: string | null;
  status_updated_by: string | null;
  created_at: string;
  updated_at: string;
  // Approval workflow (only set when the table has approval_required=true)
  is_approved?: boolean | null;
  approved_at?: string | null;
  approved_by_phone_id?: string | null;
  approved_by_name?: string | null;
  rejected_at?: string | null;
  rejected_by_phone_id?: string | null;
  rejection_reason?: string | null;
  // Local record number (e.g. "EXP-0042"), separate from id (UUID).
  // Combined with workspace_code via get_global_record_id() it becomes
  // the globally-unique "KBL-EXP-0042" identifier.
  record_number?: string | null;
  // Optional joined data
  _creator_name?: string | null;
  _phone_name?: string | null;
  _assignee_name?: string | null;
}

// View types
export type ViewType = 'grid' | 'kanban' | 'calendar' | 'gallery' | 'timeline' | 'receipts';

export interface View {
  id: string;
  table_id: string;
  name: string;
  type: ViewType;
  config: {
    group_by_field?: string;
    date_field?: string;
    cover_field?: string;
  };
  filters: any[];
  is_default: boolean;
  created_by: string | null;
  created_at: string;
}

// WhatsApp message types
export type MessageStatus = 'received' | 'classified' | 'inserted' | 'failed' | 'ignored' | 'sent' | 'logged';
export type PhonePermission = 'writer' | 'admin' | 'reader';

export interface AuthorizedPhone {
  id: string;
  workspace_id: string;
  phone: string;
  display_name: string;
  job_title: string | null;
  permission: PhonePermission;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WaMessage {
  id: string;
  workspace_id: string;
  group_id: string | null;
  green_api_message_id: string | null;
  sender_phone: string | null;
  sender_name: string | null;
  member_id: string | null;
  authorized_phone_id: string | null;
  text: string | null;
  media_url: string | null;
  media_type: string | null;
  status: MessageStatus;
  ai_classification: any;
  ai_error: string | null;
  record_id: string | null;
  quoted_message_id: string | null;
  sent_message_id: string | null;
  direction: 'in' | 'out';
  update_action: 'created' | 'updated' | 'queried' | 'rejected' | null;
  received_at: string;
  processed_at: string | null;
}

export interface WhatsAppGroup {
  id: string;
  workspace_id: string;
  green_api_chat_id: string;
  group_name: string | null;
  is_active: boolean;
  classification_hint: string | null;
  created_at: string;
}

export interface Template {
  id: string;
  vertical: string;
  name: string;
  description: string | null;
  icon: string | null;
  structure: {
    tables: {
      name: string;
      slug: string;
      icon: string;
      color: string;
      ai_keywords: string[];
      fields: Partial<Field>[];
    }[];
  };
  is_published: boolean;
  created_at: string;
}
