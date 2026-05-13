// Per-event-type schema definitions for Google Sheets sync.
//
// Each schema declares:
//   - headers: human-readable column names (Hebrew)
//   - toRow(payload): maps a queue payload to an array of cell values
//                     in the same order as headers
//
// Adding a new event type? Add it here AND add it to:
//   - the CHECK constraint in 2026_05_13_google_integration_phase1.sql
//   - the EVENT_TYPES catalogue in SyncConfigsSection.tsx (UI)
//
// Why have schemas at all? Two reasons:
//   1. So the user gets meaningful column headers automatically on first
//      write (no manual setup needed in the Sheet).
//   2. So the column ordering is consistent across writes. Without this,
//      different events of the same type could write columns in different
//      orders, depending on JSON key iteration.

export type EventType =
  | 'gg_new_member'
  | 'gg_member_left'
  | 'gg_bot_action'
  | 'gg_spam_detected'
  | 'attribution_lead';

type CellValue = string | number | boolean | null;

type EventSchema<P = any> = {
  headers: string[];
  toRow: (payload: P) => CellValue[];
};

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
function fmtTimestamp(iso: string | undefined | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    // YYYY-MM-DD HH:MM:SS in user's local time — Sheets will parse as datetime
    return d.toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return iso;
  }
}

function nz(v: any): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------

const newMemberSchema: EventSchema<{
  ts: string;
  workspaceId: string;
  groupId: string;
  groupName?: string | null;
  phone: string;
  displayName?: string | null;
  profession?: string | null;
  trustScore?: number | null;
  joinedAt?: string;
}> = {
  headers: [
    'תאריך',
    'שעה',
    'קבוצה',
    'מספר טלפון',
    'שם תצוגה',
    'מקצוע',
    'דירוג אמון',
  ],
  toRow: (p) => {
    const ts = fmtTimestamp(p.joinedAt ?? p.ts);
    const [date, time] = ts.split(' ');
    return [
      date ?? '',
      time ?? '',
      nz(p.groupName ?? p.groupId),
      nz(p.phone),
      nz(p.displayName),
      nz(p.profession),
      p.trustScore ?? '',
    ];
  },
};

const memberLeftSchema: EventSchema<{
  ts: string;
  groupId: string;
  groupName?: string | null;
  phone: string;
  displayName?: string | null;
  leftAt?: string;
  reason?: string | null; // 'voluntary' | 'removed' | etc.
  removedBy?: string | null;
}> = {
  headers: [
    'תאריך',
    'שעה',
    'קבוצה',
    'מספר טלפון',
    'שם תצוגה',
    'סיבה',
    'הוסר ע"י',
  ],
  toRow: (p) => {
    const ts = fmtTimestamp(p.leftAt ?? p.ts);
    const [date, time] = ts.split(' ');
    return [
      date ?? '',
      time ?? '',
      nz(p.groupName ?? p.groupId),
      nz(p.phone),
      nz(p.displayName),
      nz(p.reason),
      nz(p.removedBy),
    ];
  },
};

const botActionSchema: EventSchema<{
  ts: string;
  groupId: string;
  groupName?: string | null;
  actionType: string; // 'delete_message' | 'remove_user' | 'warn' | ...
  targetPhone?: string | null;
  targetDisplayName?: string | null;
  reason?: string | null;
  succeeded: boolean;
  details?: string | null;
}> = {
  headers: [
    'תאריך',
    'שעה',
    'קבוצה',
    'פעולה',
    'יעד (טלפון)',
    'יעד (שם)',
    'סיבה',
    'הצליח',
    'פרטים',
  ],
  toRow: (p) => {
    const ts = fmtTimestamp(p.ts);
    const [date, time] = ts.split(' ');
    return [
      date ?? '',
      time ?? '',
      nz(p.groupName ?? p.groupId),
      nz(p.actionType),
      nz(p.targetPhone),
      nz(p.targetDisplayName),
      nz(p.reason),
      p.succeeded ? 'כן' : 'לא',
      nz(p.details),
    ];
  },
};

const spamDetectedSchema: EventSchema<{
  ts: string;
  groupId: string;
  groupName?: string | null;
  senderPhone: string;
  senderDisplayName?: string | null;
  messageSnippet?: string | null; // First ~100 chars
  spamType?: string | null; // 'link' | 'mass' | 'prefix' | 'global_blocklist' | 'ai_flagged' | ...
  confidence?: number | null;
  actionTaken?: string | null;
}> = {
  headers: [
    'תאריך',
    'שעה',
    'קבוצה',
    'שולח (טלפון)',
    'שולח (שם)',
    'תקציר הודעה',
    'סוג ספאם',
    'ביטחון',
    'פעולה שננקטה',
  ],
  toRow: (p) => {
    const ts = fmtTimestamp(p.ts);
    const [date, time] = ts.split(' ');
    return [
      date ?? '',
      time ?? '',
      nz(p.groupName ?? p.groupId),
      nz(p.senderPhone),
      nz(p.senderDisplayName),
      nz(p.messageSnippet ?? '').slice(0, 200),
      nz(p.spamType),
      p.confidence ?? '',
      nz(p.actionTaken),
    ];
  },
};

const attributionLeadSchema: EventSchema<{
  ts: string;
  campaignSlug?: string | null;
  campaignName?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  phone: string;
  displayName?: string | null;
  joined?: boolean;
  joinedGroupName?: string | null;
}> = {
  headers: [
    'תאריך',
    'שעה',
    'קמפיין',
    'מקור',
    'מדיום',
    'מספר טלפון',
    'שם',
    'הצטרף לקבוצה',
    'שם קבוצה',
  ],
  toRow: (p) => {
    const ts = fmtTimestamp(p.ts);
    const [date, time] = ts.split(' ');
    return [
      date ?? '',
      time ?? '',
      nz(p.campaignName ?? p.campaignSlug),
      nz(p.utmSource),
      nz(p.utmMedium),
      nz(p.phone),
      nz(p.displayName),
      p.joined ? 'כן' : 'לא',
      nz(p.joinedGroupName),
    ];
  },
};

// ----------------------------------------------------------------------------
// Public registry
// ----------------------------------------------------------------------------
export const SCHEMAS: Record<EventType, EventSchema> = {
  gg_new_member: newMemberSchema,
  gg_member_left: memberLeftSchema,
  gg_bot_action: botActionSchema,
  gg_spam_detected: spamDetectedSchema,
  attribution_lead: attributionLeadSchema,
};

export function getSchema(eventType: string): EventSchema | null {
  if ((Object.keys(SCHEMAS) as string[]).includes(eventType)) {
    return SCHEMAS[eventType as EventType];
  }
  return null;
}
