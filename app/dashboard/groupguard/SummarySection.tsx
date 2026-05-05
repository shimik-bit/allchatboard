'use client';

/**
 * SummarySection — per-group "Daily Summary" settings + history.
 *
 * Lives inside the expanded view of each group card in GroupGuardClient.
 * Self-contained: handles its own state, settings persistence, manual
 * trigger, and history list.
 *
 * Props are kept minimal — just the group id/name + initial settings.
 * The settings fields are echoed back to a parent callback so the parent
 * can update its own GGGroup state without us having to lift state up.
 */

import { useState, useEffect } from 'react';
import {
  Sparkles, Send, Clock, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle,
} from 'lucide-react';
import { useT } from '@/lib/i18n/useT';

export type SummaryItem = {
  id: string;
  summary_date: string;       // YYYY-MM-DD
  headline: string | null;
  bullets: string[];
  message_count: number;
  participant_count: number;
  triggered_by: 'manual' | 'auto' | 'backfill';
  whatsapp_sent_at: string | null;
  whatsapp_send_error: string | null;
  created_at: string;
};

export type SummarySettings = {
  summary_enabled: boolean;
  summary_auto: boolean;
  summary_hour: number;
  summary_send_to_whatsapp: boolean;
  summary_whatsapp_target: string | null;
};

export default function SummarySection({
  groupId,
  initial,
  onSettingsChange,
}: {
  groupId: string;
  initial: SummarySettings;
  onSettingsChange?: (s: Partial<SummarySettings>) => void;
}) {
  const { t } = useT();

  // Local copy of settings — kept in sync with the API. We don't mirror to
  // parent until save succeeds, to avoid showing the "saved" state too early.
  const [settings, setSettings] = useState<SummarySettings>(initial);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Manual trigger state
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{
    type: 'success' | 'info' | 'error';
    text: string;
  } | null>(null);

  // History list
  const [summaries, setSummaries] = useState<SummaryItem[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedSummaryId, setExpandedSummaryId] = useState<string | null>(null);

  // Load history once when the section first mounts (we're inside an
  // expanded group card so this only happens when the user actually opens
  // a group, not for all groups on the page)
  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/groupguard/groups/${groupId}/summaries?limit=14`);
      const d = await res.json();
      if (res.ok) setSummaries(d.summaries || []);
    } catch {
      // Non-fatal
    } finally {
      setHistoryLoading(false);
      setHistoryLoaded(true);
    }
  }

  /**
   * Patch one or more settings fields. Optimistic UI: we update local
   * state immediately, then call the API. If the API fails, we show the
   * error but keep the optimistic state — the user can fix the value and
   * try again, and a page reload will fetch the truth.
   */
  async function updateSettings(patch: Partial<SummarySettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/groupguard/groups/${groupId}/summary-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const d = await res.json();
      if (!res.ok) {
        setSaveError(d.error || t('groupguard.summary.save_failed'));
      } else {
        onSettingsChange?.(patch);
      }
    } catch (e: any) {
      setSaveError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  /**
   * Trigger a manual summary now. Refreshes the history list on success
   * so the new summary appears at the top.
   */
  async function runNow() {
    if (running) return;
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch(`/api/groupguard/groups/${groupId}/summarize?force=1`, {
        method: 'POST',
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        setRunResult({
          type: 'error',
          text: d.error || t('groupguard.summary.run_failed'),
        });
      } else if (d.skipped) {
        // Friendly mapping of skip reasons
        const skipText =
          d.reason === 'no_messages'
            ? t('groupguard.summary.skip_no_messages')
            : d.reason === 'too_few_messages'
              ? t('groupguard.summary.skip_too_few')
              : t('groupguard.summary.skip_already');
        setRunResult({ type: 'info', text: skipText });
      } else {
        setRunResult({
          type: 'success',
          text: t('groupguard.summary.run_done'),
        });
        await loadHistory();
      }
    } catch (e: any) {
      setRunResult({ type: 'error', text: String(e?.message || e) });
    } finally {
      setRunning(false);
      setTimeout(() => setRunResult(null), 6000);
    }
  }

  return (
    <div className="border border-purple-200 rounded-lg p-4 bg-gradient-to-br from-purple-50/40 to-pink-50/30">
      {/* Header + master toggle */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-2">
          <div className="w-9 h-9 rounded-lg bg-purple-100 grid place-items-center text-purple-600 flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-gray-900">{t('groupguard.summary.title')}</h4>
            <p className="text-xs text-gray-600 mt-0.5">{t('groupguard.summary.description')}</p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={settings.summary_enabled}
            onChange={(e) => updateSettings({ summary_enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
        </label>
      </div>

      {/* Settings only relevant when feature enabled */}
      {settings.summary_enabled && (
        <div className="space-y-4">
          {/* Auto toggle */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.summary_auto}
                onChange={(e) => updateSettings({ summary_auto: e.target.checked })}
                className="mt-1 w-4 h-4 accent-purple-600"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-600" />
                  {t('groupguard.summary.auto_label')}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">{t('groupguard.summary.auto_desc')}</div>
              </div>
            </label>
          </div>

          {/* WhatsApp delivery */}
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.summary_send_to_whatsapp}
                onChange={(e) => updateSettings({ summary_send_to_whatsapp: e.target.checked })}
                className="mt-1 w-4 h-4 accent-purple-600"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-green-600" />
                  {t('groupguard.summary.whatsapp_label')}
                </div>
                <div className="text-xs text-gray-600 mt-0.5">{t('groupguard.summary.whatsapp_desc')}</div>
              </div>
            </label>

            {settings.summary_send_to_whatsapp && (
              <div className="mt-3 pt-3 border-t border-gray-100 ps-7">
                <label className="text-xs text-gray-700 block mb-1">
                  {t('groupguard.summary.target_label')}
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder={t('groupguard.summary.target_placeholder')}
                  defaultValue={settings.summary_whatsapp_target || ''}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if ((v || null) !== settings.summary_whatsapp_target) {
                      updateSettings({ summary_whatsapp_target: v || null });
                    }
                  }}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500"
                  dir="ltr"
                />
                <p className="text-[11px] text-gray-500 mt-1">{t('groupguard.summary.target_hint')}</p>
              </div>
            )}
          </div>

          {saveError && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2 flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              {saveError}
            </div>
          )}
          {saving && (
            <div className="text-[11px] text-purple-600 flex items-center gap-1">
              <span className="inline-block w-1 h-1 rounded-full bg-purple-500 animate-pulse" />
              {t('groupguard.summary.saving')}
            </div>
          )}
        </div>
      )}

      {/* Manual run + history — always visible (manual works without enabling) */}
      <div className="mt-4 pt-4 border-t border-purple-100">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-gray-900">
            {t('groupguard.summary.recent_title')}
          </div>
          <button
            onClick={runNow}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            {running ? t('groupguard.summary.running') : t('groupguard.summary.run_now')}
          </button>
        </div>

        {runResult && (
          <div
            className={`text-xs px-2.5 py-1.5 rounded mb-3 ${
              runResult.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : runResult.type === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}
          >
            {runResult.text}
          </div>
        )}

        {/* History list */}
        {historyLoading && !historyLoaded && (
          <div className="text-xs text-gray-500 py-2">{t('groupguard.summary.loading')}</div>
        )}

        {historyLoaded && summaries.length === 0 && (
          <div className="text-xs text-gray-500 py-3 text-center bg-white/50 rounded border border-dashed border-gray-200">
            {t('groupguard.summary.empty')}
          </div>
        )}

        {summaries.length > 0 && (
          <div className="space-y-2">
            {summaries.map((s) => {
              const expanded = expandedSummaryId === s.id;
              return (
                <div key={s.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedSummaryId(expanded ? null : s.id)}
                    className="w-full px-3 py-2 flex items-start gap-2 hover:bg-gray-50 text-start"
                  >
                    <div className="flex-shrink-0 w-9 text-center">
                      <div className="text-[10px] text-gray-500 uppercase">
                        {new Date(s.summary_date).toLocaleDateString('he-IL', { month: 'short' })}
                      </div>
                      <div className="text-sm font-bold text-gray-900">
                        {new Date(s.summary_date).getDate()}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 line-clamp-1">
                        {s.headline || t('groupguard.summary.no_headline')}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>{t('groupguard.summary.meta_count', { count: s.bullets.length })}</span>
                        <span>•</span>
                        <span>{t('groupguard.summary.meta_messages', { count: s.message_count })}</span>
                        {s.triggered_by === 'auto' && (
                          <>
                            <span>•</span>
                            <span className="text-purple-600">{t('groupguard.summary.tag_auto')}</span>
                          </>
                        )}
                        {s.whatsapp_sent_at && (
                          <span className="text-green-600 flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            {t('groupguard.summary.tag_sent')}
                          </span>
                        )}
                      </div>
                    </div>
                    {expanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-1" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-1" />
                    )}
                  </button>

                  {expanded && (
                    <div className="px-3 pb-3 pt-2 border-t border-gray-100 bg-gray-50/50">
                      <ul className="space-y-1.5">
                        {s.bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                            <span className="text-purple-500 flex-shrink-0">•</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                      {s.whatsapp_send_error && (
                        <div className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded p-1.5">
                          {t('groupguard.summary.send_error')}: {s.whatsapp_send_error}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
