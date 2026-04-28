import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/workflows/presets?table_id=xxx
 *
 * Returns ready-made workflow templates ("recipes") that the user can
 * one-click create for a specific table. The set of presets returned
 * depends on which fields the table has (we won't suggest a "30 min before"
 * preset if there's no datetime field, for example).
 *
 * POST /api/workflows/presets
 *   Body: { workspace_id, table_id, preset_id, customizations? }
 *   Instantiates a preset as a real workflow row.
 */

interface PresetField {
  type: string;        // e.g. 'datetime', 'phone', 'text'
  required: boolean;
  // The slug to substitute in the template (e.g. trigger_config.field_slug)
  bind_to: string;     // dot-path in the preset structure
}

interface Preset {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: 'meeting' | 'task' | 'lead' | 'general';
  // Field requirements - we won't show this preset if these aren't satisfied
  requires: { type: string; min_count?: number }[];
  // Template (with placeholders that get filled from request body)
  template: {
    name: string;
    description?: string;
    trigger_type: string;
    trigger_config: any;
    actions: any[];
  };
}

const PRESETS: Preset[] = [
  // ────────── Meeting presets ──────────
  {
    id: 'meeting_confirmation',
    name: 'אישור פגישה אוטומטי',
    description: 'שולח לכנען (או למי שהפגישה איתו) הודעת אישור עם פרטי הפגישה ברגע שהיא נוצרת',
    emoji: '📤',
    category: 'meeting',
    requires: [{ type: 'phone', min_count: 1 }, { type: 'datetime', min_count: 1 }],
    template: {
      name: 'אישור פגישה',
      description: 'נשלח אוטומטית כשנוצרת פגישה חדשה',
      trigger_type: 'record_created',
      trigger_config: { table_id: '__TABLE_ID__' },
      actions: [
        {
          type: 'send_whatsapp',
          config: {
            phone_field: '__PHONE_FIELD__',
            message_template: 'שלום! פגישה נקבעה איתך:\n\n📅 {scheduled_at}\n📋 {title}\n\nלאישור או דחייה - השב להודעה זו.',
          },
        },
      ],
    },
  },

  {
    id: 'meeting_reminder_30min',
    name: 'תזכורת 30 דקות לפני הפגישה',
    description: 'תזכורת אוטומטית 30 דקות לפני שעת הפגישה',
    emoji: '⏰',
    category: 'meeting',
    requires: [{ type: 'phone', min_count: 1 }, { type: 'datetime', min_count: 1 }],
    template: {
      name: 'תזכורת 30 דק׳ לפני',
      description: 'תזכורת ב-WhatsApp 30 דקות לפני תחילת הפגישה',
      trigger_type: 'time_before_field',
      trigger_config: {
        table_id: '__TABLE_ID__',
        field_slug: '__DATETIME_FIELD__',
        offset_minutes: 30,
        skip_if_past: true,
      },
      actions: [
        {
          type: 'send_whatsapp',
          config: {
            phone_field: '__PHONE_FIELD__',
            message_template: '⏰ תזכורת: בעוד 30 דקות יש לנו פגישה!\n\n📋 {title}\n📅 {scheduled_at}',
          },
        },
      ],
    },
  },

  {
    id: 'meeting_reminder_day_before',
    name: 'תזכורת יום לפני הפגישה',
    description: 'תזכורת 24 שעות לפני שעת הפגישה - מפחית no-shows',
    emoji: '📅',
    category: 'meeting',
    requires: [{ type: 'phone', min_count: 1 }, { type: 'datetime', min_count: 1 }],
    template: {
      name: 'תזכורת יום לפני',
      description: 'תזכורת ב-WhatsApp 24 שעות לפני הפגישה',
      trigger_type: 'time_before_field',
      trigger_config: {
        table_id: '__TABLE_ID__',
        field_slug: '__DATETIME_FIELD__',
        offset_minutes: 24 * 60,
        skip_if_past: true,
      },
      actions: [
        {
          type: 'send_whatsapp',
          config: {
            phone_field: '__PHONE_FIELD__',
            message_template: '📅 תזכורת: יש לנו פגישה מחר!\n\n📋 {title}\n🕐 {scheduled_at}\n\nאם משהו השתנה, השב להודעה זו.',
          },
        },
      ],
    },
  },

  // ────────── General-purpose preset ──────────
  {
    id: 'task_assigned_notification',
    name: 'התראה למוקצה במשימה',
    description: 'שולח הודעת WhatsApp למי שהוקצה למשימה ברגע שהיא נוצרת',
    emoji: '🔔',
    category: 'task',
    requires: [{ type: 'phone', min_count: 1 }],
    template: {
      name: 'התראה במשימה חדשה',
      description: 'הודעה ל-assignee כשנוצרת משימה',
      trigger_type: 'record_created',
      trigger_config: { table_id: '__TABLE_ID__' },
      actions: [
        {
          type: 'send_whatsapp',
          config: {
            phone_field: '__PHONE_FIELD__',
            message_template: '🔔 משימה חדשה הוקצתה אליך:\n\n📋 {title}\n\nלעדכון סטטוס - השב להודעה זו.',
          },
        },
      ],
    },
  },
];

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tableId = searchParams.get('table_id');
  if (!tableId) return NextResponse.json({ error: 'table_id required' }, { status: 400 });

  // Get table fields to determine which presets are applicable
  const { data: fields } = await supabase
    .from('fields')
    .select('slug, type')
    .eq('table_id', tableId);

  const fieldsByType: Record<string, string[]> = {};
  for (const f of fields || []) {
    if (!fieldsByType[f.type]) fieldsByType[f.type] = [];
    fieldsByType[f.type].push(f.slug);
  }

  // Filter presets by their requirements
  const applicable = PRESETS.map((p) => {
    const missing: string[] = [];
    for (const req of p.requires) {
      const have = fieldsByType[req.type]?.length || 0;
      if (have < (req.min_count || 1)) missing.push(req.type);
    }
    return { ...p, applicable: missing.length === 0, missing_field_types: missing };
  });

  return NextResponse.json({ presets: applicable, table_fields: fieldsByType });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const { workspace_id, table_id, preset_id, phone_field_slug, datetime_field_slug } = body;

  if (!workspace_id || !table_id || !preset_id) {
    return NextResponse.json({ error: 'workspace_id, table_id, preset_id required' }, { status: 400 });
  }

  const preset = PRESETS.find((p) => p.id === preset_id);
  if (!preset) return NextResponse.json({ error: 'preset not found' }, { status: 404 });

  // Substitute placeholders
  const tpl = JSON.parse(JSON.stringify(preset.template));
  const replace = (str: string) =>
    str
      .replace(/__TABLE_ID__/g, table_id)
      .replace(/__PHONE_FIELD__/g, phone_field_slug || 'phone')
      .replace(/__DATETIME_FIELD__/g, datetime_field_slug || 'scheduled_at');

  const walk = (obj: any): any => {
    if (typeof obj === 'string') return replace(obj);
    if (Array.isArray(obj)) return obj.map(walk);
    if (obj && typeof obj === 'object') {
      const out: any = {};
      for (const k of Object.keys(obj)) out[k] = walk(obj[k]);
      return out;
    }
    return obj;
  };

  const populated = walk(tpl);

  const { data, error } = await supabase
    .from('workflows')
    .insert({
      workspace_id,
      name: populated.name,
      description: populated.description || null,
      trigger_type: populated.trigger_type,
      trigger_config: populated.trigger_config,
      actions: populated.actions,
      enabled: true,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workflow: data, preset_used: preset_id }, { status: 201 });
}
