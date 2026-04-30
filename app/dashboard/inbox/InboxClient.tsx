'use client';

/**
 * InboxClient - the interactive UI for /dashboard/inbox.
 *
 * Layout: two-pane on desktop (list + thread), single-pane on mobile
 * (list collapses when a thread is selected; back button returns to list).
 *
 * Why a single client component instead of separate sub-components: the
 * interaction model is tightly coupled (selecting in left updates right,
 * status changes in right update left badge). Keeping it together avoids
 * prop-drilling state through 3 layers.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Inbox, Clock, AlertTriangle, MessageSquare, CheckCircle2,
  XCircle, Send, ChevronRight, Loader2, User as UserIcon, Sparkles,
  Calendar, AlertOctagon, HelpCircle, CreditCard, Megaphone,
} from 'lucide-react';
import type { Escalation, EscalationReason, EscalationPriority } from '@/lib/types/database';

interface Message {
  id: string;
  text: string | null;
  direction: 'in' | 'out';
  sender_phone: string;
  sender_name: string | null;
  received_at: string;
  status: string | null;
}

// Reason → icon + Hebrew label. Centralized so the list, header, and any
// future reason-specific routing UI all read from one source.
const REASON_META: Record<EscalationReason, { icon: any; label: string; color: string }> = {
  ai_uncertain:           { icon: HelpCircle,   label: 'AI לא בטוח',     color: 'text-gray-600 bg-gray-50' },
  client_requested_human: { icon: UserIcon,     label: 'בקשה אנושית',     color: 'text-blue-700 bg-blue-50' },
  complaint:              { icon: AlertOctagon, label: 'תלונה',         color: 'text-rose-700 bg-rose-50' },
  schedule_conflict:      { icon: Calendar,     label: 'התנגשות לו"ז',  color: 'text-amber-700 bg-amber-50' },
  payment_issue:          { icon: CreditCard,   label: 'תשלום',         color: 'text-emerald-700 bg-emerald-50' },
  out_of_scope:           { icon: Megaphone,    label: 'מחוץ לטווח',    color: 'text-purple-700 bg-purple-50' },
  other:                  { icon: MessageSquare,label: 'אחר',           color: 'text-gray-600 bg-gray-50' },
};

const PRIORITY_BADGE: Record<EscalationPriority, { label: string; cls: string }> = {
  urgent: { label: 'דחוף', cls: 'bg-red-100 text-red-700 ring-1 ring-red-200' },
  normal: { label: 'רגיל', cls: 'bg-gray-100 text-gray-700' },
  low:    { label: 'נמוך', cls: 'bg-gray-50 text-gray-500' },
};

export default function InboxClient({
  escalations,
  selected,
  messages,
  currentStatus,
  counts,
  currentUserId,
}: {
  escalations: Escalation[];
  selected: Escalation | null;
  messages: Message[];
  currentStatus: string;
  counts: { open: number; in_progress: number; resolved: number };
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  // Mobile: when a thread is selected, hide the list (single-pane).
  // The user can return via the back button.
  const showList = !selected; // mobile only — desktop always shows both via CSS

  function selectEscalation(id: string) {
    startTransition(() => {
      router.push(`/dashboard/inbox?status=${currentStatus}&id=${id}`);
    });
  }

  function changeStatusFilter(status: string) {
    startTransition(() => {
      router.push(`/dashboard/inbox?status=${status}`);
    });
  }

  async function handleReply() {
    if (!selected || !reply.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/escalations/${selected.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: reply.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert('שגיאה: ' + (json.error || 'לא הצליח לשלוח'));
        setSending(false);
        return;
      }
      setReply('');
      // Refresh to pull the new message into the thread
      router.refresh();
    } catch (e: any) {
      alert('שגיאת רשת: ' + (e?.message || ''));
    } finally {
      setSending(false);
    }
  }

  async function updateStatus(action: 'take' | 'resolve' | 'dismiss') {
    if (!selected || actionBusy) return;
    let note: string | null = null;
    if (action === 'resolve') {
      note = window.prompt('סיכום הטיפול (לא חובה):') || null;
    }
    setActionBusy(true);
    try {
      const res = await fetch(`/api/escalations/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert('שגיאה: ' + (json.error || ''));
        setActionBusy(false);
        return;
      }
      router.refresh();
    } catch (e: any) {
      alert('שגיאת רשת: ' + (e?.message || ''));
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <div className="h-[calc(100vh-3rem)] flex bg-gray-50" dir="rtl">
      {/* Left pane: escalation list */}
      <aside
        className={`${showList ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[380px] md:border-l border-gray-200 bg-white`}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Inbox className="w-5 h-5 text-brand-600" />
            <h1 className="text-lg font-bold">תיבה נכנסת</h1>
          </div>
          {/* Status tabs */}
          <div className="flex items-center gap-1 text-xs">
            <FilterTab label="פתוח"     count={counts.open}        active={currentStatus === 'open'}
              onClick={() => changeStatusFilter('open')} />
            <FilterTab label="בטיפול"   count={counts.in_progress} active={currentStatus === 'in_progress'}
              onClick={() => changeStatusFilter('in_progress')} />
            <FilterTab label="טופלו"    count={counts.resolved}    active={currentStatus === 'resolved'}
              onClick={() => changeStatusFilter('resolved')} />
            <FilterTab label="הכל"      count={null}               active={currentStatus === 'all'}
              onClick={() => changeStatusFilter('all')} />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {escalations.length === 0 ? (
            <div className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-300 mb-3" />
              <p className="text-sm text-gray-600">
                {currentStatus === 'open'
                  ? 'אין escalations פתוחים. הAI מטפל בכל ההודעות בעצמו 🎉'
                  : 'אין escalations בקטגוריה זו'}
              </p>
            </div>
          ) : (
            escalations.map((e) => (
              <EscalationListItem
                key={e.id}
                escalation={e}
                isSelected={selected?.id === e.id}
                onClick={() => selectEscalation(e.id)}
                isPending={isPending}
              />
            ))
          )}
        </div>
      </aside>

      {/* Right pane: thread + actions */}
      <main className={`${showList ? 'hidden' : 'flex'} md:flex flex-1 flex-col bg-white`}>
        {!selected ? (
          <div className="flex-1 grid place-items-center text-center p-8">
            <div>
              <MessageSquare className="w-16 h-16 mx-auto text-gray-200 mb-4" />
              <h2 className="text-lg font-semibold text-gray-700 mb-1">
                בחר escalation מהרשימה
              </h2>
              <p className="text-sm text-gray-500">
                לחץ על פריט בצד ימין כדי לראות את ההיסטוריה ולהשיב
              </p>
            </div>
          </div>
        ) : (
          <>
            <ThreadHeader escalation={selected} onBack={() => router.push(`/dashboard/inbox?status=${currentStatus}`)} />
            <ThreadActions
              escalation={selected}
              currentUserId={currentUserId}
              busy={actionBusy}
              onAction={updateStatus}
            />
            <ThreadMessages escalation={selected} messages={messages} />
            {/* Reply box - only enabled when escalation is open or in_progress */}
            {(selected.status === 'open' || selected.status === 'in_progress') && (
              <ReplyBox
                value={reply}
                onChange={setReply}
                onSend={handleReply}
                sending={sending}
              />
            )}
            {(selected.status === 'resolved' || selected.status === 'dismissed') && (
              <div className="border-t border-gray-200 px-4 py-3 bg-gray-50/50 text-xs text-center text-gray-500">
                escalation זה כבר {selected.status === 'resolved' ? 'טופל' : 'נמחק'}.
                {selected.resolution_note && (
                  <div className="mt-1 italic">"{selected.resolution_note}"</div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function FilterTab({ label, count, active, onClick }: {
  label: string; count: number | null; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md transition flex items-center gap-1.5 ${
        active ? 'bg-brand-100 text-brand-800 font-medium' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
      {count !== null && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
          active ? 'bg-brand-200 text-brand-900' : 'bg-gray-200 text-gray-700'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

function EscalationListItem({ escalation, isSelected, onClick, isPending }: {
  escalation: Escalation; isSelected: boolean; onClick: () => void; isPending: boolean;
}) {
  const meta = REASON_META[escalation.reason];
  const Icon = meta.icon;
  const PriorityBadge = PRIORITY_BADGE[escalation.priority];

  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className={`w-full text-right px-4 py-3 border-b border-gray-100 transition group ${
        isSelected ? 'bg-brand-50 border-r-2 border-r-brand-600' : 'hover:bg-gray-50'
      } ${isPending ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start gap-2 mb-1">
        <div className={`w-7 h-7 rounded-md grid place-items-center shrink-0 ${meta.color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-900 truncate">
            {escalation.title || meta.label}
          </div>
          {escalation.last_message_excerpt && (
            <div className="text-xs text-gray-500 truncate mt-0.5">
              {escalation.last_message_excerpt}
            </div>
          )}
        </div>
        {escalation.priority === 'urgent' && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${PriorityBadge.cls}`}>
            {PriorityBadge.label}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-gray-400 mr-9">
        <Clock className="w-3 h-3" />
        {timeAgoHe(escalation.created_at)}
        {escalation.status === 'in_progress' && (
          <span className="text-amber-600">· בטיפול</span>
        )}
      </div>
    </button>
  );
}

function ThreadHeader({ escalation, onBack }: { escalation: Escalation; onBack: () => void }) {
  const meta = REASON_META[escalation.reason];
  const Icon = meta.icon;
  return (
    <div className="border-b border-gray-200 px-4 py-3 flex items-center gap-3">
      <button onClick={onBack} className="md:hidden p-1.5 hover:bg-gray-100 rounded-md">
        <ChevronRight className="w-5 h-5" />
      </button>
      <div className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${meta.color}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">
          {escalation.title || meta.label}
        </div>
        {escalation.source_phone && (
          <div className="text-xs text-gray-500" dir="ltr">{escalation.source_phone}</div>
        )}
      </div>
      <span className={`text-xs px-2 py-1 rounded ${PRIORITY_BADGE[escalation.priority].cls}`}>
        {PRIORITY_BADGE[escalation.priority].label}
      </span>
    </div>
  );
}

function ThreadActions({ escalation, currentUserId, busy, onAction }: {
  escalation: Escalation;
  currentUserId: string;
  busy: boolean;
  onAction: (a: 'take' | 'resolve' | 'dismiss') => void;
}) {
  // AI explanation banner — surfaces the reason WHY the escalation was created.
  // Distinct from the title/excerpt because it's the AI's reasoning, not the
  // client's message. Helps the human decide quickly whether AI escalated
  // appropriately or could have handled it.
  return (
    <div className="border-b border-gray-100 px-4 py-2.5 bg-amber-50/40">
      {escalation.ai_explanation && (
        <div className="flex items-start gap-2 mb-2.5 text-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-amber-900 italic">{escalation.ai_explanation}</div>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {escalation.status === 'open' && (
          <button
            onClick={() => onAction('take')}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <UserIcon className="w-3.5 h-3.5" />
            קבל לטיפול
          </button>
        )}
        {(escalation.status === 'open' || escalation.status === 'in_progress') && (
          <>
            <button
              onClick={() => onAction('resolve')}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              סמן כטופל
            </button>
            <button
              onClick={() => onAction('dismiss')}
              disabled={busy}
              className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" />
              דחה
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ThreadMessages({ escalation, messages }: { escalation: Escalation; messages: Message[] }) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-[#f0f0f0]/30">
      {messages.length === 0 ? (
        <div className="text-center text-xs text-gray-500 py-8">
          אין הודעות זמינות לשיחה זו
        </div>
      ) : (
        messages.map((m) => <MessageBubble key={m.id} message={m} />)
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isInbound = message.direction === 'in';
  // Inbound (from client) on the right (in RTL = "their side"), our outbound
  // on the left. We also use slightly different colors so it's scannable
  // even without reading: their msgs in white, our msgs in green-tinted.
  return (
    <div className={`flex ${isInbound ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
        isInbound
          ? 'bg-white text-gray-900 rounded-tr-sm'
          : 'bg-emerald-100 text-emerald-950 rounded-tl-sm'
      }`}>
        {!isInbound && (
          <div className="text-[10px] text-emerald-700 mb-0.5">
            {message.sender_name ? `נשלח על ידי ${message.sender_name}` : 'תגובה מהמערכת'}
          </div>
        )}
        <div className="whitespace-pre-wrap break-words">{message.text || <em className="text-gray-400">הודעה ריקה</em>}</div>
        <div className={`text-[10px] mt-1 ${isInbound ? 'text-gray-400' : 'text-emerald-700/70'}`}>
          {formatTime(message.received_at)}
        </div>
      </div>
    </div>
  );
}

function ReplyBox({ value, onChange, onSend, sending }: {
  value: string; onChange: (v: string) => void; onSend: () => void; sending: boolean;
}) {
  return (
    <div className="border-t border-gray-200 p-3 bg-white">
      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl+Enter / Cmd+Enter sends (matches Slack/Discord convention).
            // Plain Enter inserts a newline because clients often write
            // multi-paragraph replies.
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              onSend();
            }
          }}
          disabled={sending}
          placeholder="הקלד תגובה... (Ctrl+Enter לשליחה)"
          rows={2}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm resize-none"
        />
        <button
          onClick={onSend}
          disabled={!value.trim() || sending}
          className="px-3 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0 self-stretch"
          title="שלח (Ctrl+Enter)"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function timeAgoHe(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'עכשיו';
  if (sec < 3600) return `לפני ${Math.floor(sec / 60)} דק׳`;
  if (sec < 86400) return `לפני ${Math.floor(sec / 3600)} שע׳`;
  return `לפני ${Math.floor(sec / 86400)} ימים`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
