'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Phone, Mail, MessageCircle, Mic, FileText, Calendar,
  TrendingUp, Activity as ActivityIcon, Users, Plus, Pin, Trash2,
  ExternalLink, ArrowDownLeft, ArrowUpRight, AlertCircle, Sparkles,
  Loader2, Check, X,
} from 'lucide-react';
import type { Field } from '@/lib/types/database';

/* ============================================================================
 * Types — match the get_record_360 RPC payload shape.
 * Keep these in sync with the SQL in:
 *   supabase migrations: add_record_notes_activity_and_360_rpc
 * If you change the RPC's return shape, change this too.
 * ============================================================================ */
type TimelineItem = {
  id: string;
  type: 'call' | 'sms' | 'whatsapp' | 'voicemail' | 'note' | 'activity';
  occurred_at: string | null;
  // Type-specific extras (we render whichever are present):
  subject?: string;
  direction?: 'inbound' | 'outbound';
  duration_seconds?: number;
  outcome?: string;
  ai_summary?: string;
  message?: string;
  text?: string;
  body?: string;
  category?: string;
  is_pinned?: boolean;
  author_id?: string;
  author_name?: string;
  event_type?: string;
  summary?: string;
  metadata?: any;
  actor_name?: string;
  phone_number?: string;
  sender_phone?: string;
  from_name?: string;
  transcript?: string;
};

type Record360 = {
  record: {
    id: string;
    workspace_id: string;
    table_id: string;
    data: Record<string, any>;
    notes: string | null;
    attachment_url: string | null;
    attachment_type: string | null;
    attachment_name: string | null;
    record_number: string | null;
    source: string | null;
    created_at: string;
    updated_at: string;
  };
  table: {
    id: string;
    name: string;
    slug: string | null;
    icon: string | null;
    color: string | null;
  };
  contact: {
    name: string | null;
    phone: string | null;
    email: string | null;
    phone_field_slug: string | null;
    email_field_slug: string | null;
  };
  counts: {
    total_interactions: number;
    calls: number;
    sms: number;
    whatsapp: number;
    voicemails: number;
    notes: number;
    first_contact_at: string | null;
    last_contact_at: string | null;
    days_since_last_contact: number | null;
  };
  channels: {
    calls: any[];
    sms: any[];
    whatsapp: any[];
    voicemails: any[];
  };
  timeline: TimelineItem[];
  notes: Array<{
    id: string;
    body: string;
    category: string;
    is_pinned: boolean;
    author_id: string | null;
    author_name: string | null;
    created_at: string;
    updated_at: string;
  }>;
  activity: TimelineItem[];
  related_records: Array<{
    record_id: string;
    table_id: string;
    table_slug: string;
    table_name: string;
    table_icon: string | null;
    data: Record<string, any>;
    created_at: string;
  }>;
  conversion: {
    originated_from: {
      record_id: string;
      table_id: string;
      table_name: string;
      table_slug: string;
      table_icon: string | null;
      data: Record<string, any>;
      at: string;
    } | null;
    converted_to: {
      record_id: string;
      table_id: string;
      table_name: string;
      table_slug: string;
      table_icon: string | null;
      data: Record<string, any>;
      at: string;
    } | null;
  };
};

const NOTE_CATEGORIES = {
  general: { label: 'כללי', color: 'bg-gray-100 text-gray-700' },
  meeting: { label: 'פגישה', color: 'bg-blue-100 text-blue-700' },
  follow_up: { label: 'מעקב', color: 'bg-purple-100 text-purple-700' },
  objection: { label: 'התנגדות', color: 'bg-red-100 text-red-700' },
  decision: { label: 'החלטה', color: 'bg-green-100 text-green-700' },
} as const;

type TabKey = 'timeline' | 'notes' | 'related' | 'fields';

/* ============================================================================
 * Main client component
 * ============================================================================ */
export default function RecordDetailClient({
  tableId,
  initialData,
  fields,
  currentUserId,
}: {
  tableId: string;
  initialData: Record360;
  fields: Field[];
  currentUserId: string;
}) {
  const [data, setData] = useState<Record360>(initialData);
  const [activeTab, setActiveTab] = useState<TabKey>('timeline');
  const [composingNote, setComposingNote] = useState(false);

  const recordId = data.record.id;
  const recordName =
    data.contact.name ||
    data.record.data?.title ||
    `רשומה ${data.record.record_number || data.record.id.slice(0, 8)}`;

  // Format the WhatsApp link from the phone (if present). 0XX → 972XX.
  const waLink = useMemo(() => {
    if (!data.contact.phone) return null;
    let n = data.contact.phone.replace(/\D/g, '');
    if (n.startsWith('0')) n = '972' + n.slice(1);
    if (n.length < 7) return null;
    return `https://wa.me/${n}`;
  }, [data.contact.phone]);

  return (
    <div dir="rtl" className="max-w-4xl mx-auto p-3 sm:p-6 space-y-4">
      {/* ===== Top nav ===== */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/dashboard/${tableId}`}
          className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה ל{data.table.name}
        </Link>
        <div className="text-xs text-gray-500">
          עודכן {formatRelative(data.record.updated_at)}
        </div>
      </div>

      {/* ===== Conversion banner — shows where this record came from / where it went ===== */}
      {(data.conversion.originated_from || data.conversion.converted_to) && (
        <ConversionBanner conversion={data.conversion} />
      )}

      {/* ===== Hero card ===== */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <div
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl grid place-items-center text-2xl sm:text-3xl shrink-0"
            style={{ background: `${data.table.color || '#8B5CF6'}20` }}
          >
            {data.table.icon || '📄'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-0.5">
              <span className="font-mono">{data.record.record_number}</span>
              <span>•</span>
              <span>{data.table.name}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
              {recordName}
            </h1>
            <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-600">
              {data.contact.phone && (
                <a
                  href={`tel:${data.contact.phone}`}
                  className="flex items-center gap-1 hover:text-violet-600"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span className="font-mono">{data.contact.phone}</span>
                </a>
              )}
              {data.contact.email && (
                <a
                  href={`mailto:${data.contact.email}`}
                  className="flex items-center gap-1 hover:text-violet-600"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span className="truncate">{data.contact.email}</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-100">
          <QuickAction
            disabled={!data.contact.phone}
            href={data.contact.phone ? `tel:${data.contact.phone}` : undefined}
            icon={<Phone className="w-4 h-4" />}
            label="התקשר"
            color="bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
          />
          <QuickAction
            disabled={!waLink}
            href={waLink || undefined}
            external
            icon={<MessageCircle className="w-4 h-4" />}
            label="WhatsApp"
            color="bg-green-50 text-green-700 hover:bg-green-100"
          />
          <QuickAction
            disabled={!data.contact.email}
            href={data.contact.email ? `mailto:${data.contact.email}` : undefined}
            icon={<Mail className="w-4 h-4" />}
            label="אימייל"
            color="bg-blue-50 text-blue-700 hover:bg-blue-100"
          />
          <QuickAction
            onClick={() => {
              setComposingNote(true);
              setActiveTab('notes');
            }}
            icon={<Plus className="w-4 h-4" />}
            label="הערה"
            color="bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
          />
        </div>
      </div>

      {/* ===== Stats grid ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBox
          icon={<TrendingUp className="w-4 h-4" />}
          value={data.counts.total_interactions}
          label="אינטראקציות"
          color="text-violet-600"
        />
        <StatBox
          icon={<Phone className="w-4 h-4" />}
          value={data.counts.calls}
          label="שיחות"
          color="text-cyan-600"
        />
        <StatBox
          icon={<MessageCircle className="w-4 h-4" />}
          value={data.counts.sms + data.counts.whatsapp}
          label="הודעות"
          color="text-green-600"
        />
        <StatBox
          icon={<Calendar className="w-4 h-4" />}
          value={data.counts.days_since_last_contact ?? '—'}
          label={data.counts.days_since_last_contact === null ? 'אין קשר' : 'ימים מאז'}
          color={
            data.counts.days_since_last_contact !== null &&
            data.counts.days_since_last_contact > 5
              ? 'text-orange-600'
              : 'text-gray-600'
          }
        />
      </div>

      {/* ===== Tabs ===== */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          <TabButton
            active={activeTab === 'timeline'}
            onClick={() => setActiveTab('timeline')}
            label="ציר זמן"
            count={data.timeline.length}
          />
          <TabButton
            active={activeTab === 'notes'}
            onClick={() => setActiveTab('notes')}
            label="הערות"
            count={data.counts.notes}
          />
          <TabButton
            active={activeTab === 'related'}
            onClick={() => setActiveTab('related')}
            label="רשומות מקושרות"
            count={data.related_records.length}
          />
          <TabButton
            active={activeTab === 'fields'}
            onClick={() => setActiveTab('fields')}
            label="כל השדות"
          />
        </div>

        <div className="p-3 sm:p-4">
          {activeTab === 'timeline' && (
            <TimelineTab items={data.timeline} contactName={recordName} />
          )}
          {activeTab === 'notes' && (
            <NotesTab
              recordId={recordId}
              notes={data.notes}
              currentUserId={currentUserId}
              composing={composingNote}
              onCompose={() => setComposingNote(true)}
              onCancelCompose={() => setComposingNote(false)}
              onCreated={(note) => {
                setComposingNote(false);
                setData((prev) => ({
                  ...prev,
                  notes: [note, ...prev.notes],
                  counts: { ...prev.counts, notes: prev.counts.notes + 1 },
                  timeline: [
                    {
                      id: note.id,
                      type: 'note' as const,
                      body: note.body,
                      category: note.category,
                      is_pinned: note.is_pinned,
                      author_id: note.author_id,
                      author_name: note.author_name,
                      occurred_at: note.created_at,
                    },
                    ...prev.timeline,
                  ],
                }));
              }}
              onUpdated={(updated) => {
                setData((prev) => ({
                  ...prev,
                  notes: prev.notes.map((n) =>
                    n.id === updated.id ? { ...n, ...updated } : n
                  ),
                }));
              }}
              onDeleted={(noteId) => {
                setData((prev) => ({
                  ...prev,
                  notes: prev.notes.filter((n) => n.id !== noteId),
                  counts: {
                    ...prev.counts,
                    notes: Math.max(0, prev.counts.notes - 1),
                  },
                  timeline: prev.timeline.filter((t) => t.id !== noteId),
                }));
              }}
            />
          )}
          {activeTab === 'related' && (
            <RelatedTab records={data.related_records} />
          )}
          {activeTab === 'fields' && (
            <FieldsTab data={data.record.data} fields={fields} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * Sub-components
 * ============================================================================ */

function ConversionBanner({ conversion }: { conversion: Record360['conversion'] }) {
  return (
    <div className="space-y-2">
      {conversion.originated_from && (
        <Link
          href={`/dashboard/${conversion.originated_from.table_id}/records/${conversion.originated_from.record_id}`}
          className="flex items-center gap-2 bg-blue-50 border border-blue-200 hover:border-blue-400 rounded-lg p-3 transition-colors"
        >
          <ArrowDownLeft className="w-5 h-5 text-blue-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-blue-700 font-semibold">המקור: רשומה ב-{conversion.originated_from.table_name}</div>
            <div className="text-sm text-blue-900 truncate">
              {conversion.originated_from.table_icon || '📋'}{' '}
              {conversion.originated_from.data?.title ||
                conversion.originated_from.data?.full_name ||
                conversion.originated_from.data?.contact_name ||
                'פתח לפרטים'}
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-blue-600 shrink-0" />
        </Link>
      )}
      {conversion.converted_to && (
        <Link
          href={`/dashboard/${conversion.converted_to.table_id}/records/${conversion.converted_to.record_id}`}
          className="flex items-center gap-2 bg-green-50 border border-green-200 hover:border-green-400 rounded-lg p-3 transition-colors"
        >
          <ArrowUpRight className="w-5 h-5 text-green-600 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-xs text-green-700 font-semibold">הומר ל: רשומה ב-{conversion.converted_to.table_name}</div>
            <div className="text-sm text-green-900 truncate">
              {conversion.converted_to.table_icon || '📋'}{' '}
              {conversion.converted_to.data?.title ||
                conversion.converted_to.data?.full_name ||
                conversion.converted_to.data?.contact_name ||
                'פתח לפרטים'}
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-green-600 shrink-0" />
        </Link>
      )}
    </div>
  );
}

function QuickAction({
  icon, label, color, href, onClick, disabled, external,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  external?: boolean;
}) {
  const className = `flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-colors ${
    disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : color
  }`;
  if (disabled || (!href && !onClick)) {
    return (
      <button disabled className={className}>
        {icon}<span>{label}</span>
      </button>
    );
  }
  if (href) {
    return (
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className={className}
      >
        {icon}<span>{label}</span>
      </a>
    );
  }
  return (
    <button onClick={onClick} className={className}>
      {icon}<span>{label}</span>
    </button>
  );
}

function StatBox({
  icon, value, label, color,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
      <div className={`flex items-center justify-center gap-1 ${color}`}>
        {icon}
        <span className="text-xl font-bold">{value}</span>
      </div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function TabButton({
  active, onClick, label, count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 sm:px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
        active
          ? 'text-violet-700 border-b-2 border-violet-600'
          : 'text-gray-600 border-b-2 border-transparent hover:text-gray-900'
      }`}
    >
      {label}
      {typeof count === 'number' && count > 0 && (
        <span className="mr-1.5 text-xs bg-gray-100 px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </button>
  );
}

/* ============================================================================
 * Tab content
 * ============================================================================ */

function TimelineTab({
  items, contactName,
}: {
  items: TimelineItem[];
  contactName: string;
}) {
  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500">
        <ActivityIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">אין עדיין שום אינטראקציה.</p>
        <p className="text-xs mt-1">שיחות, הודעות, והערות יופיעו כאן.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <TimelineItemCard key={`${item.type}:${item.id}`} item={item} contactName={contactName} />
      ))}
    </div>
  );
}

function TimelineItemCard({ item, contactName }: { item: TimelineItem; contactName: string }) {
  const meta = TIMELINE_META[item.type];
  const direction = item.direction || (item.type === 'note' || item.type === 'activity' ? null : 'inbound');
  return (
    <div className={`border-r-4 ${meta.borderColor} bg-white rounded-lg p-3 hover:bg-gray-50 transition-colors`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full ${meta.bgColor} grid place-items-center shrink-0`}>
          <span className={meta.iconColor}>{meta.icon}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap text-xs">
            <span className="font-semibold text-gray-900">{meta.label}</span>
            {direction && (
              <span className="text-gray-500">
                {direction === 'inbound' ? '← נכנסת' : '→ יוצאת'}
              </span>
            )}
            {item.category && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                NOTE_CATEGORIES[item.category as keyof typeof NOTE_CATEGORIES]?.color || 'bg-gray-100 text-gray-700'
              }`}>
                {NOTE_CATEGORIES[item.category as keyof typeof NOTE_CATEGORIES]?.label || item.category}
              </span>
            )}
            {item.is_pinned && <Pin className="w-3 h-3 text-amber-500" />}
            <span className="text-gray-400 mr-auto">
              {formatRelative(item.occurred_at)}
            </span>
          </div>
          <div className="text-sm text-gray-700 break-words">
            {renderTimelineBody(item, contactName)}
          </div>
          {item.author_name && (
            <div className="text-xs text-gray-400 mt-1">— {item.author_name}</div>
          )}
        </div>
      </div>
    </div>
  );
}

const TIMELINE_META: Record<TimelineItem['type'], {
  label: string;
  icon: React.ReactNode;
  bgColor: string;
  iconColor: string;
  borderColor: string;
}> = {
  call: { label: 'שיחה', icon: <Phone className="w-4 h-4" />, bgColor: 'bg-cyan-100', iconColor: 'text-cyan-700', borderColor: 'border-cyan-400' },
  sms: { label: 'SMS', icon: <MessageCircle className="w-4 h-4" />, bgColor: 'bg-blue-100', iconColor: 'text-blue-700', borderColor: 'border-blue-400' },
  whatsapp: { label: 'WhatsApp', icon: <MessageCircle className="w-4 h-4" />, bgColor: 'bg-green-100', iconColor: 'text-green-700', borderColor: 'border-green-400' },
  voicemail: { label: 'הודעה קולית', icon: <Mic className="w-4 h-4" />, bgColor: 'bg-orange-100', iconColor: 'text-orange-700', borderColor: 'border-orange-400' },
  note: { label: 'הערה', icon: <FileText className="w-4 h-4" />, bgColor: 'bg-yellow-100', iconColor: 'text-yellow-700', borderColor: 'border-yellow-400' },
  activity: { label: 'פעילות', icon: <Sparkles className="w-4 h-4" />, bgColor: 'bg-purple-100', iconColor: 'text-purple-700', borderColor: 'border-purple-400' },
};

function renderTimelineBody(item: TimelineItem, contactName: string): React.ReactNode {
  if (item.type === 'call') {
    const dur = item.duration_seconds;
    return (
      <>
        {item.subject || item.outcome || 'שיחה'}
        {dur ? <span className="text-gray-500"> · {Math.round(dur / 60)} דק'</span> : null}
        {item.ai_summary && (
          <div className="text-xs text-gray-600 mt-1 italic">"{item.ai_summary}"</div>
        )}
      </>
    );
  }
  if (item.type === 'sms') return item.message || '(הודעה ריקה)';
  if (item.type === 'whatsapp') return item.text || '(הודעה ריקה)';
  if (item.type === 'voicemail') {
    return (
      <>
        מ{item.from_name || contactName}
        {item.transcript && <div className="text-xs text-gray-600 mt-1 italic">"{item.transcript}"</div>}
      </>
    );
  }
  if (item.type === 'note') return item.body || '';
  if (item.type === 'activity') return item.summary || item.event_type || '';
  return null;
}

function NotesTab({
  recordId, notes, currentUserId, composing, onCompose, onCancelCompose,
  onCreated, onUpdated, onDeleted,
}: {
  recordId: string;
  notes: Record360['notes'];
  currentUserId: string;
  composing: boolean;
  onCompose: () => void;
  onCancelCompose: () => void;
  onCreated: (note: any) => void;
  onUpdated: (note: any) => void;
  onDeleted: (noteId: string) => void;
}) {
  return (
    <div className="space-y-3">
      {!composing ? (
        <button
          onClick={onCompose}
          className="w-full text-right border border-dashed border-gray-300 hover:border-violet-400 hover:bg-violet-50/50 rounded-lg p-3 text-sm text-gray-600 hover:text-violet-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          הוסף הערה...
        </button>
      ) : (
        <NoteComposer
          recordId={recordId}
          onCancel={onCancelCompose}
          onCreated={onCreated}
        />
      )}
      {notes.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          אין עדיין הערות. הוסף את הראשונה.
        </div>
      ) : (
        notes.map((n) => (
          <NoteCard
            key={n.id}
            note={n}
            recordId={recordId}
            currentUserId={currentUserId}
            onUpdated={onUpdated}
            onDeleted={onDeleted}
          />
        ))
      )}
    </div>
  );
}

function NoteComposer({
  recordId, onCancel, onCreated,
}: {
  recordId: string;
  onCancel: () => void;
  onCreated: (note: any) => void;
}) {
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<string>('general');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!body.trim()) {
      setError('הוספת טקסט חובה');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/records/${recordId}/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim(), category }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'שגיאה בשמירה');
        setSubmitting(false);
        return;
      }
      // The note row from the API doesn't have author_name; fall back gracefully.
      onCreated({ ...json.note, author_name: 'אתה' });
    } catch (e: any) {
      setError(e.message || 'שגיאת רשת');
      setSubmitting(false);
    }
  }

  return (
    <div className="border border-violet-200 bg-violet-50/50 rounded-lg p-3 space-y-2">
      <div className="flex gap-1.5 flex-wrap">
        {Object.entries(NOTE_CATEGORIES).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => setCategory(key)}
            className={`text-xs px-2 py-1 rounded ${
              category === key
                ? meta.color + ' ring-2 ring-offset-1 ring-violet-300'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            {meta.label}
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="כתוב הערה..."
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-violet-500"
        autoFocus
      />
      {error && <div className="text-xs text-red-600">{error}</div>}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          disabled={submitting}
          className="text-sm px-3 py-1.5 text-gray-600 hover:text-gray-900"
        >
          ביטול
        </button>
        <button
          onClick={save}
          disabled={submitting || !body.trim()}
          className="text-sm px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5"
        >
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          שמור
        </button>
      </div>
    </div>
  );
}

function NoteCard({
  note, recordId, currentUserId, onUpdated, onDeleted,
}: {
  note: Record360['notes'][number];
  recordId: string;
  currentUserId: string;
  onUpdated: (note: any) => void;
  onDeleted: (noteId: string) => void;
}) {
  const isAuthor = note.author_id === currentUserId;
  const [busy, setBusy] = useState(false);
  const meta = NOTE_CATEGORIES[note.category as keyof typeof NOTE_CATEGORIES] || NOTE_CATEGORIES.general;

  async function togglePin() {
    setBusy(true);
    const res = await fetch(`/api/records/${recordId}/note`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note_id: note.id, is_pinned: !note.is_pinned }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      alert(json.error || 'שגיאה');
      return;
    }
    onUpdated(json.note);
  }

  async function remove() {
    if (!confirm('למחוק את ההערה?')) return;
    setBusy(true);
    const res = await fetch(`/api/records/${recordId}/note?note_id=${note.id}`, {
      method: 'DELETE',
    });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      alert(json.error || 'שגיאה');
      return;
    }
    onDeleted(note.id);
  }

  return (
    <div className={`border rounded-lg p-3 ${note.is_pinned ? 'border-amber-300 bg-amber-50/50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded ${meta.color}`}>
            {meta.label}
          </span>
          {note.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-500" />}
          <span className="text-xs text-gray-500">{formatRelative(note.created_at)}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={togglePin}
            disabled={busy}
            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-amber-600"
            title={note.is_pinned ? 'הסר נעיצה' : 'נעוץ'}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
          {isAuthor && (
            <button
              onClick={remove}
              disabled={busy}
              className="p-1 hover:bg-red-50 rounded text-gray-500 hover:text-red-600"
              title="מחק"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="text-sm text-gray-800 whitespace-pre-wrap break-words">{note.body}</div>
      {note.author_name && (
        <div className="text-xs text-gray-400 mt-1.5">— {note.author_name}</div>
      )}
    </div>
  );
}

function RelatedTab({ records }: { records: Record360['related_records'] }) {
  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        אין רשומות מקושרות.
        <div className="text-xs mt-1">רשומות בטבלאות אחרות שחולקות אותו טלפון יופיעו כאן.</div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500 mb-1">
        רשומות בטבלאות אחרות שחולקות את אותו מספר טלפון:
      </div>
      {records.map((r) => {
        const title =
          r.data?.title ||
          r.data?.full_name ||
          r.data?.contact_name ||
          r.data?.subject ||
          'ללא כותרת';
        return (
          <Link
            key={r.record_id}
            href={`/dashboard/${r.table_id}/records/${r.record_id}`}
            className="flex items-center gap-3 border border-gray-200 hover:border-violet-300 hover:bg-violet-50/30 rounded-lg p-3 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-gray-100 grid place-items-center text-lg shrink-0">
              {r.table_icon || '📋'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-500">{r.table_name}</div>
              <div className="font-medium text-gray-900 truncate">{title}</div>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}

function FieldsTab({
  data, fields,
}: {
  data: Record<string, any>;
  fields: Field[];
}) {
  if (fields.length === 0) {
    return <div className="text-center py-8 text-gray-500 text-sm">אין שדות מוגדרים.</div>;
  }
  return (
    <div className="border border-gray-200 rounded-lg divide-y">
      {fields.map((f) => {
        const value = data?.[f.slug];
        const isEmpty = value === null || value === undefined || value === '';
        return (
          <div key={f.id} className="flex items-start gap-3 p-3 text-sm">
            <div className="text-gray-500 w-28 shrink-0 break-words">{f.name}</div>
            <div className="flex-1 min-w-0">
              {isEmpty ? (
                <span className="text-gray-400 italic">ריק</span>
              ) : (
                <span className="text-gray-900 break-words">
                  {formatFieldValue(value, f)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================================
 * Helpers
 * ============================================================================ */

function formatRelative(s: string | null | undefined): string {
  if (!s) return '';
  const d = new Date(s);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  const diffH = Math.round(diffMs / 3600000);
  const diffD = Math.round(diffMs / 86400000);
  if (diffMin < 1) return 'עכשיו';
  if (diffMin < 60) return `לפני ${diffMin} דק'`;
  if (diffH < 24) return `לפני ${diffH} שעות`;
  if (diffD < 7) return `לפני ${diffD} ימים`;
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatFieldValue(value: any, field: Field): string {
  if (value === null || value === undefined || value === '') return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  if (field.type === 'currency' && typeof value === 'number') {
    return value.toLocaleString('he-IL') + ' ₪';
  }
  if (field.type === 'date' || field.type === 'datetime') {
    try {
      return new Date(value).toLocaleDateString('he-IL');
    } catch {
      return String(value);
    }
  }
  return String(value);
}
