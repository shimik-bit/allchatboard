'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useT } from '@/lib/i18n/useT';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Building2,
  DoorOpen,
  Maximize,
  Layers,
} from 'lucide-react';

/**
 * PlanAnalysisStatus
 *
 * Polls /api/plans/[id]/status every ~3s while the plan is in `uploaded`
 * or `analyzing` state. Renders the extracted-data summary once analyzed,
 * or an error + Re-analyze button on failure.
 *
 * Use exponential-ish backoff: start at 2s, increase to 5s after 30s,
 * to 10s after 2min. AI vision usually finishes within 30s so we don't
 * want to hammer the endpoint forever.
 */

type StatusResponse = {
  plan_id: string;
  status: 'uploaded' | 'analyzing' | 'analyzed' | 'failed' | string;
  error_message: string | null;
  confidence: number | null;
  model: string | null;
  tokens_used: number | null;
  plan_type: string | null;
  scale: string | null;
  floors: number | null;
  rooms_count: number | null;
  total_area_sqm: number | null;
  summary: string | null;
};

type PlanAnalysisStatusProps = {
  planId: string;
  initialStatus?: string;
  onAnalyzed?: () => void;
  autoStart?: boolean;
};

const POLL_INTERVAL_FAST_MS = 2500;
const POLL_INTERVAL_MEDIUM_MS = 5000;
const POLL_INTERVAL_SLOW_MS = 10000;
const POLL_GIVE_UP_MS = 5 * 60 * 1000; // 5 minutes

function pickInterval(elapsedMs: number): number {
  if (elapsedMs < 30_000) return POLL_INTERVAL_FAST_MS;
  if (elapsedMs < 120_000) return POLL_INTERVAL_MEDIUM_MS;
  return POLL_INTERVAL_SLOW_MS;
}

export default function PlanAnalysisStatus({
  planId,
  initialStatus,
  onAnalyzed,
  autoStart = true,
}: PlanAnalysisStatusProps) {
  const { t } = useT();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<boolean>(false);

  const startedAtRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onAnalyzedRef = useRef(onAnalyzed);
  onAnalyzedRef.current = onAnalyzed;

  const fetchStatus = useCallback(async (): Promise<StatusResponse | null> => {
    try {
      const res = await fetch(`/api/plans/${planId}/status`, { cache: 'no-store' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as StatusResponse;
      setData(json);
      setError(null);
      return json;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error';
      setError(message);
      return null;
    }
  }, [planId]);

  const triggerAnalysis = useCallback(async (): Promise<void> => {
    setRetrying(true);
    setError(null);
    try {
      const res = await fetch('/api/plans/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      startedAtRef.current = Date.now();
      // Kick off polling
      void fetchStatus();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error';
      setError(message);
    } finally {
      setRetrying(false);
    }
  }, [planId, fetchStatus]);

  // ---- Auto-start the analysis if the plan is freshly uploaded ----
  useEffect(() => {
    if (!autoStart) return;
    if (initialStatus === 'uploaded') {
      void triggerAnalysis();
    } else {
      void fetchStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  // ---- Polling loop ----
  useEffect(() => {
    if (!data) return;

    const isTerminal = data.status === 'analyzed' || data.status === 'failed';
    if (isTerminal) {
      if (data.status === 'analyzed' && onAnalyzedRef.current) {
        onAnalyzedRef.current();
      }
      return;
    }

    const elapsed = Date.now() - startedAtRef.current;
    if (elapsed > POLL_GIVE_UP_MS) {
      setError(t('buildbot.plan_analysis_timeout'));
      return;
    }

    const interval = pickInterval(elapsed);
    timerRef.current = setTimeout(() => {
      void fetchStatus();
    }, interval);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, fetchStatus, t]);

  // ---- RENDER ----

  if (!data && !error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
        <span className="text-sm text-amber-900">{t('buildbot.plan_upload_analyzing')}</span>
      </div>
    );
  }

  if (data?.status === 'analyzing' || data?.status === 'uploaded') {
    return (
      <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
        <div className="flex-1">
          <div className="text-sm font-medium text-amber-900">
            {t('buildbot.plan_upload_analyzing')}
          </div>
          <div className="text-xs text-amber-700 mt-0.5">
            {t('buildbot.plan_analysis_eta')}
          </div>
        </div>
      </div>
    );
  }

  if (data?.status === 'failed' || error) {
    const message = data?.error_message || error || t('buildbot.plan_upload_failed');
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-red-900">
              {t('buildbot.plan_upload_failed')}
            </div>
            <div className="text-xs text-red-700 mt-0.5 break-words">{message}</div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void triggerAnalysis()}
            disabled={retrying}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 hover:bg-red-50 rounded-lg disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
            {t('buildbot.plan_reanalyze')}
          </button>
        </div>
      </div>
    );
  }

  // analyzed
  if (data?.status === 'analyzed') {
    const conf = data.confidence ?? 0;
    const confColor =
      conf >= 80 ? 'text-green-700 bg-green-100' : conf >= 50 ? 'text-amber-700 bg-amber-100' : 'text-red-700 bg-red-100';

    return (
      <div className="p-4 bg-white border border-gray-200 rounded-xl space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-900">
              {t('buildbot.plan_analysis_done')}
            </span>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${confColor}`}>
            {t('buildbot.plan_confidence')}: {conf}%
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {data.floors !== null && (
            <Stat
              icon={<Layers className="w-4 h-4 text-amber-600" />}
              label={t('buildbot.plan_extracted_floors')}
              value={String(data.floors)}
            />
          )}
          {data.rooms_count !== null && (
            <Stat
              icon={<DoorOpen className="w-4 h-4 text-amber-600" />}
              label={t('buildbot.plan_extracted_rooms')}
              value={String(data.rooms_count)}
            />
          )}
          {data.total_area_sqm !== null && (
            <Stat
              icon={<Maximize className="w-4 h-4 text-amber-600" />}
              label={t('buildbot.plan_extracted_area')}
              value={`${data.total_area_sqm} ${t('hub.buildbot_sqm')}`}
            />
          )}
          {data.plan_type && (
            <Stat
              icon={<Building2 className="w-4 h-4 text-amber-600" />}
              label={t('buildbot.plan_type_label')}
              value={t(`buildbot.plan_type_${data.plan_type}`)}
            />
          )}
        </div>

        {data.summary && (
          <div className="text-xs text-gray-600 italic border-r-2 border-amber-300 pr-3">
            {data.summary}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void triggerAnalysis()}
            disabled={retrying}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
            {t('buildbot.plan_reanalyze')}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="p-2 bg-amber-50/50 rounded-lg border border-amber-100">
      <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-0.5">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-sm font-bold text-gray-900 truncate">{value}</div>
    </div>
  );
}
