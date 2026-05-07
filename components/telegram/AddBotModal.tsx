'use client';

/**
 * AddBotModal - paste a Telegram bot token to connect it to the workspace.
 * Mirrors the visual pattern of CreateCloudInstanceModal in InstancesManager.
 */

import { useState } from 'react';
import { X, Loader2, ExternalLink, Bot, Eye, EyeOff } from 'lucide-react';

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

export default function AddBotModal({
  workspaceId,
  onClose,
  onSuccess,
}: {
  workspaceId: string;
  onClose: () => void;
  onSuccess: (bot: TelegramBot) => void;
}) {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = token.trim();
    if (!trimmed) {
      setError('יש להדביק את הטוקן');
      return;
    }

    setBusy(true);
    setError(null);
    setWarning(null);

    try {
      const res = await fetch('/api/telegram/bots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, token: trimmed }),
      });
      const data = await res.json();

      // 207 = bot was saved but webhook failed - still treat as partial success
      if (!res.ok && res.status !== 207) {
        setError(data.error || 'החיבור נכשל');
        setBusy(false);
        return;
      }

      if (res.status === 207 && data.warning) {
        setWarning(`הבוט נשמר אך הגדרת ה-Webhook נכשלה: ${data.warning}`);
      }

      onSuccess(data.bot);
    } catch (err: any) {
      setError(err.message || 'שגיאה ברשת');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 grid place-items-center p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-display font-bold text-xl flex items-center gap-2">
              <span className="text-2xl">💬</span>
              חיבור בוט טלגרם
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              צור בוט חדש ב-BotFather והדבק את הטוקן כאן
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BotFather instructions */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-gray-900 mb-2">
            <Bot className="w-4 h-4" />
            איך יוצרים בוט?
          </div>
          <ol className="ms-5 list-decimal space-y-1 text-gray-700">
            <li>פתח את BotFather בטלגרם</li>
            <li>שלח לו <code className="bg-white px-1 rounded">/newbot</code> ובחר שם וכינוי</li>
            <li>BotFather יחזיר לך טוקן (נראה כמו <code className="bg-white px-1 rounded" dir="ltr">123456:ABC...</code>)</li>
            <li>הדבק את הטוקן בשדה למטה</li>
          </ol>
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-brand-600 hover:underline"
          >
            פתח את BotFather בטלגרם
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Token input */}
        <div className="mb-4">
          <label
            htmlFor="bot-token"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            טוקן הבוט
          </label>
          <div className="relative">
            <input
              id="bot-token"
              type={showToken ? 'text' : 'password'}
              placeholder="123456789:AAH..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={busy}
              dir="ltr"
              autoComplete="off"
              className="w-full px-3 py-2 pe-10 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent disabled:bg-gray-50"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              tabIndex={-1}
              aria-label={showToken ? 'הסתר טוקן' : 'הצג טוקן'}
              className="absolute end-0 top-0 h-full w-10 flex items-center justify-center text-gray-400 hover:text-gray-700"
            >
              {showToken ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            הטוקן יישמר מוצפן ב-AES-256-GCM ולא יוצג שוב.
          </p>
        </div>

        {/* Inline error */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Inline warning */}
        {warning && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            {warning}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy || !token.trim()}
            className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            חבר בוט
          </button>
        </div>
      </div>
    </div>
  );
}
