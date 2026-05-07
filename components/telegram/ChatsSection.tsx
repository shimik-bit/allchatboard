'use client';

/**
 * ChatsSection - everything the user sees about Telegram conversations.
 *
 * Layout: master/detail. Left side = list of chats the bot is in. Right
 * side = the selected chat's message stream + a reply box. On mobile,
 * selecting a chat replaces the list (responsive — see grid classes).
 *
 * Realtime: subscribes to telegram_messages and telegram_chats so new
 * messages appear without polling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Users,
  User,
  Image as ImageIcon,
  Video,
  Mic,
  FileText,
  MapPin,
  Phone,
  Sticker,
  Play,
  Loader2,
  ArrowRight,
  AlertCircle,
  PowerOff,
  Settings,
  X,
  Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

type ChatType = 'private' | 'group' | 'supergroup' | 'channel';

type TelegramChat = {
  id: string;
  bot_id: string;
  tg_chat_id: number;
  chat_type: ChatType;
  title: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  is_routed: boolean;
  notes: string | null;
  last_message_at: string | null;
  message_count: number;
  created_at: string;
};

type TelegramMessage = {
  id: string;
  chat_id: string;
  tg_message_id: number;
  reply_to_tg_message_id: number | null;
  direction: 'in' | 'out';
  sender_user_id: number | null;
  sender_username: string | null;
  sender_first_name: string | null;
  sender_last_name: string | null;
  sender_is_bot: boolean;
  content_type: string;
  text: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  media_file_name: string | null;
  media_file_size: number | null;
  media_duration: number | null;
  status: string;
  received_at: string | null;
  raw_payload: any;
};

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function chatDisplayName(chat: TelegramChat): string {
  if (chat.title) return chat.title;
  const fn = chat.first_name ?? '';
  const ln = chat.last_name ?? '';
  const full = `${fn} ${ln}`.trim();
  if (full) return full;
  if (chat.username) return `@${chat.username}`;
  return `Chat ${chat.tg_chat_id}`;
}

function senderDisplayName(msg: TelegramMessage): string {
  if (msg.direction === 'out') return 'אתה';
  const fn = msg.sender_first_name ?? '';
  const ln = msg.sender_last_name ?? '';
  const full = `${fn} ${ln}`.trim();
  if (full) return full;
  if (msg.sender_username) return `@${msg.sender_username}`;
  return 'משתמש';
}

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = Date.now();
  const diff = (now - date.getTime()) / 1000;
  if (diff < 60) return 'עכשיו';
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} ד׳`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} ש׳`;
  if (diff < 86400 * 7) return `לפני ${Math.floor(diff / 86400)} י׳`;
  return date.toLocaleDateString('he-IL');
}

const CONTENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  text: MessageSquare,
  photo: ImageIcon,
  video: Video,
  voice: Mic,
  audio: Mic,
  document: FileText,
  sticker: Sticker,
  animation: Video,
  location: MapPin,
  contact: Phone,
  service: AlertCircle,
  other: FileText,
};

// ─────────────────────────────────────────────────────────────────────────
// Top-level component
// ─────────────────────────────────────────────────────────────────────────

export default function ChatsSection({
  workspaceId,
  canEdit,
}: {
  workspaceId: string;
  canEdit: boolean;
}) {
  const supabase = createClient();
  const [chats, setChats] = useState<TelegramChat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadChats = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(
        `/api/telegram/chats?workspace_id=${workspaceId}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'טעינת צ׳אטים נכשלה');
      setChats(data.chats || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Realtime: refresh chats list on any change
  useEffect(() => {
    const channel = supabase
      .channel(`telegram_chats:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'telegram_chats',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => loadChats()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, workspaceId, loadChats]);

  const selectedChat = chats.find((c) => c.id === selectedChatId) ?? null;

  if (loading) {
    return (
      <div className="card p-10 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 text-center text-red-600 text-sm">
        <AlertCircle className="w-5 h-5 mx-auto mb-2" />
        {error}
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="card p-10 text-center">
        <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <h3 className="font-bold mb-1">עוד אין שיחות</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          ברגע שמישהו ישלח הודעה לבוט (הודעה פרטית או בקבוצה שהבוט נמצא בה),
          השיחה תופיע כאן.
        </p>
        <p className="text-xs text-gray-400 mt-4">
          💡 אם הבוט בקבוצה ולא רואה הודעות —{' '}
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-600 hover:underline"
          >
            כבה את ה-Privacy Mode ב-BotFather
          </a>{' '}
          ואז תוסיף את הבוט לקבוצה מחדש.
        </p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-4 min-h-[500px]">
      {/* Chat list — hidden on mobile when a chat is selected */}
      <div className={`${selectedChatId ? 'hidden md:block' : ''}`}>
        <ChatList
          chats={chats}
          selectedChatId={selectedChatId}
          onSelect={setSelectedChatId}
        />
      </div>

      {/* Chat panel — shown when something is selected */}
      <div className={`${!selectedChatId ? 'hidden md:flex md:items-center md:justify-center card p-6' : ''}`}>
        {selectedChat ? (
          <ChatPanel
            chat={selectedChat}
            canEdit={canEdit}
            onBack={() => setSelectedChatId(null)}
          />
        ) : (
          <div className="text-center text-gray-400">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">בחר שיחה כדי לראות הודעות</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Chat list (left column)
// ─────────────────────────────────────────────────────────────────────────

function ChatList({
  chats,
  selectedChatId,
  onSelect,
}: {
  chats: TelegramChat[];
  selectedChatId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="card p-2 overflow-hidden">
      <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
        שיחות ({chats.length})
      </div>
      <div className="space-y-0.5 max-h-[600px] overflow-y-auto">
        {chats.map((chat) => {
          const isGroup = chat.chat_type !== 'private';
          const Icon = isGroup ? Users : User;
          const selected = chat.id === selectedChatId;

          return (
            <button
              key={chat.id}
              onClick={() => onSelect(chat.id)}
              className={`w-full text-start px-3 py-2.5 rounded-lg flex items-start gap-3 transition-colors ${
                selected ? 'bg-sky-50' : 'hover:bg-gray-50'
              } ${!chat.is_active ? 'opacity-50' : ''}`}
            >
              <div
                className={`w-9 h-9 rounded-full flex-shrink-0 grid place-items-center ${
                  isGroup ? 'bg-purple-100' : 'bg-sky-100'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isGroup ? 'text-purple-700' : 'text-sky-700'
                  }`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <div className="font-medium text-sm truncate">
                    {chatDisplayName(chat)}
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0">
                    {formatRelative(chat.last_message_at)}
                  </div>
                </div>
                <div className="text-xs text-gray-500 flex items-center gap-1.5">
                  {!chat.is_active && (
                    <PowerOff className="w-3 h-3 text-gray-400" />
                  )}
                  <span>
                    {chat.chat_type === 'private'
                      ? 'הודעה פרטית'
                      : chat.chat_type === 'channel'
                      ? 'ערוץ'
                      : 'קבוצה'}
                  </span>
                  <span>·</span>
                  <span>{chat.message_count} הודעות</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Chat panel (right column)
// ─────────────────────────────────────────────────────────────────────────

function ChatPanel({
  chat,
  canEdit,
  onBack,
}: {
  chat: TelegramChat;
  canEdit: boolean;
  onBack: () => void;
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(
        `/api/telegram/messages?chat_id=${chat.id}&limit=100`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'טעינת הודעות נכשלה');
      // Reverse so oldest first (the API returns newest first for pagination)
      setMessages((data.messages || []).reverse());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [chat.id]);

  useEffect(() => {
    setLoading(true);
    loadMessages();
  }, [loadMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Realtime: append new messages for this chat
  useEffect(() => {
    const channel = supabase
      .channel(`telegram_messages:${chat.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'telegram_messages',
          filter: `chat_id=eq.${chat.id}`,
        },
        (payload) => {
          setMessages((prev) => {
            const newRow = payload.new as TelegramMessage;
            // Dedupe in case we already inserted via the optimistic POST
            if (prev.some((m) => m.id === newRow.id)) return prev;
            return [...prev, newRow];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, chat.id]);

  return (
    <div className="card flex flex-col h-[600px] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-3">
        <button
          onClick={onBack}
          className="md:hidden p-1.5 rounded hover:bg-gray-100"
          aria-label="חזרה"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{chatDisplayName(chat)}</div>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span>{chat.chat_type === 'private' ? 'הודעה פרטית' : 'קבוצה'}</span>
            {chat.username && (
              <span dir="ltr">· @{chat.username}</span>
            )}
            {!chat.is_routed && (
              <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-medium">
                לא מנותב לתיבה
              </span>
            )}
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
            aria-label="הגדרות שיחה"
            title="הגדרות שיחה"
          >
            <Settings className="w-4 h-4" />
          </button>
        )}
      </div>

      {showSettings && (
        <ChatSettingsDialog
          chat={chat}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
        {loading ? (
          <div className="text-center text-gray-400 py-8">
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          </div>
        ) : error ? (
          <div className="text-center text-red-600 text-sm py-8">{error}</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            אין הודעות בשיחה זו
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}
      </div>

      {/* Reply form */}
      {canEdit && chat.is_active && <ReplyBox chatId={chat.id} />}
      {!chat.is_active && (
        <div className="p-3 text-center text-sm text-gray-500 border-t bg-gray-50">
          הבוט הוסר משיחה זו — לא ניתן לשלוח הודעות
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Message bubble
// ─────────────────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: TelegramMessage }) {
  const isOut = msg.direction === 'out';
  const Icon = CONTENT_ICON[msg.content_type] ?? FileText;

  return (
    <div className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3 py-2 ${
          isOut
            ? 'bg-sky-600 text-white'
            : 'bg-white border border-gray-200 text-gray-900'
        }`}
      >
        {!isOut && (
          <div className="text-xs font-medium mb-0.5 opacity-70">
            {senderDisplayName(msg)}
          </div>
        )}

        {msg.content_type === 'text' && msg.text && (
          <div className="text-sm whitespace-pre-wrap break-words">
            {msg.text}
          </div>
        )}

        {msg.content_type !== 'text' && (
          <div className="space-y-1">
            <MediaPreview msg={msg} isOut={isOut} />
            {msg.text && (
              <div className="text-sm whitespace-pre-wrap break-words mt-1">
                {msg.text}
              </div>
            )}
          </div>
        )}

        <div
          className={`text-[10px] mt-1 ${
            isOut ? 'text-sky-100' : 'text-gray-400'
          }`}
        >
          {msg.received_at &&
            new Date(msg.received_at).toLocaleTimeString('he-IL', {
              hour: '2-digit',
              minute: '2-digit',
            })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Media preview (lazy-downloads on first view)
// ─────────────────────────────────────────────────────────────────────────

function MediaPreview({
  msg,
  isOut,
}: {
  msg: TelegramMessage;
  isOut: boolean;
}) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(msg.media_url);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch(`/api/telegram/messages/${msg.id}/media`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'טעינת המדיה נכשלה');
      setMediaUrl(data.media_url);
    } catch (e: any) {
      setDownloadError(e.message);
    } finally {
      setDownloading(false);
    }
  }

  // Render based on content_type and whether we have the URL
  if (msg.content_type === 'photo' && mediaUrl) {
    return (
      <a href={mediaUrl} target="_blank" rel="noopener noreferrer">
        <img
          src={mediaUrl}
          alt=""
          className="rounded-lg max-w-full max-h-60 object-cover"
        />
      </a>
    );
  }

  if (msg.content_type === 'video' && mediaUrl) {
    return (
      <video
        src={mediaUrl}
        controls
        className="rounded-lg max-w-full max-h-60"
      />
    );
  }

  if (msg.content_type === 'voice' && mediaUrl) {
    return <audio src={mediaUrl} controls className="max-w-full" />;
  }

  if (msg.content_type === 'audio' && mediaUrl) {
    return <audio src={mediaUrl} controls className="max-w-full" />;
  }

  if (msg.content_type === 'document' && mediaUrl) {
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 text-sm underline ${
          isOut ? 'text-white' : 'text-sky-700'
        }`}
      >
        <FileText className="w-4 h-4" />
        {msg.media_file_name ?? 'מסמך'}
      </a>
    );
  }

  // No URL yet — offer to download
  const Icon = CONTENT_ICON[msg.content_type] ?? FileText;
  const labels: Record<string, string> = {
    photo: 'תמונה',
    video: 'וידאו',
    voice: 'הודעה קולית',
    audio: 'אודיו',
    document: 'מסמך',
    sticker: 'סטיקר',
    animation: 'GIF',
    location: 'מיקום',
    contact: 'איש קשר',
  };
  const label = labels[msg.content_type] ?? msg.content_type;

  // Inlinable types we don't download (location/contact have no file)
  if (msg.content_type === 'location' || msg.content_type === 'contact' || msg.content_type === 'service') {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Icon className="w-4 h-4" />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className={`flex items-center gap-2 text-sm py-1.5 px-2 rounded ${
        isOut ? 'bg-sky-700 hover:bg-sky-800' : 'bg-gray-100 hover:bg-gray-200'
      } disabled:opacity-50`}
    >
      {downloading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Play className="w-4 h-4" />
      )}
      <span>
        {downloading ? 'טוען...' : `טען ${label}`}
        {downloadError && ` — ${downloadError}`}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Reply box
// ─────────────────────────────────────────────────────────────────────────

function ReplyBox({ chatId }: { chatId: string }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/telegram/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: trimmed }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 207) {
        throw new Error(data.error || 'השליחה נכשלה');
      }
      setText('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t p-3 bg-white">
      {error && (
        <div className="mb-2 text-xs text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="כתוב הודעה... (Enter לשליחה, Shift+Enter לשורה חדשה)"
          rows={1}
          disabled={sending}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent disabled:bg-gray-50"
          style={{ minHeight: '40px', maxHeight: '120px' }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="w-10 h-10 rounded-full bg-sky-600 hover:bg-sky-700 text-white grid place-items-center disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          aria-label="שלח"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4 -scale-x-100" />
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Chat settings dialog (Phase 2.4)
//
// Lets the user toggle whether the chat appears in Inbox routing,
// add free-form notes, and see metadata. For groups, also surfaces a
// reminder about Privacy Mode.
// ─────────────────────────────────────────────────────────────────────────

function ChatSettingsDialog({
  chat,
  onClose,
}: {
  chat: TelegramChat;
  onClose: () => void;
}) {
  const [isRouted, setIsRouted] = useState(chat.is_routed);
  const [notes, setNotes] = useState(chat.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/telegram/chats/${chat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_routed: isRouted, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'השמירה נכשלה');
      setSaved(true);
      setTimeout(() => onClose(), 800);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const isGroup = chat.chat_type === 'group' || chat.chat_type === 'supergroup';

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display font-bold text-lg">הגדרות שיחה</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 grid place-items-center text-gray-500"
            aria-label="סגור"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Chat info */}
          <div className="bg-gray-50 rounded-xl p-3 text-sm">
            <div className="font-medium mb-1">{chatDisplayName(chat)}</div>
            <div className="text-xs text-gray-500 space-y-0.5">
              <div>
                {isGroup
                  ? 'קבוצה'
                  : chat.chat_type === 'private'
                  ? 'הודעה פרטית'
                  : 'ערוץ'}
              </div>
              <div>{chat.message_count} הודעות</div>
              {chat.last_message_at && (
                <div>הודעה אחרונה: {formatRelative(chat.last_message_at)}</div>
              )}
            </div>
          </div>

          {/* Routing toggle */}
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isRouted}
                onChange={(e) => setIsRouted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
              />
              <div>
                <div className="font-medium text-sm">נתב לתיבה הנכנסת</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  כשפעיל, הודעות מהשיחה הזו יוצרות אוטומטית פניות בתיבה הנכנסת
                  (בהתאם לחוקי הסיווג). כיבוי שומר את ההודעות אבל לא יוצר פניות.
                </div>
              </div>
            </label>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="chat-notes" className="block font-medium text-sm mb-1.5">
              הערות פנימיות
            </label>
            <textarea
              id="chat-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="לדוגמה: לקוח VIP, ליד חם, קבוצת שיווק..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Privacy mode reminder for groups */}
          {isGroup && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
              <div className="font-medium text-amber-900 mb-1">💡 הבוט לא רואה את כל ההודעות?</div>
              <div className="text-xs text-amber-800 leading-relaxed">
                כברירת מחדל, בוט בקבוצה רואה רק הודעות שמתייגות אותו או תגובות אליו.
                כדי שיראה את כל ההודעות:
                <ol className="list-decimal ms-5 mt-1 space-y-0.5">
                  <li>פתח את BotFather בטלגרם</li>
                  <li>שלח <span dir="ltr" className="font-mono">/setprivacy</span></li>
                  <li>בחר את הבוט שלך</li>
                  <li>לחץ Disable</li>
                  <li>הוצא את הבוט מהקבוצה והכנס אותו שוב</li>
                </ol>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saved && <Check className="w-4 h-4" />}
            {saved ? 'נשמר' : 'שמור'}
          </button>
        </div>
      </div>
    </div>
  );
}
