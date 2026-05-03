'use client';

import { useState, useEffect, useCallback } from 'react';

export type AppCatalogEntry = {
  id: string;
  slug: string;
  name_he: string;
  name_en: string;
  description_he: string | null;
  description_en: string | null;
  icon: string;
  color: string;
  category: string;
  primary_route: string;
  sidebar_links: Array<{ label_he: string; label_en: string; path: string; icon?: string }>;
  is_installed: boolean;
  is_beta: boolean;
  installed_at: string | null;
  position: number;
};

export type AppsResponse = {
  apps: AppCatalogEntry[];
  can_install: boolean;
  role: string;
};

/**
 * Loads the apps catalog + installed flags for a workspace.
 * Caller can call refresh() after install/uninstall to update the UI.
 */
export function useApps(workspaceId: string | undefined) {
  const [data, setData] = useState<AppsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setData(null);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/apps?workspace_id=${encodeURIComponent(workspaceId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as AppsResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { data, loading, error, refresh };
}
