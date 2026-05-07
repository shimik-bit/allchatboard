'use client';

/**
 * TelegramManager - main UI for managing Telegram bots in a workspace.
 *
 * Mirrors the structure of InstancesManager (WhatsApp instances). Multi-bot
 * per workspace, similar to how a workspace can have multiple WhatsApp
 * instances connected.
 *
 * Phase 1: bot management only. Phase 2 will add inbox/messaging.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Bot,
  RefreshCw,
  Trash2,
  Power,
  PowerOff,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import AddBotModal from './AddBotModal';
import ChatsSection from './ChatsSection';

type TelegramBot = {
  id: string;
  bot_id: number;
  bot_username: string;
  bot_first_name: string | null;
  status: 'active' | 'inactive' | 'error';
  last_error: string | null;
  last_message_at: string | null;
  created_at: string;
};

const STATUS_CONFIG: Record<
  TelegramBot['status'],
  { color: string; bg: string; label: string }
> = {
  active: { color: 'text-green-700', bg: 'bg-green-100', label: 'פעיל' },
  inactive: { color: 'text-gray-600', bg: 'bg-gray-100', label: 'מושבת' },
  error: { color: 'text-red-700', bg: 'bg-red-100', label: 'שגיאה' },
};

export default function TelegramManager({
  workspaceId,
  workspaceName,
  canEdit,
}: {
  workspaceId: string;
  workspaceName: string;
  canEdit: boolean;
}) {
  const [bots, setBots] = useState<TelegramBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [busyBotId, setBusyBotId] = useState<string | null>(null);

  const loadBots = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/telegram/bots?workspace_id=${workspaceId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'טעינת בוטים נכשלה');
      setBots(data.bots || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadBots();
  }, [loadBots]);

  async function handleToggle(bot: TelegramBot) {
    const newStatus = bot.status === 'active' ? 'inactive' : 'active';
    setBusyBotId(bot.id);
    setError(null);
    try {
      const res = await fetch(`/api/telegram/bots/${bot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'עדכון נכשל');
      setBots((prev) => prev.map((b) => (b.id === bot.id ? data.bot : b)));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyBotId(null);
    }
  }

  async function handleDelete(bot: TelegramBot) {
    if (
      !confirm(
        `למחוק את הבוט @${bot.bot_username}?\n\nהוא יוסר מטלגרם ולא יקבל יותר הודעות.`
      )
    ) {
      return;
    }
    setBusyBotId(bot.id);
    setError(null);
    try {
      const res = await fetch(`/api/telegram/bots/${bot.id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'מחיקה נכשלה');
      setBots((prev) => prev.filter((b) => b.id !== bot.id));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyBotId(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl text-gray-900 flex items-center gap-2">
            <span className="text-3xl">💬</span>
            בוטים של טלגרם
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {workspaceName} · ניהול בוטים שמחוברים ל-{workspaceName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadBots}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            title="רענן"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            />
          </button>

          {canEdit && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              הוסף בוט
            </button>
          )}
        </div>
      </div>

      {/* Inline error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Body */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
        </div>
      ) : bots.length === 0 ? (
        <EmptyState canEdit={canEdit} onAdd={() => setShowAddModal(true)} />
      ) : (
        <div className="space-y-3">
          {bots.map((bot) => (
            <BotCard
              key={bot.id}
              bot={bot}
              busy={busyBotId === bot.id}
              canEdit={canEdit}
              onToggle={() => handleToggle(bot)}
              onDelete={() => handleDelete(bot)}
            />
          ))}
        </div>
      )}

      {/* Add bot modal */}
      {showAddModal && (
        <AddBotModal
          workspaceId={workspaceId}
          onClose={() => setShowAddModal(false)}
          onSuccess={(bot) => {
            setShowAddModal(false);
            setBots((prev) => [bot, ...prev]);
          }}
        />
      )}
    </div>
  );
}

function EmptyState({
  canEdit,
  onAdd,
}: {
  canEdit: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="border-2 border-dashed border-gray-200 rounded-2xl py-16 px-6 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-50 mb-4">
        <Bot className="w-8 h-8 text-brand-600" />
      </div>
      <h2 className="font-display font-bold text-lg text-gray-900">
        אין בוטים מחוברים
      </h2>
      <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
        צור בוט בטלגרם דרך BotFather וחבר אותו ל-TaskFlow כדי להתחיל לקבל הודעות
        מלקוחות.
      </p>
      {canEdit && (
        <button
          onClick={onAdd}
          className="mt-5 px-5 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          חבר את הבוט הראשון
        </button>
      )}
    </div>
  );
}

function BotCard({
  bot,
  busy,
  canEdit,
  onToggle,
  onDelete,
}: {
  bot: TelegramBot;
  busy: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const status = STATUS_CONFIG[bot.status];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 shrink-0">
            <Bot className="w-5 h-5 text-brand-600" />
          </div>
          <div>
            <div className="font-medium text-gray-900">
              {bot.bot_first_name || bot.bot_username}
            </div>
            <div dir="ltr" className="text-xs text-gray-500 text-start">
              @{bot.bot_username}
            </div>
            {bot.last_message_at && (
              <div className="text-xs text-gray-400 mt-1">
                הודעה אחרונה:{' '}
                {new Date(bot.last_message_at).toLocaleDateString('he-IL')}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.bg} ${status.color}`}
          >
            {status.label}
          </span>

          {canEdit && (
            <>
              <button
                onClick={onToggle}
                disabled={busy}
                className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                title={bot.status === 'active' ? 'השבת' : 'הפעל'}
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : bot.status === 'active' ? (
                  <PowerOff className="w-4 h-4" />
                ) : (
                  <Power className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={onDelete}
                disabled={busy}
                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-50"
                title="מחק"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {bot.status === 'error' && bot.last_error && (
        <div className="mt-3 p-2.5 bg-red-50 rounded-lg text-xs text-red-700 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="break-words">{bot.last_error}</span>
        </div>
      )}
    </div>
  );
}
