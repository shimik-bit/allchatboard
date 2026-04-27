// Workspace types
export type WorkspacePlan = 'trial' | 'starter' | 'business' | 'enterprise';
export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer';

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
}

// Field types
export type FieldType =
  | 'text' | 'longtext' | 'number' | 'currency'
  | 'date' | 'datetime' | 'select' | 'multiselect'
  | 'checkbox' | 'phone' | 'email' | 'url'
  | 'user' | 'attachment' | 'rating' | 'status'
  | 'relation' | 'city';

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
  // Optional joined data
  _creator_name?: string | null;
  _phone_name?: string | null;
  _assignee_name?: string | null;
}

// View types
export type ViewType = 'grid' | 'kanban' | 'calendar' | 'gallery' | 'timeline';

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
