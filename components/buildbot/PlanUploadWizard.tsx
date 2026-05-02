'use client';

import { useState, useCallback, useRef } from 'react';
import { useT } from '@/lib/i18n/useT';
import { createClient } from '@/lib/supabase/client';
import { Upload, FileText, Image as ImageIcon, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

/**
 * PlanUploadWizard
 *
 * 3 steps:
 *   1. select  - drag/drop or click to pick files
 *   2. preview - review files, can remove individual files
 *   3. upload  - upload to Supabase Storage + register via /api/plans/upload
 *
 * Direct-to-storage upload pattern is used (no multipart through API)
 * because plans can be 50MB and Vercel functions cap at 4.5MB body size.
 *
 * Props:
 *   workspaceId   - UUID of the active workspace
 *   projectId?    - optional UUID of the project record (from the records table)
 *   onComplete?   - called after all files uploaded successfully with the new plan IDs
 *   onCancel?     - called when user cancels
 */

type PlanUploadWizardProps = {
  workspaceId: string;
  projectId?: string | null;
  onComplete?: (planIds: string[]) => void;
  onCancel?: () => void;
};

type FileEntry = {
  id: string; // local-only id for keying
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number; // 0-100
  planId?: string;
  errorMessage?: string;
};

type Step = 'select' | 'preview' | 'upload';

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/acad',
  'application/dxf',
  'image/vnd.dwg',
];

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 10;

function inferFileType(file: File): 'pdf' | 'image' | 'dwg' | null {
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('image/vnd.dwg') || file.name.toLowerCase().endsWith('.dwg')) return 'dwg';
  if (file.type.startsWith('image/')) return 'image';
  if (file.name.toLowerCase().endsWith('.dxf')) return 'dwg';
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ file }: { file: File }) {
  const type = inferFileType(file);
  if (type === 'pdf') return <FileText className="w-5 h-5 text-red-500" />;
  if (type === 'image') return <ImageIcon className="w-5 h-5 text-blue-500" />;
  return <FileText className="w-5 h-5 text-gray-500" />;
}

export default function PlanUploadWizard({
  workspaceId,
  projectId,
  onComplete,
  onCancel,
}: PlanUploadWizardProps) {
  const { t, dir } = useT();
  const [step, setStep] = useState<Step>('select');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const validateAndAdd = useCallback((incoming: FileList | File[]): void => {
    setGlobalError(null);
    const next: FileEntry[] = [];
    const arr = Array.from(incoming);

    for (const file of arr) {
      // Type check
      const type = inferFileType(file);
      if (!type) {
        setGlobalError(t('buildbot.plan_upload_invalid_type') + `: ${file.name}`);
        continue;
      }
      // Size check
      if (file.size > MAX_SIZE_BYTES) {
        setGlobalError(t('buildbot.plan_upload_too_large') + `: ${file.name}`);
        continue;
      }
      next.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`,
        file,
        status: 'pending',
        progress: 0,
      });
    }

    setFiles((prev) => {
      const merged = [...prev, ...next];
      if (merged.length > MAX_FILES) {
        setGlobalError(t('buildbot.plan_upload_max_files', { n: MAX_FILES }));
        return merged.slice(0, MAX_FILES);
      }
      return merged;
    });
  }, [t]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAdd(e.dataTransfer.files);
    }
  }, [validateAndAdd]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAdd(e.target.files);
    }
    // Reset so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [validateAndAdd]);

  const removeFile = useCallback((id: string): void => {
    setFiles((prev) => prev.filter((f: FileEntry) => f.id !== id));
  }, []);

  const uploadAll = useCallback(async (): Promise<void> => {
    setStep('upload');
    const supabase = createClient();
    const successIds: string[] = [];

    // Upload sequentially to avoid hammering the network on mobile
    for (const entry of files) {
      // Mark as uploading
      setFiles((prev) =>
        prev.map((f: FileEntry) => (f.id === entry.id ? { ...f, status: 'uploading', progress: 10 } : f))
      );

      try {
        const fileType = inferFileType(entry.file);
        if (!fileType) throw new Error('invalid_file_type');

        const cleanName = entry.file.name.replace(/[^\w.-]/g, '_');
        const path = projectId
          ? `${workspaceId}/${projectId}/${Date.now()}-${cleanName}`
          : `${workspaceId}/_unassigned/${Date.now()}-${cleanName}`;

        // 1) Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('construction-plans')
          .upload(path, entry.file, {
            cacheControl: '3600',
            upsert: false,
            contentType: entry.file.type || undefined,
          });

        if (uploadError) throw new Error(uploadError.message);

        setFiles((prev) =>
          prev.map((f: FileEntry) => (f.id === entry.id ? { ...f, progress: 60 } : f))
        );

        // 2) Register via API
        const res = await fetch('/api/plans/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: workspaceId,
            project_id: projectId || null,
            file_name: entry.file.name,
            file_path: path,
            file_size_bytes: entry.file.size,
            file_type: fileType,
          }),
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        const { plan_id } = (await res.json()) as { plan_id: string };
        successIds.push(plan_id);

        setFiles((prev) =>
          prev.map((f: FileEntry) =>
            f.id === entry.id ? { ...f, status: 'done', progress: 100, planId: plan_id } : f
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown_error';
        setFiles((prev) =>
          prev.map((f: FileEntry) =>
            f.id === entry.id ? { ...f, status: 'error', errorMessage: message } : f
          )
        );
      }
    }

    if (successIds.length > 0 && onComplete) {
      onComplete(successIds);
    }
  }, [files, projectId, workspaceId, onComplete]);

  const allDone = files.length > 0 && files.every((f: FileEntry) => f.status === 'done');
  const anyError = files.some((f: FileEntry) => f.status === 'error');

  // ---------- STEP 1: SELECT ----------
  if (step === 'select') {
    return (
      <div className="w-full" dir={dir}>
        <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4">
          {t('buildbot.plan_upload_title')}
        </h2>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative cursor-pointer border-2 border-dashed rounded-2xl p-8 md:p-12 text-center transition-colors ${
            isDragging
              ? 'border-amber-500 bg-amber-50'
              : 'border-gray-300 bg-gray-50 hover:border-amber-400 hover:bg-amber-50/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_MIME_TYPES.join(',') + ',.pdf,.jpg,.jpeg,.png,.webp,.dwg,.dxf'}
            onChange={handleFileInput}
            className="hidden"
          />
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
              <Upload className="w-7 h-7 text-amber-600" />
            </div>
            <p className="text-sm md:text-base font-medium text-gray-700">
              {t('buildbot.plan_upload_drag')}
            </p>
            <p className="text-xs text-gray-500">{t('buildbot.plan_upload_supported')}</p>
          </div>
        </div>

        {globalError && (
          <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{globalError}</span>
          </div>
        )}

        {files.length > 0 && (
          <>
            <div className="mt-4 space-y-2">
              {files.map((entry: FileEntry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg"
                >
                  <FileIcon file={entry.file} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {entry.file.name}
                    </div>
                    <div className="text-xs text-gray-500">{formatBytes(entry.file.size)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(entry.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50"
                    aria-label={t('common.remove')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => setStep('preview')}
                className="px-5 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
              >
                {t('common.next')}
                <span className={dir === 'rtl' ? 'mr-2' : 'ml-2'}>
                  {dir === 'rtl' ? '←' : '→'}
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ---------- STEP 2: PREVIEW ----------
  if (step === 'preview') {
    const total = files.reduce((acc: number, f: FileEntry) => acc + f.file.size, 0);

    return (
      <div className="w-full" dir={dir}>
        <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4">
          {t('buildbot.plan_upload_preview_title')}
        </h2>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-900">
          {t('buildbot.plan_upload_preview_summary', {
            n: files.length,
            size: formatBytes(total),
          })}
        </div>

        <div className="space-y-2">
          {files.map((entry: FileEntry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg"
            >
              <FileIcon file={entry.file} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {entry.file.name}
                </div>
                <div className="text-xs text-gray-500">{formatBytes(entry.file.size)}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setStep('select')}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            {dir === 'rtl' ? '→' : '←'} {t('common.back')}
          </button>
          <button
            type="button"
            onClick={uploadAll}
            className="px-5 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
          >
            {t('buildbot.plan_upload_start')}
          </button>
        </div>
      </div>
    );
  }

  // ---------- STEP 3: UPLOAD ----------
  return (
    <div className="w-full" dir={dir}>
      <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-4">
        {allDone
          ? t('buildbot.plan_upload_done')
          : t('buildbot.plan_upload_in_progress')}
      </h2>

      <div className="space-y-2">
        {files.map((entry: FileEntry) => (
          <div
            key={entry.id}
            className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg"
          >
            <FileIcon file={entry.file} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {entry.file.name}
              </div>
              {entry.status === 'uploading' && (
                <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
                    style={{ width: `${entry.progress}%` }}
                  />
                </div>
              )}
              {entry.status === 'error' && (
                <div className="text-xs text-red-600 mt-0.5">
                  {t('buildbot.plan_upload_failed')}
                  {entry.errorMessage ? `: ${entry.errorMessage}` : ''}
                </div>
              )}
            </div>
            <div className="flex-shrink-0">
              {entry.status === 'uploading' && (
                <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
              )}
              {entry.status === 'done' && (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              )}
              {entry.status === 'error' && (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        {(allDone || anyError) && (
          <button
            type="button"
            onClick={() => onComplete?.(files.filter((f: FileEntry) => f.planId).map((f: FileEntry) => f.planId as string))}
            className="px-5 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
          >
            {t('common.done')}
          </button>
        )}
      </div>
    </div>
  );
}
