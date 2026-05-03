// app/dashboard/hub/crm/leads/[id]/LeadDetailClient.tsx
// Comprehensive customer file (תיק לקוח). Consumes the rich `get_lead_360`
// RPC payload and presents a unified view: contact + pipeline + AI insights
// + unified timeline + notes + related records + open escalations.
//
// The previous version of this component referenced `data.calls`, `data.sms`,
// `data.whatsapp` directly — none of which exist on the RPC's response.
// Everything is now under `channels.*`, `timeline`, `notes`, etc.
'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Phone, Mail, MessageSquare, Sparkles, Calendar,
  User, Plus, Pin, Trash2, AlertTriangle, Activity,
  StickyNote, Link2, TrendingUp,
  CheckCircle2, Loader2, X, UserPlus, ChevronLeft,
} from 'lucide-react';

// ============ Types ============
interface TimelineItem {
  type: 'call' | 'sms' | 'whatsapp' | 'voicemail' | 'note' | 'activity';
  id?: string;
  occurred_at: string;
  // call/sms/whatsapp:
  text?: string;
  message?: string;
  subject?: string;
  ai_summary?: string;
  direction?: string;
  duration_seconds?: number;
  outcome?: string;
  sentiment?: string;
  phone_number?: string;
  sender_phone?: string;
  // voicemail:
  from_name?: string;
  transcript?: string;
  priority?: string;
  status?: string;
  // note:
  body?: string;
  category?: string;
  is_pinned?: boolean;
  author_id?: string;
  // activity:
  event_type?: string;
  summary?: string;
  metadata?: any;
  actor_id?: string;
}

interface Lead360 {
  lead: {
    id: string;
    workspace_id: string;
    data: any;
    created_at: string;
    updated_at: string;
    ai_confidence: number | null;
  };
  contact: {
    name: string | null;
    phone: string;
    email: string | null;
    source: string | null;
  };
  pipeline: {
    stage: string | null;
    value: number;
    expected_close_date: string | null;
    lost_reason: string | null;
    is_converted?: boolean;
    converted_contact?: {
      id: string;
      table_id: string;
      table_name: string;
      table_slug: string;
      table_icon: string;
      data: Record<string, any>;
      created_at: string;
      converted_at: string | null;
    } | null;
  };
  ai_insights: {
    score: number;
    reason: string | null;
    scored_at: string | null;
    suggested_next_action: string;
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
  timeline: TimelineItem[];
  notes: Array<{
    id: string;
    body: string;
    category: string | null;
    is_pinned: boolean;
    author_id: string | null;
    created_at: string;
    updated_at: string;
  }>;
  activity: TimelineItem[];
  related_records: Array<{
    record_id: string;
    table_slug: string;
    table_name: string;
    data: any;
    created_at: string;
  }>;
  open_escalations: Array<{
    id: string;
    title: string | null;
    reason: string;
    status: string;
    priority: string;
    last_message_excerpt: string | null;
    ai_explanation: string | null;
    created_at: string;
  }>;
  channels: {
    calls: any[];
    sms: any[];
    whatsapp: any[];
    voicemails: any[];
  };
}

// ============ Constants ============
const STAGES = [
  { key: 'new', label: 'חדש', color: '#3B82F6' },
  { key: 'contacted', label: 'יצרנו קשר', color: '#8B5CF6' },
  { key: 'qualified', label: 'מוסמך', color: '#F59E0B' },
  { key: 'proposal', label: 'הצעה נשלחה', color: '#FB923C' },
  { key: 'negotiation', label: 'משא ומתן', color: '#EC4899' },
  { key: 'won', label: 'נסגר', color: '#10B981' },
  { key: 'lost', label: 'אבוד', color: '#EF4444' },
];

const SOURCES: Record<string, string> = {
  referral: '🤝 הפניה',
  website: '🌐 אתר',
  google: '🔍 גוגל',
  whatsapp: '💬 וואטסאפ',
  facebook: '📘 פייסבוק',
  instagram: '📷 אינסטגרם',
  cold_call: '📞 שיחת קור',
  other: '➕ אחר',
};

const CATEGORY_LABELS: Record<string, string> = {
  general: '📝 כללי',
  meeting: '🤝 פגישה',
  follow_up: '🔁 מעקב',
  objection: '⚠️ התנגדות',
  decision: '✅ החלטה',
};

// ============ Helpers ============
function fmt(n: any): string {
  if (n === null || n === undefined || n === '') return '₪0';
  const num = Number(n);
  if (!isFinite(num)) return '₪0';
  if (num >= 1_000_000) return '₪' + (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return '₪' + Math.round(num / 1_000) + 'K';
  return '₪' + num.toLocaleString('he-IL');
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleString('he-IL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'עכשיו';
    if (minutes < 60) return `לפני ${minutes} ד'`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `לפני ${hours} שע'`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `לפני ${days} ימים`;
    const months = Math.floor(days / 30);
    return `לפני ${months} ח'`;
  } catch {
    return '';
  }
}

function normalizePhoneForWa(phone: string): string {
  // Israeli phone: 0501234567 -> 972501234567
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return digits;
}

// ============ Sub-components ============

function StageSelector({
  current, updating, onChange,
}: {
  current: string | null;
  updating: boolean;
  onChange: (s: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STAGES.map(s => (
        <button
          key={s.key}
          onClick={() => onChange(s.key)}
          disabled={updating}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            s.key === current
              ? 'text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          } ${updating ? 'opacity-50 cursor-wait' : ''}`}
          style={s.key === current ? { backgroundColor: s.color } : {}}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function QuickActionsBar({
  phone, email,
  onAddNote,
}: {
  phone: string;
  email: string | null;
  onAddNote: () => void;
}) {
  const hasPhone = Boolean(phone && phone.trim());
  const hasEmail = Boolean(email && email.trim());
  const waPhone = hasPhone ? normalizePhoneForWa(phone) : '';

  const Btn = ({ href, onClick, icon, label, color }: any) => {
    const Tag: any = href ? 'a' : 'button';
    const props: any = href ? { href, target: href.startsWith('http') ? '_blank' : undefined, rel: 'noopener noreferrer' } : { onClick };
    return (
      <Tag
        {...props}
        className={`flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl text-xs font-medium transition-all ${color}`}
      >
        {icon}
        <span>{label}</span>
      </Tag>
    );
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      <Btn
        href={hasPhone ? `tel:${phone}` : undefined}
        icon={<Phone className="w-5 h-5" />}
        label="התקשר"
        color={hasPhone ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'}
      />
      <Btn
        href={hasPhone ? `https://wa.me/${waPhone}` : undefined}
        icon={<MessageSquare className="w-5 h-5" />}
        label="WhatsApp"
        color={hasPhone ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'}
      />
      <Btn
        href={hasEmail ? `mailto:${email}` : undefined}
        icon={<Mail className="w-5 h-5" />}
        label="אימייל"
        color={hasEmail ? 'bg-purple-50 text-purple-700 hover:bg-purple-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed pointer-events-none'}
      />
      <Btn
        onClick={onAddNote}
        icon={<Plus className="w-5 h-5" />}
        label="הוסף הערה"
        color="bg-amber-50 text-amber-700 hover:bg-amber-100"
      />
    </div>
  );
}

function AIInsightCard({ insights }: { insights: Lead360['ai_insights'] }) {
  const score = insights.score || 0;
  const scoreColor =
    score >= 80 ? '#EF4444' : score >= 60 ? '#F59E0B' : score >= 40 ? '#3B82F6' : '#94A3B8';
  const scoreLabel =
    score >= 80 ? 'חם' : score >= 60 ? 'מבטיח' : score >= 40 ? 'בינוני' : 'קר';

  return (
    <div className="bg-gradient-to-br from-purple-600 to-purple-800 text-white rounded-2xl p-5 shadow-md">
      <div className="flex items-start gap-3 mb-3">
        <div className="bg-white/20 backdrop-blur rounded-lg p-2">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-sm">AI Insights</h3>
          {insights.scored_at && (
            <p className="text-xs opacity-75">חושב {timeAgo(insights.scored_at)}</p>
          )}
        </div>
        <div className="text-left">
          <div className="text-3xl font-bold leading-none">{score}</div>
          <div
            className="text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block"
            style={{ backgroundColor: scoreColor }}
          >
            {scoreLabel}
          </div>
        </div>
      </div>

      {insights.reason && (
        <div className="bg-white/10 backdrop-blur rounded-lg p-3 mb-3 text-sm">
          <div className="text-xs opacity-75 mb-1">למה הציון הזה?</div>
          <p>{insights.reason}</p>
        </div>
      )}

      <div className="bg-white/15 backdrop-blur rounded-lg p-3 border-r-4 border-yellow-300">
        <div className="text-xs opacity-90 mb-1 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" /> צעד הבא מומלץ
        </div>
        <p className="text-sm font-medium">{insights.suggested_next_action}</p>
      </div>
    </div>
  );
}

function TimelineItemCard({ item }: { item: TimelineItem }) {
  const isOut = item.direction === 'outbound';
  let icon = '📝';
  let title = 'אירוע';
  let body: string | null = null;
  let bgColor = 'bg-gray-50 border-gray-100';

  if (item.type === 'call') {
    icon = '📞';
    title = item.subject || 'שיחת טלפון';
    if (item.duration_seconds) {
      const m = Math.floor(item.duration_seconds / 60);
      const s = item.duration_seconds % 60;
      title += ` (${m}:${s.toString().padStart(2, '0')})`;
    }
    body = item.ai_summary || item.outcome || null;
    bgColor = 'bg-cyan-50 border-cyan-100';
  } else if (item.type === 'sms') {
    icon = '💬';
    title = isOut ? 'SMS יוצא' : 'SMS נכנס';
    body = item.message || null;
    bgColor = 'bg-blue-50 border-blue-100';
  } else if (item.type === 'whatsapp') {
    icon = '🟢';
    title = isOut ? 'WhatsApp יוצא' : 'WhatsApp נכנס';
    body = item.text || null;
    bgColor = 'bg-green-50 border-green-100';
  } else if (item.type === 'voicemail') {
    icon = '📧';
    title = `הודעה קולית${item.from_name ? ` מ-${item.from_name}` : ''}`;
    body = item.transcript || null;
    bgColor = 'bg-orange-50 border-orange-100';
  } else if (item.type === 'note') {
    icon = item.is_pinned ? '📌' : '📝';
    const cat = item.category ? CATEGORY_LABELS[item.category] || item.category : 'הערה';
    title = `${cat}${item.is_pinned ? ' (נעוץ)' : ''}`;
    body = item.body || null;
    bgColor = 'bg-yellow-50 border-yellow-100';
  } else if (item.type === 'activity') {
    icon = '⚡';
    title = item.summary || item.event_type || 'שינוי';
    body = null;
    bgColor = 'bg-purple-50 border-purple-100';
  }

  return (
    <div className="flex gap-3 relative">
      <div className="w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center text-lg flex-shrink-0 z-10 shadow-sm">
        {icon}
      </div>
      <div className={`flex-1 rounded-xl p-3 border ${bgColor} min-w-0`}>
        <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
          <h4 className="font-medium text-gray-900 text-sm">
            {title}
            {item.direction && (item.type === 'call' || item.type === 'sms' || item.type === 'whatsapp') && (
              <span className="text-xs text-gray-500 mr-2 font-normal">
                {isOut ? '↗ יוצא' : '↙ נכנס'}
              </span>
            )}
          </h4>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {timeAgo(item.occurred_at)}
          </span>
        </div>
        {body && (
          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
            {item.type === 'call' && item.ai_summary ? `סיכום AI: ${body}` : body}
          </p>
        )}
        <div className="text-[10px] text-gray-400 mt-1">{fmtDate(item.occurred_at)}</div>
      </div>
    </div>
  );
}

// ============ Main Component ============
export default function LeadDetailClient({
  initialData,
  currentUserId,
}: {
  initialData: Lead360;
  currentUserId: string;
}) {
  const [data, setData] = useState<Lead360>(initialData);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'notes' | 'related' | 'escalations'>('timeline');
  const [, startTransition] = useTransition();

  // Note composer state
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteBody, setNoteBody] = useState('');
  const [noteCategory, setNoteCategory] = useState<string>('general');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  // Convert-to-customer modal state. Opens when the user clicks the
  // "המר ללקוח" button (visible when stage=won and not yet converted).
  // The modal lets the user review/edit the auto-mapped values before
  // committing. We keep this UI inline to avoid an extra component file
  // for a flow that's strongly coupled to the lead's data.
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [converting, setConverting] = useState(false);

  const lead = data.lead;
  const leadData = lead.data || {};
  const contact = data.contact;
  const pipeline = data.pipeline;
  const insights = data.ai_insights;
  const counts = data.counts;
  const timeline = data.timeline || [];
  const notes = data.notes || [];
  const related = data.related_records || [];
  const escalations = data.open_escalations || [];

  const currentStage = pipeline.stage || leadData.stage || 'new';
  const stageInfo = STAGES.find(s => s.key === currentStage) || STAGES[0];
  const sourceLabel = contact.source ? SOURCES[contact.source] || contact.source : null;

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  }

  async function handleStageChange(newStage: string) {
    if (newStage === currentStage || updating) return;
    setUpdating(true);

    const prev = data;
    setData(d => ({
      ...d,
      pipeline: { ...d.pipeline, stage: newStage },
      lead: { ...d.lead, data: { ...d.lead.data, stage: newStage } },
    }));

    try {
      const res = await fetch('/api/crm/lead-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: lead.id, new_stage: newStage }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        setData(prev);
        showError(result.error || 'עדכון נכשל');
      }
    } catch {
      setData(prev);
      showError('שגיאת רשת');
    } finally {
      setUpdating(false);
    }
  }

  async function handleAddNote() {
    if (!noteBody.trim() || noteSubmitting) return;
    setNoteSubmitting(true);

    try {
      const res = await fetch('/api/crm/lead-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          body: noteBody.trim(),
          category: noteCategory,
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        showError(result.error || 'הוספת הערה נכשלה');
        return;
      }
      // Optimistic insert + drop into timeline as 'note' item
      const now = new Date().toISOString();
      const newNote = {
        id: result.note.id,
        body: noteBody.trim(),
        category: noteCategory,
        is_pinned: false,
        author_id: currentUserId,
        created_at: now,
        updated_at: now,
      };
      setData(d => ({
        ...d,
        notes: [newNote, ...d.notes],
        counts: { ...d.counts, notes: d.counts.notes + 1 },
        timeline: [
          {
            type: 'note' as const,
            id: newNote.id,
            body: newNote.body,
            category: newNote.category,
            is_pinned: false,
            author_id: currentUserId,
            occurred_at: now,
          },
          ...d.timeline,
        ],
      }));
      setNoteBody('');
      setShowNoteForm(false);
      setActiveTab('notes');
    } catch {
      showError('שגיאת רשת');
    } finally {
      setNoteSubmitting(false);
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm('למחוק את ההערה?')) return;

    const prev = data;
    setData(d => ({
      ...d,
      notes: d.notes.filter(n => n.id !== noteId),
      timeline: d.timeline.filter(t => !(t.type === 'note' && t.id === noteId)),
      counts: { ...d.counts, notes: Math.max(0, d.counts.notes - 1) },
    }));

    try {
      const res = await fetch(`/api/crm/lead-note?id=${noteId}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok || !result.success) {
        setData(prev);
        showError(result.error || 'מחיקה נכשלה');
      }
    } catch {
      setData(prev);
      showError('שגיאת רשת');
    }
  }

  async function handleTogglePin(noteId: string, isPinned: boolean) {
    setData(d => ({
      ...d,
      notes: d.notes
        .map(n => (n.id === noteId ? { ...n, is_pinned: !isPinned } : n))
        .sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }),
    }));

    try {
      const res = await fetch('/api/crm/lead-note', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: noteId, is_pinned: !isPinned }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) showError(result.error || 'פעולה נכשלה');
    } catch {
      showError('שגיאת רשת');
    }
  }

  /**
   * Convert this lead into a customer record. Hits POST /api/leads/[id]/convert-to-customer
   * which:
   *   - Creates a new customer record with mapped fields
   *   - Sets bidirectional conversion_links on both records
   *   - Writes activity log entries on both
   *
   * On success, we update local state to reflect the new converted_contact
   * (so the green "✓ Converted" banner replaces the call-to-action banner
   * without needing a page reload).
   */
  async function handleConvert(overrides: Record<string, any>) {
    setConverting(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/convert-to-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides }),
      });
      const result = await res.json();
      if (!res.ok) {
        showError(result.error || 'שגיאה בהמרה');
        setConverting(false);
        return;
      }

      // Locally project what the next get_lead_360 will return so the UI
      // updates instantly. The shape mirrors the RPC's converted_contact.
      setData((d) => ({
        ...d,
        pipeline: {
          ...d.pipeline,
          is_converted: true,
          converted_contact: {
            id: result.customer.id,
            table_id: result.customer.table_id,
            table_name: 'לקוחות',
            table_slug: 'customers',
            table_icon: '👤',
            data: result.customer.data || {},
            created_at: result.customer.created_at,
            converted_at: new Date().toISOString(),
          },
        },
      }));
      setShowConvertModal(false);
    } catch (e: any) {
      showError(e?.message || 'שגיאת רשת');
    } finally {
      setConverting(false);
    }
  }

  // Banner visibility: show the call-to-action only on stage=won and only
  // if not already converted. Lost / new / contacted leads don't get this
  // banner — converting a non-won lead is unusual and would clutter the UI.
  const showConvertCTA = currentStage === 'won' && !pipeline.is_converted;
  const convertedContact = pipeline.converted_contact;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 p-4 md:p-6" dir="rtl">
      <div className="max-w-5xl mx-auto">

        {/* Top nav */}
        <header className="mb-3 flex items-center justify-between flex-wrap gap-2">
          <Link
            href="/dashboard/hub/crm/leads"
            className="text-sm bg-white px-3 py-1.5 rounded-lg border hover:bg-gray-50 flex items-center gap-1.5"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            <span>לרשימת הלידים</span>
          </Link>
          <span className="text-xs text-gray-500">עודכן {timeAgo(lead.updated_at)}</span>
        </header>

        {/* Error toast */}
        {error && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg">
            ❌ {error}
          </div>
        )}

        {/* === HERO === */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border mb-3">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 mb-2 break-words">
                {leadData.title || contact.name || 'ליד ללא כותרת'}
              </h1>
              <div className="flex items-center gap-2 flex-wrap text-sm text-gray-600">
                {contact.name && contact.name !== leadData.title && (
                  <span className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    {contact.name}
                  </span>
                )}
                {sourceLabel && (
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{sourceLabel}</span>
                )}
                <span
                  className="text-xs px-2 py-1 rounded-full text-white font-medium"
                  style={{ backgroundColor: stageInfo.color }}
                >
                  {stageInfo.label}
                </span>
              </div>
            </div>
            <div className="text-left">
              <div className="text-3xl font-bold text-gray-900">{fmt(pipeline.value)}</div>
              <div className="text-xs text-gray-500">ערך הזדמנות</div>
            </div>
          </div>

          {/* Stage selector */}
          <div className="pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500 mb-2">לחץ לשינוי שלב:</div>
            <StageSelector current={currentStage} updating={updating} onChange={handleStageChange} />
          </div>
        </div>

        {/* === CONVERT TO CUSTOMER BANNER ===
            Two states:
            1. Lead is won + not converted yet → green call-to-action button
            2. Lead is already converted → soft confirmation card with link to customer
            We show neither for stages other than 'won' to avoid clutter. */}
        {showConvertCTA && (
          <div className="bg-gradient-to-l from-emerald-500 to-green-600 text-white rounded-2xl p-4 shadow-sm mb-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-bold text-base">הליד נסגר בהצלחה! 🎉</div>
                  <div className="text-sm text-emerald-50 mt-0.5">
                    שמור את {contact.name || 'הלקוח'} במאגר הלקוחות כדי לעקוב אחריו לאורך זמן.
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowConvertModal(true)}
                className="bg-white text-emerald-700 hover:bg-emerald-50 px-4 py-2 rounded-lg font-bold text-sm shadow-sm flex items-center gap-2 shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                המר ללקוח
              </button>
            </div>
          </div>
        )}

        {convertedContact && (
          <Link
            href={`/dashboard/${convertedContact.table_id}/records/${convertedContact.id}`}
            className="block bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-400 rounded-2xl p-3 mb-3 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-emerald-700 font-semibold">הומר ללקוח</div>
                <div className="text-sm text-emerald-900 font-bold truncate">
                  {convertedContact.data?.full_name || convertedContact.data?.name || 'לקוח'} {convertedContact.table_icon}
                </div>
              </div>
              <ChevronLeft className="w-5 h-5 text-emerald-600 shrink-0" />
            </div>
          </Link>
        )}

        {/* === QUICK ACTIONS === */}
        <div className="bg-white rounded-2xl p-3 shadow-sm border mb-3">
          <QuickActionsBar
            phone={contact.phone}
            email={contact.email}
            onAddNote={() => setShowNoteForm(true)}
          />
          {contact.phone && (
            <div className="mt-2 text-xs text-center text-gray-500" dir="ltr">
              {contact.phone}
            </div>
          )}
        </div>

        {/* === AI INSIGHTS === */}
        <div className="mb-3">
          <AIInsightCard insights={insights} />
        </div>

        {/* === STATS GRID === */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <StatBox icon="💬" value={counts.total_interactions} label="אינטראקציות" />
          <StatBox icon="📞" value={counts.calls} label="שיחות" />
          <StatBox icon="📨" value={counts.sms + counts.whatsapp} label="הודעות" />
          <StatBox
            icon={counts.days_since_last_contact === null ? '🆕' : '⏰'}
            value={counts.days_since_last_contact === null ? '—' : `${counts.days_since_last_contact}י׳`}
            label={counts.days_since_last_contact === null ? 'אין מגע' : 'מאינטראקציה אחרונה'}
            warning={counts.days_since_last_contact !== null && counts.days_since_last_contact > 5}
          />
        </div>

        {/* === Open Escalations badge (if any) === */}
        {escalations.length > 0 && (
          <button
            onClick={() => setActiveTab('escalations')}
            className="w-full mb-3 bg-red-50 border border-red-200 rounded-xl p-3 text-right flex items-center gap-2 hover:bg-red-100"
          >
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div className="flex-1">
              <div className="font-bold text-red-900 text-sm">
                {escalations.length} {escalations.length === 1 ? 'אסקלציה פתוחה' : 'אסקלציות פתוחות'}
              </div>
              <div className="text-xs text-red-700">לחץ לצפייה</div>
            </div>
          </button>
        )}

        {/* === Note Composer === */}
        {showNoteForm && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border mb-3">
            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Plus className="w-4 h-4" /> הערה חדשה
            </h3>
            <select
              value={noteCategory}
              onChange={e => setNoteCategory(e.target.value)}
              className="w-full mb-2 px-3 py-2 border rounded-lg text-sm bg-white"
            >
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <textarea
              value={noteBody}
              onChange={e => setNoteBody(e.target.value)}
              placeholder="כתוב הערה..."
              className="w-full px-3 py-2 border rounded-lg text-sm min-h-[80px] resize-y"
              autoFocus
            />
            <div className="flex gap-2 mt-2 justify-end">
              <button
                onClick={() => { setShowNoteForm(false); setNoteBody(''); }}
                disabled={noteSubmitting}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
              >
                ביטול
              </button>
              <button
                onClick={handleAddNote}
                disabled={!noteBody.trim() || noteSubmitting}
                className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {noteSubmitting ? 'שומר…' : 'שמור הערה'}
              </button>
            </div>
          </div>
        )}

        {/* === TABS === */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="flex border-b border-gray-100 overflow-x-auto">
            <TabBtn active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')}>
              <Activity className="w-4 h-4" />
              ציר זמן ({timeline.length})
            </TabBtn>
            <TabBtn active={activeTab === 'notes'} onClick={() => setActiveTab('notes')}>
              <StickyNote className="w-4 h-4" />
              הערות ({counts.notes})
            </TabBtn>
            <TabBtn active={activeTab === 'related'} onClick={() => setActiveTab('related')}>
              <Link2 className="w-4 h-4" />
              קשור ({related.length})
            </TabBtn>
            {escalations.length > 0 && (
              <TabBtn active={activeTab === 'escalations'} onClick={() => setActiveTab('escalations')}>
                <AlertTriangle className="w-4 h-4 text-red-600" />
                אסקלציות ({escalations.length})
              </TabBtn>
            )}
          </div>

          <div className="p-4">
            {activeTab === 'timeline' && (
              <TimelineTab timeline={timeline} />
            )}
            {activeTab === 'notes' && (
              <NotesTab
                notes={notes}
                onAdd={() => setShowNoteForm(true)}
                onDelete={handleDeleteNote}
                onTogglePin={handleTogglePin}
                currentUserId={currentUserId}
              />
            )}
            {activeTab === 'related' && (
              <RelatedTab related={related} />
            )}
            {activeTab === 'escalations' && escalations.length > 0 && (
              <EscalationsTab escalations={escalations} />
            )}
          </div>
        </div>

        {/* === Lead meta footer === */}
        <div className="mt-4 text-center text-xs text-gray-400">
          ליד נוצר {fmtDate(lead.created_at)} · עודכן {fmtDate(lead.updated_at)}
        </div>

      </div>

      {/* === Convert-to-customer modal ===
          Rendered as a child of the page so it sits in the same flex stack;
          the modal portals visually via fixed positioning. We only mount it
          when open to keep the form state fresh between conversions. */}
      {showConvertModal && (
        <ConvertToCustomerModal
          contact={contact}
          pipelineValue={pipeline.value}
          submitting={converting}
          onSubmit={handleConvert}
          onClose={() => setShowConvertModal(false)}
        />
      )}
    </div>
  );
}

/**
 * ConvertToCustomerModal — preview & confirm screen for the conversion.
 *
 * The default values come from the lead (full_name, phone, email, value).
 * The user can tweak any field before clicking "צור לקוח". On submit, we
 * pass the (possibly edited) data as `overrides` to the API, which writes
 * it directly to the new customer record.
 */
function ConvertToCustomerModal({
  contact,
  pipelineValue,
  submitting,
  onSubmit,
  onClose,
}: {
  contact: { name: string | null; phone: string; email: string | null; source: string | null };
  pipelineValue: number;
  submitting: boolean;
  onSubmit: (overrides: Record<string, any>) => void;
  onClose: () => void;
}) {
  const [fullName, setFullName] = useState(contact.name || '');
  const [phone, setPhone] = useState(contact.phone || '');
  const [email, setEmail] = useState(contact.email || '');
  const [lifetimeValue, setLifetimeValue] = useState<string>(
    pipelineValue ? String(pipelineValue) : ''
  );

  function handleSubmit() {
    if (!fullName.trim()) return;
    const overrides: Record<string, any> = {
      full_name: fullName.trim(),
    };
    if (phone.trim()) overrides.phone = phone.trim();
    if (email.trim()) overrides.email = email.trim();
    const lv = parseFloat(lifetimeValue);
    if (!isNaN(lv) && lv > 0) overrides.lifetime_value = lv;
    onSubmit(overrides);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[92vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">המר ליד ללקוח</h2>
              <p className="text-xs text-gray-500">בדוק את הפרטים לפני יצירת רשומת הלקוח</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" aria-label="סגור">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              שם מלא <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
              placeholder="שם הלקוח"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">טלפון</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
              placeholder="0501234567"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">אימייל</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
              placeholder="example@domain.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              ערך לקוח התחלתי (₪)
              <span className="text-gray-400 font-normal mr-1">— לפי ערך ההזדמנות מהליד</span>
            </label>
            <input
              type="number"
              value={lifetimeValue}
              onChange={(e) => setLifetimeValue(e.target.value)}
              dir="ltr"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
              placeholder="0"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 mt-2">
            <div className="font-semibold mb-1">מה יקרה?</div>
            <ul className="list-disc list-inside space-y-0.5">
              <li>ייווצר רשומה חדשה בטבלת הלקוחות</li>
              <li>הליד הזה יישאר בשלב "נסגר בהצלחה" עם קישור ללקוח</li>
              <li>שיחות, הודעות, והערות יישארו זמינים בשני המקומות</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t shrink-0 bg-white">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !fullName.trim()}
            className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                ממיר...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                צור לקוח
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ Tab content components ============

function TimelineTab({ timeline }: { timeline: TimelineItem[] }) {
  if (timeline.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-4xl mb-2">📭</div>
        <p className="text-sm">אין עדיין אינטראקציות</p>
        <p className="text-xs mt-1">שיחות, SMS, וואטסאפ והערות יופיעו כאן בכרונולוגיה</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {timeline.map((item, idx) => (
        <TimelineItemCard key={`${item.type}-${item.id || idx}`} item={item} />
      ))}
    </div>
  );
}

function NotesTab({
  notes, onAdd, onDelete, onTogglePin, currentUserId,
}: {
  notes: Lead360['notes'];
  onAdd: () => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  currentUserId: string;
}) {
  if (notes.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-4xl mb-2">📝</div>
        <p className="text-sm">אין עדיין הערות</p>
        <button
          onClick={onAdd}
          className="mt-3 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
        >
          הוסף הערה ראשונה
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {notes.map(n => {
        const cat = n.category ? CATEGORY_LABELS[n.category] || n.category : null;
        const mine = n.author_id === currentUserId;
        return (
          <div
            key={n.id}
            className={`rounded-xl p-3 border ${
              n.is_pinned ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-100'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 flex-wrap">
                {cat && <span className="text-xs font-medium text-gray-700">{cat}</span>}
                {n.is_pinned && (
                  <span className="text-xs bg-yellow-200 text-yellow-900 px-2 py-0.5 rounded-full">
                    📌 נעוץ
                  </span>
                )}
                <span className="text-xs text-gray-500">{timeAgo(n.created_at)}</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => onTogglePin(n.id, n.is_pinned)}
                  className="p-1 rounded hover:bg-white text-gray-500"
                  title={n.is_pinned ? 'בטל נעיצה' : 'נעץ'}
                >
                  <Pin className={`w-4 h-4 ${n.is_pinned ? 'fill-current' : ''}`} />
                </button>
                {mine && (
                  <button
                    onClick={() => onDelete(n.id)}
                    className="p-1 rounded hover:bg-white text-red-500"
                    title="מחק"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{n.body}</p>
          </div>
        );
      })}
      <button
        onClick={onAdd}
        className="w-full mt-2 px-4 py-2 bg-purple-50 text-purple-700 text-sm rounded-lg hover:bg-purple-100 flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4" /> הוסף הערה
      </button>
    </div>
  );
}

function RelatedTab({ related }: { related: Lead360['related_records'] }) {
  if (related.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-4xl mb-2">🔗</div>
        <p className="text-sm">אין רשומות קשורות</p>
        <p className="text-xs mt-1">פרויקטים, עסקאות, או קבוצות אחרות באותו מספר טלפון יופיעו כאן</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {related.map(r => (
        <div key={r.record_id} className="rounded-xl p-3 border bg-gray-50 border-gray-100">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-medium px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
              {r.table_name}
            </span>
            <span className="text-xs text-gray-500">{timeAgo(r.created_at)}</span>
          </div>
          <div className="text-sm text-gray-800 break-words">
            {r.data?.title || r.data?.name || r.data?.subject || `רשומה ${r.record_id.slice(0, 8)}`}
          </div>
          {(r.data?.value || r.data?.amount) && (
            <div className="text-xs text-gray-500 mt-1">{fmt(r.data.value || r.data.amount)}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function EscalationsTab({ escalations }: { escalations: Lead360['open_escalations'] }) {
  return (
    <div className="space-y-2">
      {escalations.map(e => {
        const priorityColor =
          e.priority === 'urgent' ? 'bg-red-100 text-red-800' :
          e.priority === 'high' ? 'bg-orange-100 text-orange-800' :
          e.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
          'bg-gray-100 text-gray-800';
        return (
          <div key={e.id} className="rounded-xl p-3 border border-red-200 bg-red-50">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1">
                <h4 className="font-bold text-red-900 text-sm">
                  {e.title || e.reason}
                </h4>
                {e.title && (
                  <p className="text-xs text-red-700 mt-0.5">{e.reason}</p>
                )}
              </div>
              <div className="flex flex-col gap-1 items-end">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColor}`}>
                  {e.priority}
                </span>
                <span className="text-xs text-gray-500">{timeAgo(e.created_at)}</span>
              </div>
            </div>
            {e.last_message_excerpt && (
              <div className="text-sm text-gray-700 bg-white/50 rounded-lg p-2 mb-1 italic">
                "{e.last_message_excerpt}"
              </div>
            )}
            {e.ai_explanation && (
              <p className="text-xs text-gray-600 bg-white/50 rounded-lg p-2">
                <Sparkles className="w-3 h-3 inline ml-1" />
                {e.ai_explanation}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============ Atoms ============
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-medium border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
        active
          ? 'border-purple-600 text-purple-600 bg-purple-50/50'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

function StatBox({ icon, value, label, warning }: { icon: string; value: any; label: string; warning?: boolean }) {
  return (
    <div className={`bg-white rounded-xl p-3 border shadow-sm text-center ${warning ? 'border-orange-300 bg-orange-50' : ''}`}>
      <div className="text-xl mb-1">{icon}</div>
      <div className={`text-xl font-bold ${warning ? 'text-orange-700' : 'text-gray-900'}`}>{value}</div>
      <div className="text-[11px] text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
