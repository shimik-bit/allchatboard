'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/useT';
import PlanUploadWizard from '@/components/buildbot/PlanUploadWizard';
import { Plus, FileText, Image as ImageIcon, X, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';
import type { Locale } from '@/lib/i18n/locales';

type ProjectRecord = {
  id: string;
  data: { project_name?: string; address?: string };
};

type PlanRow = {
  id: string;
  file_name: string;
  file_type: string | null;
  file_size_bytes: number | null;
  status: string;
  project_id: string | null;
  ai_confidence_score: number | null;
  detected_total_area_sqm: number | null;
  created_at: string;
};

type PlansClientProps = {
  workspaceId: string;
  locale: Locale;
  plans: PlanRow[];
  projects: ProjectRecord[];
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string, locale: Locale): string {
  try {
    return new Date(iso).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useT();
  const map: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
    uploaded: {
      color: 'text-blue-700',
      bg: 'bg-blue-100',
      icon: <Clock className="w-3 h-3" />,
    },
    analyzing: {
      color: 'text-amber-700',
      bg: 'bg-amber-100',
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
    },
    analyzed: {
      color: 'text-green-700',
      bg: 'bg-green-100',
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    failed: {
      color: 'text-red-700',
      bg: 'bg-red-100',
      icon: <AlertCircle className="w-3 h-3" />,
    },
  };
  const conf = map[status] || map.uploaded;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${conf.color} ${conf.bg}`}
    >
      {conf.icon}
      {t(`buildbot.plan_status_${status}`)}
    </span>
  );
}

function FileTypeIcon({ type }: { type: string | null }) {
  if (type === 'pdf') return <FileText className="w-5 h-5 text-red-500" />;
  if (type === 'image') return <ImageIcon className="w-5 h-5 text-blue-500" />;
  return <FileText className="w-5 h-5 text-gray-500" />;
}

export default function PlansClient({
  workspaceId,
  locale,
  plans,
  projects,
}: PlansClientProps) {
  const { t, dir } = useT();
  const router = useRouter();
  const [showWizard, setShowWizard] = useState<boolean>(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const projectMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const p of projects) {
      map[p.id] = p.data?.project_name || t('buildbot.untitled_project');
    }
    return map;
  }, [projects, t]);

  const handleComplete = (planIds: string[]): void => {
    setShowWizard(false);
    setSelectedProjectId('');
    if (planIds.length > 0) {
      router.refresh();
    }
  };

  // ---------- WIZARD MODAL ----------
  if (showWizard) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4" dir={dir}>
        <div className="w-full md:max-w-2xl bg-white rounded-t-2xl md:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-100 px-4 md:px-6 py-3 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">{t('buildbot.plan_upload_title')}</h3>
            <button
              type="button"
              onClick={() => {
                setShowWizard(false);
                setSelectedProjectId('');
              }}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md"
              aria-label={t('common.close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 md:p-6">
            {projects.length > 0 && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('buildbot.plan_upload_pick_project')}
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                >
                  <option value="">{t('buildbot.plan_upload_no_project')}</option>
                  {projects.map((p: ProjectRecord) => (
                    <option key={p.id} value={p.id}>
                      {p.data?.project_name || t('buildbot.untitled_project')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <PlanUploadWizard
              workspaceId={workspaceId}
              projectId={selectedProjectId || null}
              onComplete={handleComplete}
              onCancel={() => {
                setShowWizard(false);
                setSelectedProjectId('');
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ---------- LIST VIEW ----------
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm text-gray-600">
          {t('buildbot.plans_count', { n: plans.length })}
        </div>
        <button
          type="button"
          onClick={() => setShowWizard(true)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          {t('buildbot.plan_upload_button')}
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 md:p-12 shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
            <FileText className="w-8 h-8 text-amber-600" />
          </div>
          <h3 className="font-bold text-gray-900 mb-2">{t('buildbot.plans_empty_title')}</h3>
          <p className="text-sm text-gray-500 mb-5">{t('buildbot.plans_empty_subtitle')}</p>
          <button
            type="button"
            onClick={() => setShowWizard(true)}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t('buildbot.plan_upload_button')}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {plans.map((plan: PlanRow) => (
              <div key={plan.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <FileTypeIcon type={plan.file_type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="font-medium text-gray-900 truncate">
                        {plan.file_name}
                      </div>
                      <StatusBadge status={plan.status} />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                      <span>{formatBytes(plan.file_size_bytes)}</span>
                      <span>·</span>
                      <span>{formatDate(plan.created_at, locale)}</span>
                      {plan.project_id && projectMap[plan.project_id] && (
                        <>
                          <span>·</span>
                          <span className="text-amber-700">
                            🏗️ {projectMap[plan.project_id]}
                          </span>
                        </>
                      )}
                      {plan.detected_total_area_sqm && (
                        <>
                          <span>·</span>
                          <span>📐 {plan.detected_total_area_sqm} {t('hub.buildbot_sqm')}</span>
                        </>
                      )}
                      {plan.ai_confidence_score && (
                        <>
                          <span>·</span>
                          <span>{t('buildbot.plan_confidence')}: {plan.ai_confidence_score}%</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
