/**
 * Report Templates - generate WhatsApp messages from workspace data
 *
 * Each template has the same shape:
 *   - name: human-readable Hebrew name
 *   - description: explanation for UI
 *   - icon: emoji
 *   - configFields: what config the user can set
 *   - generate(supabase, workspace, config): returns { message: string, isEmpty: boolean }
 *
 * The cron job picks up due reports, calls the right template, and sends
 * the message via WhatsApp to all configured recipients.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type ReportTemplate = {
  id: string;
  name: string;
  description: string;
  icon: string;
  configFields: ConfigField[];
  generate: (
    supabase: SupabaseClient,
    workspaceId: string,
    config: Record<string, any>,
    tableIds: string[] | null
  ) => Promise<{ message: string; isEmpty: boolean; recordCount: number }>;
};

export type ConfigField = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'tables' | 'status_values';
  default?: any;
  options?: { value: string; label: string }[];
  hint?: string;
};

// Hebrew day names
function todayLabel(): string {
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const months = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const d = new Date();
  return `יום ${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return '🌅 בוקר טוב';
  if (hour < 17) return '☀️ צהריים טובים';
  if (hour < 20) return '🌇 אחר הצהריים';
  return '🌙 ערב טוב';
}

const SEPARATOR = '━━━━━━━━━━━━━━━━━━';

// ============================================================================
// TEMPLATE 1: OPEN TASKS - "המשימות הפתוחות שלך"
// ============================================================================
const openTasksTemplate: ReportTemplate = {
  id: 'open_tasks',
  name: 'משימות פתוחות',
  description: 'תזכורת יומית של משימות פתוחות / רשומות שלא הושלמו',
  icon: '📋',
  configFields: [
    {
      key: 'open_status_values',
      label: 'איזה סטטוסים נחשבים "פתוח"?',
      type: 'status_values',
      default: ['new', 'open', 'in_progress', 'pending'],
      hint: 'רשומות עם הסטטוסים האלו ייכללו בדוח',
    },
    {
      key: 'limit',
      label: 'כמה משימות מקסימום להציג',
      type: 'number',
      default: 10,
    },
    {
      key: 'highlight_overdue_days',
      label: 'מסמן כדחוף אם פתוח מעל X ימים',
      type: 'number',
      default: 3,
    },
  ],
  async generate(supabase, workspaceId, config, tableIds) {
    const openStatuses: string[] = config.open_status_values || ['new', 'open', 'in_progress', 'pending'];
    const limit = config.limit || 10;
    const overdueDays = config.highlight_overdue_days || 3;

    let q = supabase
      .from('records')
      .select('id, data, created_at, table_id, tables(name, icon)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (tableIds && tableIds.length > 0) q = q.in('table_id', tableIds);

    const { data: records, error } = await q.limit(200);
    if (error) throw error;

    // Filter by status (status field could be named differently per table)
    const open = (records || []).filter((r: any) => {
      const status = r.data?.status || r.data?.task_status || r.data?.state;
      return !status || openStatuses.includes(status);
    }).slice(0, limit);

    if (open.length === 0) {
      const msg =
        `${greeting()}!\n\n` +
        `🎉 *אין משימות פתוחות*\n` +
        `${todayLabel()}\n\n` +
        `כל הרשומות סגורות. תיהנה מהיום!`;
      return { message: msg, isEmpty: true, recordCount: 0 };
    }

    // Group by table
    const byTable: Record<string, any[]> = {};
    for (const r of open) {
      const tableName = (r.tables as any)?.name || 'אחר';
      if (!byTable[tableName]) byTable[tableName] = [];
      byTable[tableName].push(r);
    }

    const now = Date.now();
    const overdueMs = overdueDays * 24 * 60 * 60 * 1000;

    let msg = `${greeting()}!\n*${todayLabel()}*\n\n`;
    msg += `${SEPARATOR}\n`;
    msg += `📋 *${open.length} משימות פתוחות*\n`;
    msg += `${SEPARATOR}\n\n`;

    for (const [tableName, items] of Object.entries(byTable)) {
      const icon = (items[0].tables as any)?.icon || '📋';
      msg += `${icon} *${tableName}* (${items.length})\n`;
      for (const r of items.slice(0, 5)) {
        const isOverdue = (now - new Date(r.created_at).getTime()) > overdueMs;
        const title = r.data?.name || r.data?.title || r.data?.customer_name || r.data?.subject || `רשומה ${r.id.slice(0, 8)}`;
        msg += `  ${isOverdue ? '🔥' : '•'} ${title}\n`;
      }
      if (items.length > 5) msg += `  _ועוד ${items.length - 5}_\n`;
      msg += '\n';
    }

    msg += `${SEPARATOR}\n`;
    msg += `🔗 לפתוח במערכת: taskflow-ai.com`;

    return { message: msg, isEmpty: false, recordCount: open.length };
  },
};

// ============================================================================
// TEMPLATE 2: LEADS SUMMARY - "סיכום לידים"
// ============================================================================
const leadsSummaryTemplate: ReportTemplate = {
  id: 'leads_summary',
  name: 'סיכום לידים',
  description: 'דוח לידים שנכנסו (היום / השבוע) מקובץ לפי קמפיין/מקור',
  icon: '🎯',
  configFields: [
    {
      key: 'period',
      label: 'תקופה',
      type: 'select',
      default: 'today',
      options: [
        { value: 'today', label: 'היום' },
        { value: 'yesterday', label: 'אתמול' },
        { value: 'last_24h', label: '24 שעות אחרונות' },
        { value: 'this_week', label: 'השבוע (מיום ראשון)' },
        { value: 'last_7_days', label: '7 ימים אחרונים' },
      ],
    },
    {
      key: 'group_by_field',
      label: 'שדה לקיבוץ',
      type: 'text',
      default: 'campaign_source',
      hint: 'שם השדה (slug) לקיבוץ - למשל campaign_source או source',
    },
  ],
  async generate(supabase, workspaceId, config, tableIds) {
    const period = config.period || 'today';
    const groupField = config.group_by_field || 'campaign_source';

    // Compute time window
    const now = new Date();
    let from = new Date();
    switch (period) {
      case 'today':
        from.setHours(0, 0, 0, 0);
        break;
      case 'yesterday':
        from = new Date(now);
        from.setDate(from.getDate() - 1);
        from.setHours(0, 0, 0, 0);
        now.setDate(now.getDate());
        now.setHours(0, 0, 0, 0);
        break;
      case 'last_24h':
        from.setHours(from.getHours() - 24);
        break;
      case 'this_week': {
        const dayOfWeek = from.getDay();
        from.setDate(from.getDate() - dayOfWeek);
        from.setHours(0, 0, 0, 0);
        break;
      }
      case 'last_7_days':
        from.setDate(from.getDate() - 7);
        break;
    }

    let q = supabase
      .from('records')
      .select('id, data, created_at, source, table_id, tables(name, icon)')
      .eq('workspace_id', workspaceId)
      .gte('created_at', from.toISOString())
      .order('created_at', { ascending: false });

    if (tableIds && tableIds.length > 0) q = q.in('table_id', tableIds);

    const { data: records, error } = await q.limit(500);
    if (error) throw error;

    const total = records?.length || 0;

    if (total === 0) {
      const msg =
        `${greeting()}!\n\n` +
        `📊 *אין לידים חדשים ${periodLabel(period)}*\n` +
        `${todayLabel()}\n\n` +
        `יום שקט - אולי זמן לקמפיין חדש?`;
      return { message: msg, isEmpty: true, recordCount: 0 };
    }

    // Group by the specified field
    const groups: Record<string, any[]> = {};
    for (const r of records!) {
      const key = r.data?.[groupField] || r.source || 'לא מסווג';
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }

    // Sort groups by count
    const sortedGroups = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

    let msg = `${greeting()}!\n\n`;
    msg += `🎯 *סיכום לידים - ${periodLabel(period)}*\n`;
    msg += `${todayLabel()}\n`;
    msg += `${SEPARATOR}\n\n`;

    msg += `📈 *סה"כ:* ${total} לידים\n\n`;

    msg += `*חלוקה לפי ${labelForField(groupField)}:*\n`;
    for (const [groupName, items] of sortedGroups.slice(0, 8)) {
      const pct = Math.round((items.length / total) * 100);
      msg += `• *${groupName}* — ${items.length} (${pct}%)\n`;
    }
    if (sortedGroups.length > 8) {
      msg += `_+${sortedGroups.length - 8} מקורות נוספים_\n`;
    }

    // Show top 3 most recent
    msg += `\n*${Math.min(3, total)} האחרונים:*\n`;
    for (const r of records!.slice(0, 3)) {
      const name = r.data?.name || r.data?.customer_name || r.data?.full_name || 'ליד אנונימי';
      const source = r.data?.[groupField] || 'לא מסווג';
      msg += `• ${name} _(${source})_\n`;
    }

    msg += `\n${SEPARATOR}\n`;
    msg += `🔗 taskflow-ai.com`;

    return { message: msg, isEmpty: false, recordCount: total };
  },
};

// ============================================================================
// TEMPLATE 3: SALES SUMMARY - "סיכום מכירות"
// ============================================================================
const salesSummaryTemplate: ReportTemplate = {
  id: 'sales_summary',
  name: 'סיכום מכירות',
  description: 'סיכום מכירות לתקופה - סה"כ + ממוצע + השוואה לתקופה קודמת',
  icon: '💰',
  configFields: [
    {
      key: 'period',
      label: 'תקופה',
      type: 'select',
      default: 'today',
      options: [
        { value: 'today', label: 'היום' },
        { value: 'yesterday', label: 'אתמול' },
        { value: 'this_week', label: 'השבוע' },
        { value: 'this_month', label: 'החודש' },
      ],
    },
    {
      key: 'amount_field',
      label: 'שדה הסכום',
      type: 'text',
      default: 'amount',
      hint: 'slug של שדה המטבע - למשל amount, price, deal_value',
    },
    {
      key: 'currency_symbol',
      label: 'סמל מטבע',
      type: 'text',
      default: '₪',
    },
  ],
  async generate(supabase, workspaceId, config, tableIds) {
    const period = config.period || 'today';
    const amountField = config.amount_field || 'amount';
    const currency = config.currency_symbol || '₪';

    const ranges = computeCurrentAndPrevious(period);

    let q = supabase
      .from('records')
      .select('id, data, created_at, table_id, tables(name, icon)')
      .eq('workspace_id', workspaceId)
      .gte('created_at', ranges.previous.from.toISOString())
      .order('created_at', { ascending: false });

    if (tableIds && tableIds.length > 0) q = q.in('table_id', tableIds);

    const { data: all, error } = await q.limit(1000);
    if (error) throw error;

    const current = (all || []).filter((r: any) => new Date(r.created_at) >= ranges.current.from);
    const previous = (all || []).filter((r: any) =>
      new Date(r.created_at) >= ranges.previous.from && new Date(r.created_at) < ranges.current.from
    );

    const sumOf = (arr: any[]) => arr.reduce((acc, r) => {
      const v = parseFloat(r.data?.[amountField] || '0');
      return acc + (isNaN(v) ? 0 : v);
    }, 0);

    const currentTotal = sumOf(current);
    const previousTotal = sumOf(previous);
    const currentCount = current.length;
    const avg = currentCount > 0 ? Math.round(currentTotal / currentCount) : 0;

    if (currentCount === 0) {
      const msg =
        `${greeting()}!\n\n` +
        `💰 *סיכום מכירות - ${periodLabel(period)}*\n` +
        `${todayLabel()}\n\n` +
        `אין עסקאות חדשות ${periodLabel(period)}.\n` +
        `_${periodLabel('previous_' + period)}: ${currency}${previousTotal.toLocaleString()}_`;
      return { message: msg, isEmpty: true, recordCount: 0 };
    }

    // Compute change percentage
    const change = previousTotal > 0
      ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100)
      : null;

    let trendEmoji = '➡️';
    let trendText = '';
    if (change !== null) {
      if (change > 5) { trendEmoji = '📈'; trendText = `+${change}%`; }
      else if (change < -5) { trendEmoji = '📉'; trendText = `${change}%`; }
      else { trendEmoji = '➡️'; trendText = 'יציב'; }
    }

    let msg = `${greeting()}!\n\n`;
    msg += `💰 *סיכום מכירות*\n`;
    msg += `_${periodLabel(period)} • ${todayLabel()}_\n`;
    msg += `${SEPARATOR}\n\n`;

    msg += `*סה"כ:* ${currency}${currentTotal.toLocaleString()}\n`;
    msg += `*עסקאות:* ${currentCount}\n`;
    msg += `*ממוצע לעסקה:* ${currency}${avg.toLocaleString()}\n`;

    if (change !== null) {
      msg += `\n${trendEmoji} *${trendText}* מ${periodLabel('previous_' + period)}\n`;
      msg += `_(${currency}${previousTotal.toLocaleString()})_\n`;
    }

    // Top 3 deals
    const topDeals = [...current].sort((a, b) =>
      (parseFloat(b.data?.[amountField] || '0') || 0) - (parseFloat(a.data?.[amountField] || '0') || 0)
    ).slice(0, 3);

    if (topDeals.length > 0) {
      msg += `\n*🏆 העסקאות הגדולות:*\n`;
      for (const r of topDeals) {
        const name = r.data?.name || r.data?.customer_name || r.data?.deal_name || 'עסקה';
        const amount = parseFloat(r.data?.[amountField] || '0');
        msg += `• ${name} — ${currency}${amount.toLocaleString()}\n`;
      }
    }

    msg += `\n${SEPARATOR}\n`;
    msg += `🔗 taskflow-ai.com`;

    return { message: msg, isEmpty: false, recordCount: currentCount };
  },
};

// ============================================================================
// TEMPLATE 4: STUCK RECORDS - "רשומות תקועות"
// ============================================================================
const stuckRecordsTemplate: ReportTemplate = {
  id: 'stuck_records',
  name: 'רשומות שזקוקות לטיפול',
  description: 'התראה על רשומות פתוחות שלא זזו X ימים',
  icon: '⚠️',
  configFields: [
    {
      key: 'days_threshold',
      label: 'כמה ימים בלי עדכון נחשב "תקוע"',
      type: 'number',
      default: 7,
    },
    {
      key: 'open_status_values',
      label: 'איזה סטטוסים נחשבים פתוחים',
      type: 'status_values',
      default: ['new', 'open', 'in_progress', 'pending', 'בטיפול'],
    },
  ],
  async generate(supabase, workspaceId, config, tableIds) {
    const days = config.days_threshold || 7;
    const openStatuses: string[] = config.open_status_values || ['new', 'open', 'in_progress', 'pending'];

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    let q = supabase
      .from('records')
      .select('id, data, created_at, updated_at, table_id, tables(name, icon)')
      .eq('workspace_id', workspaceId)
      .lt('updated_at', cutoff.toISOString())
      .order('updated_at', { ascending: true });

    if (tableIds && tableIds.length > 0) q = q.in('table_id', tableIds);

    const { data: records, error } = await q.limit(50);
    if (error) throw error;

    const stuck = (records || []).filter((r: any) => {
      const status = r.data?.status || r.data?.task_status;
      return !status || openStatuses.includes(status);
    });

    if (stuck.length === 0) {
      return {
        message:
          `${greeting()}!\n\n` +
          `✅ *אין רשומות תקועות*\n` +
          `${todayLabel()}\n\n` +
          `כל הרשומות הפעילות עודכנו בתוך ${days} ימים אחרונים. עבודה טובה! 👏`,
        isEmpty: true,
        recordCount: 0,
      };
    }

    let msg = `${greeting()}!\n\n`;
    msg += `⚠️ *${stuck.length} רשומות שלא זזו ${days}+ ימים*\n`;
    msg += `${todayLabel()}\n`;
    msg += `${SEPARATOR}\n\n`;

    for (const r of stuck.slice(0, 10)) {
      const name = r.data?.name || r.data?.title || r.data?.customer_name || `רשומה ${r.id.slice(0, 8)}`;
      const updatedDate = new Date(r.updated_at);
      const daysSince = Math.floor((Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24));
      const tableName = (r.tables as any)?.name || '';
      const icon = (r.tables as any)?.icon || '📋';
      msg += `${icon} *${name}*\n`;
      msg += `   ${tableName} • ${daysSince} ימים בלי עדכון\n`;
    }

    if (stuck.length > 10) {
      msg += `\n_+${stuck.length - 10} רשומות נוספות_\n`;
    }

    msg += `\n${SEPARATOR}\n`;
    msg += `💡 _זה הזמן לעבור עליהן ולסגור / לדחות / לעדכן._\n`;
    msg += `🔗 taskflow-ai.com`;

    return { message: msg, isEmpty: false, recordCount: stuck.length };
  },
};

// ============================================================================
// HELPERS
// ============================================================================
function periodLabel(period: string): string {
  switch (period) {
    case 'today': return 'היום';
    case 'yesterday': return 'אתמול';
    case 'last_24h': return 'ב-24 השעות האחרונות';
    case 'this_week': return 'השבוע';
    case 'last_7_days': return 'ב-7 ימים אחרונים';
    case 'this_month': return 'החודש';
    case 'previous_today': return 'אתמול';
    case 'previous_yesterday': return 'שלשום';
    case 'previous_this_week': return 'בשבוע שעבר';
    case 'previous_this_month': return 'בחודש שעבר';
    default: return period;
  }
}

function labelForField(field: string): string {
  const labels: Record<string, string> = {
    campaign_source: 'מקור קמפיין',
    source: 'מקור',
    channel: 'ערוץ',
    referrer: 'הפניה',
    utm_source: 'UTM',
  };
  return labels[field] || field;
}

function computeCurrentAndPrevious(period: string) {
  const now = new Date();
  const current = { from: new Date(), to: new Date() };
  const previous = { from: new Date(), to: new Date() };

  switch (period) {
    case 'today':
      current.from = new Date(now);
      current.from.setHours(0, 0, 0, 0);
      previous.from = new Date(current.from);
      previous.from.setDate(previous.from.getDate() - 1);
      break;
    case 'yesterday':
      current.from = new Date(now);
      current.from.setDate(current.from.getDate() - 1);
      current.from.setHours(0, 0, 0, 0);
      current.to = new Date(now);
      current.to.setHours(0, 0, 0, 0);
      previous.from = new Date(current.from);
      previous.from.setDate(previous.from.getDate() - 1);
      break;
    case 'this_week': {
      const dayOfWeek = now.getDay();
      current.from = new Date(now);
      current.from.setDate(current.from.getDate() - dayOfWeek);
      current.from.setHours(0, 0, 0, 0);
      previous.from = new Date(current.from);
      previous.from.setDate(previous.from.getDate() - 7);
      break;
    }
    case 'this_month':
      current.from = new Date(now.getFullYear(), now.getMonth(), 1);
      previous.from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      break;
  }

  return { current, previous };
}

// ============================================================================
// REGISTRY
// ============================================================================
export const TEMPLATES: Record<string, ReportTemplate> = {
  open_tasks: openTasksTemplate,
  leads_summary: leadsSummaryTemplate,
  sales_summary: salesSummaryTemplate,
  stuck_records: stuckRecordsTemplate,
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);

export function getTemplate(id: string): ReportTemplate | undefined {
  return TEMPLATES[id];
}
