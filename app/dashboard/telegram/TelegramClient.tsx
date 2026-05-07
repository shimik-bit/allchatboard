'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Send, Plus, MoreVertical, AlertCircle, ExternalLink, Eye, EyeOff,
  Loader2, X, Bot,
} from 'lucide-react';
import { useT } from '@/lib/i18n/useT';

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

type Workspace = { id: string; name: string; icon: string | null };

export default function TelegramClient({
  workspace,
  allWorkspaces,
  initialBots,
  canEdit,
}: {
  workspace: Workspace;
  allWorkspaces?: Workspace[];
  initialBots: TelegramBot[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { t } = useT();
  const [bots, setBots] = useState<TelegramBot[]>(initialBots);
  const [showAdd, setShowAdd] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  function flash(msg: string, ms = 3000) {
    setSavedMsg(msg);
    setTimeout(() => setSavedMsg(''), ms);
  }

  async function handleDelete(bot: TelegramBot) {
    if (!confirm(t('telegram.confirmDelete', { username: bot.bot_username }))) return;
    setOpenMenuId(null);

    const res = await fetch(`/api/telegram/bots/${bot.id}`, { method: 'DELETE' });
    if (res.ok) {
      setBots((prev) => prev.filter((b) => b.id !== bot.id));
      flash(t('telegram.botDeleted'));
    } else {
      const data = await res.json().catch(() => ({}));
      flash(data.error || t('telegram.deleteFailed'));
    }
  }

  async function handleToggle(bot: TelegramBot) {
    setOpenMenuId(null);
    const newStatus = bot.status === 'active' ? 'inactive' : 'active';

    const res = await fetch(`/api/telegram/bots/${bot.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });

    if (res.ok) {
      const data = await res.json();
      setBots((prev) => prev.map((b) => (b.id === bot.id ? data.bot : b)));
    } else {
      flash(t('telegram.updateFailed'));
    }
  }

  function handleBotAdded(bot: TelegramBot, warning?: string) {
    setBots((prev) => [bot, ...prev]);
    setShowAdd(false);
    if (warning) {
      flash(t('telegram.add.partialSuccess', { error: warning }), 8000);
    } else {
      flash(t('telegram.add.success', { username: bot.bot_username }));
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-3xl mb-1 flex items-center gap-2">
            <Send className="w-7 h-7 text-sky-500" />
            {t('telegram.title')}
          </h1>
          <p className="text-gray-500">{t('telegram.description')}</p>
        </div>

        {allWorkspaces && allWorkspaces.length > 1 && (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <span className="text-xs text-gray-500 font-medium">{t('telegram.workspaceLabel')}:</span>
            <select
              value={workspace.id}
              onChange={(e) => router.push(`/dashboard/telegram?ws=${e.target.value}`)}
              className="text-sm font-medium bg-transparent border-0 focus:outline-none cursor-pointer pr-1"
            >
              {allWorkspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.icon || '📊'} {ws.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Saved/error message banner */}
      {savedMsg && (
        <div className="mb-6 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 text-sm text-sky-900">
          {savedMsg}
        </div>
      )}

      {/* Empty state OR bot list */}
      {bots.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-sky-100 grid place-items-center">
            <Bot className="w-7 h-7 text-sky-600" />
          </div>
          <h3 className="font-display font-bold text-lg mb-1">
            {t('telegram.emptyTitle')}
          </h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-5">
            {t('telegram.emptyDescription')}
          </p>
          {canEdit && (
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t('telegram.addFirstBot')}
            </button>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display font-bold text-lg">
              {t('telegram.connectedBots')}{' '}
              <span className="text-sm text-gray-400 font-normal">({bots.length})</span>
            </h2>
            {canEdit && (
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('telegram.addBot')}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {bots.map((bot) => (
              <BotCard
                key={bot.id}
                bot={bot}
                canEdit={canEdit}
                isMenuOpen={openMenuId === bot.id}
                onMenuToggle={() => setOpenMenuId(openMenuId === bot.id ? null : bot.id)}
                onMenuClose={() => setOpenMenuId(null)}
                onToggle={() => handleToggle(bot)}
                onDelete={() => handleDelete(bot)}
              />
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <AddBotModal
          workspaceId={workspace.id}
          onClose={() => setShowAdd(false)}
          onAdded={handleBotAdded}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Bot card
// ─────────────────────────────────────────────────────────────────────────

function BotCard({
  bot,
  canEdit,
  isMenuOpen,
  onMenuToggle,
  onMenuClose,
  onToggle,
  onDelete,
}: {
  bot: TelegramBot;
  canEdit: boolean;
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  onMenuClose: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { t } = useT();

  const statusStyles: Record<TelegramBot['status'], { color: string; label: string }> = {
    active:   { color: 'bg-green-100 text-green-700', label: t('telegram.status.active') },
    inactive: { color: 'bg-gray-100 text-gray-600',   label: t('telegram.status.inactive') },
    error:    { color: 'bg-red-100 text-red-700',     label: t('telegram.status.error') },
  };
  const status = statusStyles[bot.status];

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-full bg-sky-100 grid place-items-center flex-shrink-0">
            <Bot className="w-5 h-5 text-sky-600" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-base truncate">
              {bot.bot_first_name || bot.bot_username}
            </div>
            <div className="text-sm text-gray-500 truncate" dir="ltr" style={{ textAlign: 'start' }}>
              @{bot.bot_username}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
          {canEdit && (
            <div className="relative">
              <button
                onClick={onMenuToggle}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 grid place-items-center text-gray-500"
                aria-label={t('telegram.actions')}
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {isMenuOpen && (
                <>
                  {/* Click-away overlay */}
                  <div className="fixed inset-0 z-10" onClick={onMenuClose} />
                  <div className="absolute end-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-20">
                    <button
                      onClick={onToggle}
                      className="w-full text-start px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      {bot.status === 'active' ? t('telegram.disable') : t('telegram.enable')}
                    </button>
                    <button
                      onClick={onDelete}
                      className="w-full text-start px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      {t('telegram.delete')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {bot.status === 'error' && bot.last_error && (
        <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span className="break-words">{bot.last_error}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Add bot modal
// ─────────────────────────────────────────────────────────────────────────

function AddBotModal({
  workspaceId,
  onClose,
  onAdded,
}: {
  workspaceId: string;
  onClose: () => void;
  onAdded: (bot: TelegramBot, warning?: string) => void;
}) {
  const { t } = useT();
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = token.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/telegram/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, token: trimmed }),
      });

      const data = await res.json();

      if (!res.ok && res.status !== 207) {
        setError(data.error || t('telegram.add.failed'));
        return;
      }

      onAdded(data.bot, res.status === 207 ? data.warning : undefined);
    } catch (e: any) {
      setError(e?.message || t('telegram.add.failed'));
    } finally {
      setLoading(false);
    }
  }

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
          <h2 className="font-display font-bold text-lg">{t('telegram.add.title')}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 grid place-items-center text-gray-500"
            aria-label={t('telegram.add.cancel')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">{t('telegram.add.description')}</p>

          {/* BotFather instructions */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm">
            <div className="flex items-center gap-2 font-bold mb-2">
              <Bot className="w-4 h-4 text-sky-600" />
              {t('telegram.add.howToTitle')}
            </div>
            <ol className="ms-5 list-decimal space-y-1 text-gray-600">
              <li>{t('telegram.add.step1')}</li>
              <li>{t('telegram.add.step2')}</li>
              <li>{t('telegram.add.step3')}</li>
              <li>{t('telegram.add.step4')}</li>
            </ol>
            <a
              href="https://t.me/BotFather"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 pt-2 text-sky-600 hover:underline font-medium"
            >
              {t('telegram.add.openBotFather')}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Token input */}
          <div>
            <label htmlFor="bot-token" className="block text-sm font-medium mb-1.5">
              {t('telegram.add.tokenLabel')}
            </label>
            <div className="relative">
              <input
                id="bot-token"
                type={showToken ? 'text' : 'password'}
                placeholder="123456789:AAH..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={loading}
                dir="ltr"
                autoComplete="off"
                className="w-full pe-10 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute end-0 top-0 h-full w-10 grid place-items-center text-gray-400 hover:text-gray-600"
                tabIndex={-1}
                aria-label={showToken ? t('telegram.add.hideToken') : t('telegram.add.showToken')}
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">{t('telegram.add.tokenHint')}</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="break-words">{error}</span>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg disabled:opacity-50"
          >
            {t('telegram.add.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !token.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('telegram.add.connect')}
          </button>
        </div>
      </div>
    </div>
  );
}
