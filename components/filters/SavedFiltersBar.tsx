'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Bookmark, Loader2 } from 'lucide-react';
import type { FilterGroup } from '@/lib/filters';

export interface SavedFilter {
  id: string;
  name: string;
  filters: FilterGroup;
  icon: string | null;
  position: number;
  is_pinned: boolean;
}

interface SavedFiltersBarProps {
  tableId: string;
  workspaceId: string;
  /** Filters currently applied (uncontrolled - user might be editing them) */
  currentFilters: FilterGroup;
  /** Activate a saved filter — caller updates currentFilters */
  onApply: (filters: FilterGroup, savedFilterId: string) => void;
  /** Active saved filter id (chip is highlighted) */
  activeId: string | null;
  /** Reset to no filter */
  onClear: () => void;
}

/**
 * Horizontal bar of saved-filter chips that appears above the table.
 * Click a chip → its filter is applied. Click X on a chip → delete.
 *
 * Loads filters on mount. Re-loads when explicitly told (e.g. after creating
 * a new one, the parent calls `refresh()` via the ref pattern).
 */
export default function SavedFiltersBar({
  tableId,
  workspaceId,
  currentFilters,
  onApply,
  activeId,
  onClear,
}: SavedFiltersBarProps) {
  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadFilters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/saved-filters?table_id=${tableId}`);
      if (res.ok) {
        const json = await res.json();
        setFilters(json.filters || []);
      }
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    loadFilters();
    // Re-fetch when window gets focus (catch updates from other tabs)
    const handler = () => loadFilters();
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [loadFilters]);

  // Expose refresh hook globally so the FilterPanel can trigger reload after save
  useEffect(() => {
    (window as any).__refreshSavedFilters = loadFilters;
    return () => { delete (window as any).__refreshSavedFilters; };
  }, [loadFilters]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('למחוק את הפילטר השמור?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/saved-filters/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setFilters(filters.filter((f) => f.id !== id));
        if (activeId === id) onClear();
      }
    } finally {
      setDeleting(null);
    }
  };

  if (loading && filters.length === 0) {
    return null; // don't show loading state on first render — keeps the toolbar quiet
  }

  // Don't render the bar at all if there are no saved filters yet
  if (filters.length === 0) return null;

  const hasActiveFilters = currentFilters.conditions && currentFilters.conditions.length > 0;

  return (
    <div className="flex items-center gap-1.5 flex-wrap py-1.5 px-1">
      <Bookmark className="w-3.5 h-3.5 text-gray-400 ml-1" />
      {filters.map((f) => {
        const isActive = activeId === f.id;
        return (
          <button
            key={f.id}
            onClick={() => onApply(f.filters, f.id)}
            className={`group inline-flex items-center gap-1 pl-1.5 pr-2.5 py-1 text-xs rounded-full border transition ${
              isActive
                ? 'bg-emerald-100 border-emerald-400 text-emerald-800 font-bold shadow-sm'
                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
            }`}
            title={`${f.filters.conditions?.length || 0} תנאים`}
          >
            {f.icon && <span className="ml-0.5">{f.icon}</span>}
            <span>{f.name}</span>
            <span className="text-gray-400 text-[10px]">
              ·{f.filters.conditions?.length || 0}
            </span>
            <span
              role="button"
              tabIndex={-1}
              onClick={(e) => handleDelete(f.id, e)}
              className="opacity-0 group-hover:opacity-100 mr-0.5 p-0.5 rounded-full hover:bg-red-50 hover:text-red-600 transition"
              title="מחק פילטר שמור"
            >
              {deleting === f.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <X className="w-3 h-3" />
              )}
            </span>
          </button>
        );
      })}
      {(hasActiveFilters || activeId) && (
        <button
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-gray-700 underline mx-1"
        >
          נקה
        </button>
      )}
    </div>
  );
}
