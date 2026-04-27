/**
 * Workspace limits checker - enforce plan limits before allowing actions.
 * Usage from API routes:
 *   import { checkLimit } from '@/lib/limits/check';
 *   const check = await checkLimit(supabase, workspaceId, 'max_tables');
 *   if (!check.allowed) return NextResponse.json({ error: check.reason }, { status: 403 });
 */

export type LimitKey =
  | 'max_tables'
  | 'max_records_per_table'
  | 'max_total_records'
  | 'max_whatsapp_groups'
  | 'max_whatsapp_instances'
  | 'max_team_members'
  | 'max_authorized_phones'
  | 'ai_messages_per_month'
  | 'whatsapp_messages_per_month';

export type FeatureKey =
  | 'feature_groupguard'
  | 'feature_focus_mode'
  | 'feature_reports'
  | 'feature_sequences'
  | 'feature_automations'
  | 'feature_api_access'
  | 'feature_custom_domain'
  | 'feature_white_label'
  | 'feature_priority_support'
  | 'feature_multi_instance';

const LIMIT_USAGE_KEY: Record<LimitKey, string> = {
  max_tables: 'tables',
  max_records_per_table: 'records', // Note: per-table check needs special handling
  max_total_records: 'records',
  max_whatsapp_groups: 'whatsapp_groups',
  max_whatsapp_instances: 'whatsapp_instances',
  max_team_members: 'team_members',
  max_authorized_phones: 'authorized_phones',
  ai_messages_per_month: 'ai_messages_used',
  whatsapp_messages_per_month: 'whatsapp_messages_30d',
};

const LIMIT_LABEL: Record<LimitKey, string> = {
  max_tables: 'טבלאות',
  max_records_per_table: 'רשומות בטבלה',
  max_total_records: 'סך רשומות',
  max_whatsapp_groups: 'קבוצות WhatsApp',
  max_whatsapp_instances: 'WhatsApp Instances',
  max_team_members: 'חברי צוות',
  max_authorized_phones: 'מספרים מורשים',
  ai_messages_per_month: 'הודעות AI החודש',
  whatsapp_messages_per_month: 'הודעות WhatsApp החודש',
};

const FEATURE_LABEL: Record<FeatureKey, string> = {
  feature_groupguard: 'GroupGuard',
  feature_focus_mode: 'Focus Mode',
  feature_reports: 'דוחות אוטומטיים',
  feature_sequences: 'רצפי הודעות',
  feature_automations: 'אוטומציות',
  feature_api_access: 'גישה ל-API',
  feature_custom_domain: 'דומיין מותאם',
  feature_white_label: 'White Label',
  feature_priority_support: 'תמיכה מועדפת',
  feature_multi_instance: 'ריבוי Instances',
};

export type LimitCheckResult = {
  allowed: boolean;
  reason?: string;
  limit?: number;
  used?: number;
  upgrade_to?: string;
};

/**
 * Check if a workspace can perform an action that consumes a limited resource.
 * @returns { allowed: true } if under limit, otherwise reason explaining why
 */
export async function checkLimit(
  supabase: any,
  workspaceId: string,
  limitKey: LimitKey,
): Promise<LimitCheckResult> {
  // Get the effective limit using the SQL helper
  const { data: limitData } = await supabase.rpc('get_workspace_limit', {
    p_workspace_id: workspaceId,
    p_limit_key: limitKey,
  });
  const limit = Number(limitData ?? 0);

  // Get current usage
  const { data: usageData } = await supabase.rpc('get_workspace_usage', {
    p_workspace_id: workspaceId,
  });
  const usage = (usageData as Record<string, number>) || {};
  const usedKey = LIMIT_USAGE_KEY[limitKey];
  const used = Number(usage[usedKey] ?? 0);

  if (limit === 0) {
    return {
      allowed: false,
      reason: `${LIMIT_LABEL[limitKey]} לא מותר בתוכנית הנוכחית`,
      limit,
      used,
    };
  }

  if (used >= limit) {
    return {
      allowed: false,
      reason: `הגעת למגבלת ${LIMIT_LABEL[limitKey]} (${used.toLocaleString()}/${limit.toLocaleString()}). שדרג את התוכנית כדי להוסיף עוד.`,
      limit,
      used,
      upgrade_to: 'business',
    };
  }

  return { allowed: true, limit, used };
}

/**
 * Check if a workspace has a feature enabled.
 */
export async function checkFeature(
  supabase: any,
  workspaceId: string,
  featureKey: FeatureKey,
): Promise<LimitCheckResult> {
  const { data } = await supabase.rpc('has_workspace_feature', {
    p_workspace_id: workspaceId,
    p_feature_key: featureKey,
  });

  if (!data) {
    return {
      allowed: false,
      reason: `התכונה "${FEATURE_LABEL[featureKey]}" לא זמינה בתוכנית הנוכחית`,
      upgrade_to: 'business',
    };
  }

  return { allowed: true };
}
