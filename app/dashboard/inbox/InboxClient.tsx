'use client';

/**
 * InboxClient - WhatsApp-Web-style escalation inbox.
 *
 * Layout (matches WA Web visual hierarchy):
 *   - Left pane (380px): conversation list w/ avatars, last message preview,
 *     time, unread badge. Search at the top, filter tabs below.
 *   - Right pane (flex-1): when a thread selected, shows:
 *       * Header bar (bg #f0f2f5): avatar + name + last-seen + actions
 *       * AI explanation banner (escalation-specific, not in WA Web)
 *       * Thread area (wa-chat-bg doodle bg): bubbles with tails, date
 *         separators, ticks, search highlighting
 *       * Composer bar: emoji + quick replies + textarea + send/voice
 *
 * Mobile collapses to single-pane: list visible by default, switches to
 * thread when an escalation is selected (back button returns to list).
 */

import { useState, useMemo, useRef, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, Search, MoreVertical, Send, Smile, Paperclip,
  CheckCircle2, XCircle, Clock, AlertOctagon, Calendar,
  HelpCircle, CreditCard, Megaphone, MessageSquare, User as UserIcon,
  Sparkles, Inbox as InboxIcon, Phone, X, Filter, Check, FileText, Loader2,
  UserPlus, BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import type { Escalation, EscalationReason, EscalationPriority } from '@/lib/types/database';
import Avatar from '@/components/inbox/Avatar';
import EmojiPicker from '@/components/inbox/EmojiPicker';
import QuickRepliesPicker from '@/components/inbox/QuickRepliesPicker';

interface Message {
  id: string;
  text: string | null;
  direction: 'in' | 'out';
  sender_phone: string;
  sender_name: string | null;
  received_at: string;
  status: string | null;
}

// Reason → metadata (icon + Hebrew label + colors)
const REASON_META: Record<EscalationReason, { icon: any; label: string; tag: string }> = {
  ai_uncertain:           { icon: HelpCircle,    label: 'AI לא בטוח',    tag: 'bg-gray-100 text-gray-700' },
  client_requested_human: { icon: UserIcon,      label: 'בקשה אנושית',   tag: 'bg-blue-100 text-blue-700' },
  complaint:              { icon: AlertOctagon,  label: 'תלונה',         tag: 'bg-rose-100 text-rose-700' },
  schedule_conflict:      { icon: Calendar,      label: 'התנגשות לו"ז', tag: 'bg-amber-100 text-amber-700' },
  payment_issue:          { icon: CreditCard,    label: 'תשלום',         tag: 'bg-emerald-100 text-emerald-700' },
  out_of_scope:           { icon: Megaphone,     label: 'מחוץ לטווח',    tag: 'bg-purple-100 text-purple-700' },
  other:                  { icon: MessageSquare, label: 'אחר',           tag: 'bg-gray-100 text-gray-700' },
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

  // List search - filters the left pane in real time
  const [listSearch, setListSearch] = useState('');

  // Thread search - opens an in-thread search bar (WA Web has a search icon
  // in the thread header that toggles this)
  const [threadSearch, setThreadSearch] = useState('');
  const [showThreadSearch, setShowThreadSearch] = useState(false);

  // Composer extras
  const [showEmoji, setShowEmoji] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  const composerRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever messages change. Mimics WA Web behavior.
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages.length, selected?.id]);

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

  function insertAtCursor(text: string) {
    const el = composerRef.current;
    if (!el) {
      setReply((r) => r + text);
      return;
    }
    const start = el.selectionStart ?? reply.length;
    const end = el.selectionEnd ?? reply.length;
    const next = reply.slice(0, start) + text + reply.slice(end);
    setReply(next);
    // Restore caret position after the inserted text
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + text.length, start + text.length);
    });
  }

  // Filter the list by search query. Match on title, customer name (derived
  // from messages, but we don't have it cheaply — use last_message_excerpt
  // and source_phone as fallbacks).
  const filteredEscalations = useMemo(() => {
    if (!listSearch.trim()) return escalations;
    const q = listSearch.toLowerCase();
    return escalations.filter((e) =>
      (e.title?.toLowerCase().includes(q)) ||
      (e.last_message_excerpt?.toLowerCase().includes(q)) ||
      (e.source_phone?.toLowerCase().includes(q))
    );
  }, [escalations, listSearch]);

  // Mobile: hide list when a thread is selected. Single-pane on phones.
  const showList = !selected;

  // Customer display name - prefer the wa_messages sender_name (most accurate
  // because it comes from WhatsApp itself), fall back to phone number.
  const customerName = useMemo(() => {
    if (!selected) return null;
    const inbound = messages.find((m) => m.direction === 'in' && m.sender_name);
    if (inbound?.sender_name) return inbound.sender_name;
    return selected.source_phone || 'לקוח/ה';
  }, [selected, messages]);

  return (
    <div className="h-[calc(100vh-3rem)] flex bg-gray-100" dir="rtl">
      {/* ─────────── LEFT PANE: Conversation list ─────────── */}
      <aside
        className={`${showList ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[380px] md:border-l border-gray-200 wa-list-bg`}
      >
        {/* Header bar w/ title and (eventual) account actions */}
        <div className="wa-header-bg px-4 py-2.5 flex items-center justify-between">
          <h1 className="text-base font-semibold text-gray-900">תיבה נכנסת</h1>
          <div className="flex items-center gap-2">
            <Link 
              href="/dashboard/inbox/insights"
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
              title="תובנות ואנליטיקה"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>תובנות</span>
            </Link>
            <span className="text-xs text-gray-500">{counts.open} פתוח{counts.open === 1 ? '' : 'ים'}</span>
          </div>
        </div>

        {/* Search bar - WhatsApp Web style: pill input on light bg */}
        <div className="px-3 py-2 wa-list-bg border-b border-gray-100">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="חפש שיחה..."
              className="w-full pr-10 pl-3 py-2 bg-gray-50 rounded-lg text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500/30 transition"
            />
            {listSearch && (
              <button
                onClick={() => setListSearch('')}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="px-2 py-2 border-b border-gray-100 flex items-center gap-1 overflow-x-auto wa-list-bg">
          <FilterTab label="פתוח"   count={counts.open}        active={currentStatus === 'open'}        onClick={() => changeStatusFilter('open')} />
          <FilterTab label="בטיפול" count={counts.in_progress} active={currentStatus === 'in_progress'} onClick={() => changeStatusFilter('in_progress')} />
          <FilterTab label="טופלו"  count={counts.resolved}    active={currentStatus === 'resolved'}    onClick={() => changeStatusFilter('resolved')} />
          <FilterTab label="הכל"    count={null}               active={currentStatus === 'all'}         onClick={() => changeStatusFilter('all')} />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto wa-list-bg">
          {filteredEscalations.length === 0 ? (
            <EmptyState
              listSearch={listSearch}
              currentStatus={currentStatus}
            />
          ) : (
            filteredEscalations.map((e) => (
              <ConversationListItem
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

      {/* ─────────── RIGHT PANE: Thread + composer ─────────── */}
      <main className={`${showList ? 'hidden' : 'flex'} md:flex flex-1 flex-col`}>
        {!selected ? (
          <EmptyThreadState />
        ) : (
          <>
            {/* Thread header - WA Web style: avatar + name + actions */}
            <ThreadHeader
              escalation={selected}
              customerName={customerName || 'לקוח/ה'}
              onBack={() => router.push(`/dashboard/inbox?status=${currentStatus}`)}
              onToggleSearch={() => setShowThreadSearch((v) => !v)}
            />

            {/* In-thread search bar (toggle) */}
            {showThreadSearch && (
              <div className="border-b border-gray-200 bg-white px-4 py-2 flex items-center gap-2">
                <Search className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={threadSearch}
                  onChange={(e) => setThreadSearch(e.target.value)}
                  placeholder="חפש בשיחה..."
                  autoFocus
                  className="flex-1 text-sm focus:outline-none"
                />
                <button
                  onClick={() => { setShowThreadSearch(false); setThreadSearch(''); }}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            )}

            {/* AI explanation banner - escalation-specific, not part of WA Web */}
            {selected.ai_explanation && (
              <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5 flex items-start gap-2 text-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-amber-900 italic flex-1">
                  <strong className="font-medium not-italic">AI escalated:</strong> {selected.ai_explanation}
                </div>
              </div>
            )}

            {/* Action bar - take / resolve / dismiss */}
            <ActionBar
              escalation={selected}
              busy={actionBusy}
              onAction={updateStatus}
            />

            {/* Messages with WA-style chat bg */}
            <div className="flex-1 overflow-y-auto wa-chat-bg px-4 py-4">
              <MessagesArea
                messages={messages}
                searchHighlight={threadSearch}
              />
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            {(selected.status === 'open' || selected.status === 'in_progress') ? (
              <Composer
                value={reply}
                onChange={setReply}
                onSend={handleReply}
                sending={sending}
                composerRef={composerRef}
                showEmoji={showEmoji}
                onToggleEmoji={() => { setShowEmoji((v) => !v); setShowQuickReplies(false); }}
                showQuickReplies={showQuickReplies}
                onToggleQuickReplies={() => { setShowQuickReplies((v) => !v); setShowEmoji(false); }}
                onInsertEmoji={(e) => insertAtCursor(e)}
                onApplyTemplate={(t) => setReply(t)}
                customerName={customerName}
              />
            ) : (
              <div className="border-t border-gray-200 px-4 py-3 wa-header-bg text-xs text-center text-gray-600">
                escalation זה כבר {selected.status === 'resolved' ? 'טופל' : 'נסגר ללא טיפול'}.
                {selected.resolution_note && (
                  <div className="mt-1 italic text-gray-500">"{selected.resolution_note}"</div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Sub-components
// ═════════════════════════════════════════════════════════════════════════

function FilterTab({ label, count, active, onClick }: {
  label: string; count: number | null; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1.5 whitespace-nowrap ${
        active
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-transparent text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
      {count !== null && count > 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
          active ? 'bg-emerald-200 text-emerald-900' : 'bg-gray-200 text-gray-700'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

function ConversationListItem({ escalation, isSelected, onClick, isPending }: {
  escalation: Escalation; isSelected: boolean; onClick: () => void; isPending: boolean;
}) {
  const meta = REASON_META[escalation.reason];
  const ReasonIcon = meta.icon;
  const isUrgent = escalation.priority === 'urgent';
  const isInProgress = escalation.status === 'in_progress';
  const isResolved = escalation.status === 'resolved' || escalation.status === 'dismissed';

  // Display name — prefer escalation.title, fall back to "Phone".
  // Title format from demo data: "שני כהן רוצה לשנות תור" → use first part
  // ("שני כהן") as the avatar/heading. We split at first space-after-2-words
  // heuristic.
  const displayName = (() => {
    const t = escalation.title || '';
    // Try to take first 2 Hebrew words as the name
    const words = t.split(/\s+/);
    if (words.length >= 2) return words.slice(0, 2).join(' ');
    return t || escalation.source_phone || 'לקוח/ה';
  })();

  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className={`w-full text-right px-3 py-3 flex gap-3 items-start border-b border-gray-100 transition ${
        isSelected
          ? 'wa-list-active'
          : 'wa-list-hover'
      } ${isPending ? 'opacity-70' : ''} ${isResolved ? 'opacity-75' : ''}`}
    >
      <Avatar name={displayName} size={48} />

      <div className="flex-1 min-w-0">
        {/* Top row: name + time */}
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <div className="font-medium text-sm text-gray-900 truncate flex items-center gap-1.5">
            {displayName}
            {isInProgress && (
              <span className="text-[10px] px-1.5 py-0 rounded bg-amber-100 text-amber-700 font-medium">
                בטיפול
              </span>
            )}
          </div>
          <div className={`text-[11px] shrink-0 ${isUrgent ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
            {timeAgoCompact(escalation.created_at)}
          </div>
        </div>

        {/* Excerpt */}
        <div className="text-xs text-gray-500 truncate mb-1.5">
          {escalation.last_message_excerpt || escalation.title || meta.label}
        </div>

        {/* Bottom row: reason tag + priority badge */}
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${meta.tag}`}>
            <ReasonIcon className="w-2.5 h-2.5" />
            {meta.label}
          </span>
          {isUrgent && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">
              🔥 דחוף
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function ThreadHeader({ escalation, customerName, onBack, onToggleSearch }: {
  escalation: Escalation;
  customerName: string;
  onBack: () => void;
  onToggleSearch: () => void;
}) {
  return (
    <header className="wa-header-bg border-b border-gray-200 px-4 py-2.5 flex items-center gap-3">
      <button onClick={onBack} className="md:hidden p-1.5 hover:bg-black/5 rounded-full">
        <ArrowRight className="w-5 h-5" />
      </button>
      <Avatar name={customerName} size={40} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">
          {customerName}
        </div>
        <div className="text-xs text-gray-500" dir="ltr">
          {escalation.source_phone}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleSearch}
          className="p-2 hover:bg-black/5 rounded-full transition"
          title="חפש בשיחה"
        >
          <Search className="w-5 h-5 text-gray-600" />
        </button>
        <button className="p-2 hover:bg-black/5 rounded-full transition" title="עוד פעולות">
          <MoreVertical className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </header>
  );
}

function ActionBar({ escalation, busy, onAction }: {
  escalation: Escalation;
  busy: boolean;
  onAction: (a: 'take' | 'resolve' | 'dismiss') => void;
}) {
  const [converting, setConverting] = useState(false);
  const [convertResult, setConvertResult] = useState<{ ok: boolean; msg: string; lead_id?: string } | null>(null);

  async function handleConvertToLead() {
    if (converting || !escalation.id) return;
    setConverting(true);
    setConvertResult(null);
    try {
      const res = await fetch('/api/inbox/convert-to-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escalation_id: escalation.id }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        setConvertResult({ 
          ok: false, 
          msg: result.error || 'המרה נכשלה' 
        });
        return;
      }
      setConvertResult({ 
        ok: true, 
        msg: result.already_exists ? '✅ הליד כבר קיים' : '🎉 הליד נוצר!',
        lead_id: result.lead_id,
      });
    } catch {
      setConvertResult({ ok: false, msg: 'שגיאת רשת' });
    } finally {
      setConverting(false);
      setTimeout(() => setConvertResult(null), 5000);
    }
  }

  return (
    <div className="border-b border-gray-100 px-4 py-2 bg-white/80 backdrop-blur flex items-center gap-2 flex-wrap">
      {escalation.status === 'open' && (
        <button
          onClick={() => onAction('take')}
          disabled={busy}
          className="text-xs px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-1.5 transition"
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
            className="text-xs px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1.5 transition"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            סמן כטופל
          </button>
          <button
            onClick={() => onAction('dismiss')}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 inline-flex items-center gap-1.5 transition"
          >
            <XCircle className="w-3.5 h-3.5" />
            דחה
          </button>
        </>
      )}

      {/* כפתור חדש: הפוך לליד CRM */}
      {escalation.source_phone && (
        <>
          {convertResult ? (
            <div className={`text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 ${
              convertResult.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {convertResult.msg}
              {convertResult.ok && convertResult.lead_id && (
                <Link 
                  href={`/dashboard/hub/crm/leads/${convertResult.lead_id}`}
                  className="underline font-semibold hover:no-underline"
                >
                  פתח →
                </Link>
              )}
            </div>
          ) : (
            <button
              onClick={handleConvertToLead}
              disabled={converting || busy}
              className="text-xs px-3 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 inline-flex items-center gap-1.5 transition"
              title="צור ליד חדש ב-CRM מהפנייה הזו"
            >
              <UserPlus className="w-3.5 h-3.5" />
              {converting ? 'יוצר...' : 'הפוך לליד'}
            </button>
          )}
        </>
      )}

      <div className="mr-auto text-[11px] text-gray-500">
        סטטוס: <strong>{statusLabel(escalation.status)}</strong>
      </div>
    </div>
  );
}

function MessagesArea({ messages, searchHighlight }: {
  messages: Message[];
  searchHighlight: string;
}) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="w-10 h-10 mx-auto text-gray-300 mb-2" />
        <p className="text-sm text-gray-500">אין הודעות זמינות לשיחה זו</p>
      </div>
    );
  }

  // Group consecutive messages by day for the date separators.
  const grouped = groupByDay(messages);

  return (
    <>
      {grouped.map((group, gi) => (
        <div key={gi}>
          {/* Date separator pill */}
          <div className="flex justify-center my-3">
            <span className="wa-date-pill">{formatDayLabel(group.date)}</span>
          </div>

          {/* Messages */}
          {group.messages.map((m, mi) => {
            // "First in run" check - if the previous message was in the same
            // direction, we hide the bubble tail (only the first bubble in
            // a sequence gets the tail). Matches WA Web rendering.
            const prev = group.messages[mi - 1];
            const isFirstInRun = !prev || prev.direction !== m.direction;
            return (
              <MessageBubble
                key={m.id}
                message={m}
                showTail={isFirstInRun}
                searchHighlight={searchHighlight}
              />
            );
          })}
        </div>
      ))}
    </>
  );
}

function MessageBubble({ message, showTail, searchHighlight }: {
  message: Message;
  showTail: boolean;
  searchHighlight: string;
}) {
  const isOut = message.direction === 'out';
  // RTL: outbound goes on the LEFT (our side), inbound on the RIGHT (their side).
  // This matches WhatsApp's Hebrew/Arabic rendering.
  const align = isOut ? 'justify-start' : 'justify-end';

  return (
    <div className={`flex ${align} mb-1`}>
      <div
        className={`max-w-[75%] sm:max-w-[65%] px-2.5 py-1.5 text-sm shadow-sm ${
          isOut
            ? showTail ? 'wa-bubble-out' : 'bg-[#d9fdd3] rounded-[7.5px]'
            : showTail ? 'wa-bubble-in' : 'bg-white rounded-[7.5px]'
        }`}
        style={{ wordBreak: 'break-word' }}
      >
        <div className="whitespace-pre-wrap text-[14px] leading-snug text-gray-900">
          {highlightSearch(message.text || '', searchHighlight)}
          {!message.text && <em className="text-gray-400">הודעה ריקה</em>}
        </div>
        <div className={`text-[11px] mt-1 flex items-center gap-1 ${isOut ? 'justify-end text-emerald-700/80' : 'justify-end text-gray-400'}`}>
          <span>{formatTime(message.received_at)}</span>
          {isOut && (
            // WhatsApp double-tick. Single tick = sent, double-tick = delivered,
            // double-tick blue = read. We show double-gray for "sent" since we
            // don't have actual delivery receipts hooked up yet.
            <span className="text-[10px] -mr-0.5" title="נשלח">
              ✓✓
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Composer({
  value, onChange, onSend, sending, composerRef,
  showEmoji, onToggleEmoji, showQuickReplies, onToggleQuickReplies,
  onInsertEmoji, onApplyTemplate, customerName,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  composerRef: React.RefObject<HTMLTextAreaElement>;
  showEmoji: boolean;
  onToggleEmoji: () => void;
  showQuickReplies: boolean;
  onToggleQuickReplies: () => void;
  onInsertEmoji: (e: string) => void;
  onApplyTemplate: (t: string) => void;
  customerName: string | null;
}) {
  return (
    <div className="wa-header-bg border-t border-gray-200 px-3 py-2 relative">
      <div className="flex items-end gap-2">
        {/* Emoji button */}
        <div className="relative">
          <button
            type="button"
            onClick={onToggleEmoji}
            className={`p-2 rounded-full transition ${
              showEmoji ? 'bg-emerald-100 text-emerald-700' : 'hover:bg-black/5 text-gray-500'
            }`}
            title="אימוג'י"
          >
            <Smile className="w-5 h-5" />
          </button>
          {showEmoji && (
            <EmojiPicker
              onSelect={onInsertEmoji}
              onClose={onToggleEmoji}
            />
          )}
        </div>

        {/* Templates / quick replies */}
        <div className="relative">
          <button
            type="button"
            onClick={onToggleQuickReplies}
            className={`p-2 rounded-full transition ${
              showQuickReplies ? 'bg-emerald-100 text-emerald-700' : 'hover:bg-black/5 text-gray-500'
            }`}
            title="תבניות תגובה"
          >
            <FileText className="w-5 h-5" />
          </button>
          {showQuickReplies && (
            <QuickRepliesPicker
              onSelect={onApplyTemplate}
              onClose={onToggleQuickReplies}
              customerName={customerName}
            />
          )}
        </div>

        {/* Textarea - WhatsApp style: rounded white pill with auto-grow */}
        <textarea
          ref={composerRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl/Cmd+Enter sends. Plain Enter inserts newline (matches
            // WhatsApp Web - users type multi-line replies all the time).
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              onSend();
            }
          }}
          disabled={sending}
          placeholder="הקלד הודעה (Ctrl+Enter לשליחה)"
          rows={1}
          className="flex-1 px-4 py-2.5 rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none max-h-32 leading-snug"
          style={{ minHeight: '40px' }}
        />

        {/* Send button - WhatsApp green circle */}
        <button
          onClick={onSend}
          disabled={!value.trim() || sending}
          className={`p-2.5 rounded-full transition shrink-0 ${
            !value.trim() || sending
              ? 'bg-gray-300 text-gray-400 cursor-not-allowed'
              : 'wa-green-bg wa-green-bg-hover text-white shadow-md'
          }`}
          title="שלח (Ctrl+Enter)"
        >
          {sending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ listSearch, currentStatus }: {
  listSearch: string;
  currentStatus: string;
}) {
  if (listSearch) {
    return (
      <div className="p-10 text-center">
        <Search className="w-10 h-10 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-600 mb-1">לא נמצאו תוצאות עבור</p>
        <p className="text-sm font-medium text-gray-900">"{listSearch}"</p>
      </div>
    );
  }
  return (
    <div className="p-10 text-center">
      <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-300 mb-3" />
      <p className="text-sm text-gray-700 font-medium mb-1">
        {currentStatus === 'open' ? 'הכל תחת שליטה ✨' : 'אין escalations בקטגוריה זו'}
      </p>
      <p className="text-xs text-gray-500 max-w-xs mx-auto">
        {currentStatus === 'open'
          ? 'הAI מטפל בכל ההודעות בעצמו. נראה אותך כאן רק אם תוקפץ פנייה שדורשת התערבות'
          : ''}
      </p>
    </div>
  );
}

function EmptyThreadState() {
  return (
    <div className="flex-1 grid place-items-center wa-header-bg text-center px-8">
      <div>
        {/* WhatsApp-style decorative panel */}
        <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-emerald-100 grid place-items-center">
          <InboxIcon className="w-14 h-14 wa-green-text" />
        </div>
        <h2 className="text-xl font-light text-gray-700 mb-2">
          תיבה נכנסת
        </h2>
        <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
          בחר שיחה מהרשימה כדי לקרוא הודעות, להגיב ללקוחות ולסגור escalations.
          <br />
          <span className="text-xs text-gray-400 mt-2 inline-block">
            הרשימה מתעדכנת אוטומטית כשהAI יוצר escalations חדשות.
          </span>
        </p>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Helpers
// ═════════════════════════════════════════════════════════════════════════

/** Group messages into per-day chunks for the date separators. */
function groupByDay(messages: Message[]): { date: Date; messages: Message[] }[] {
  const groups: { date: Date; messages: Message[] }[] = [];
  for (const m of messages) {
    const d = new Date(m.received_at);
    const dayKey = d.toISOString().slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.date.toISOString().slice(0, 10) === dayKey) {
      last.messages.push(m);
    } else {
      groups.push({ date: d, messages: [m] });
    }
  }
  return groups;
}

/** Format a day for the date separator: היום / אתמול / 5 במאי. */
function formatDayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const dayMs = 86400000;
  const diff = Math.round((today.getTime() - target.getTime()) / dayMs);

  if (diff === 0) return 'היום';
  if (diff === 1) return 'אתמול';
  if (diff < 7) {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    return `יום ${days[target.getDay()]}`;
  }
  return target.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
}

/** Compact time-ago like WhatsApp's list (10:32, אתמול, יום שני). */
function timeAgoCompact(iso: string): string {
  const now = new Date();
  const then = new Date(iso);
  const sameDay = now.toDateString() === then.toDateString();
  if (sameDay) {
    return then.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (yesterday.toDateString() === then.toDateString()) return 'אתמול';
  const diffDays = Math.floor((now.getTime() - then.getTime()) / 86400000);
  if (diffDays < 7) {
    const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    return days[then.getDay()];
  }
  return then.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusLabel(s: string): string {
  return ({
    open: 'פתוח',
    in_progress: 'בטיפול',
    resolved: 'טופל',
    dismissed: 'נדחה',
  } as Record<string, string>)[s] || s;
}

/** Wrap matches of `query` in <mark> tags (case-insensitive). Returns
 *  React nodes so it composes nicely inside JSX. Empty/short query = no-op. */
function highlightSearch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const q = query.toLowerCase();
  const lower = text.toLowerCase();
  const result: React.ReactNode[] = [];
  let idx = 0;
  let matchAt = lower.indexOf(q);
  let key = 0;
  while (matchAt !== -1) {
    if (matchAt > idx) result.push(text.slice(idx, matchAt));
    result.push(
      <mark key={key++} className="wa-search-hit">
        {text.slice(matchAt, matchAt + query.length)}
      </mark>
    );
    idx = matchAt + query.length;
    matchAt = lower.indexOf(q, idx);
  }
  if (idx < text.length) result.push(text.slice(idx));
  return result;
}
