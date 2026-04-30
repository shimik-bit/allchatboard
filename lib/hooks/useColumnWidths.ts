/**
 * useColumnWidths — persistent per-table column width customization.
 *
 * Stores widths in localStorage keyed by tableId so each table remembers
 * its own column sizing across sessions. The keys are field slugs (not field
 * IDs) so that width persists even if the field is recreated with the same slug.
 *
 * Browser-only (uses localStorage). On the server-render this hook returns
 * an empty object and a no-op setter, which is fine because the column
 * width is just style.width on a <th> — missing widths just fall back to
 * Tailwind's default sizing.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_PREFIX = 'tf_col_widths_';
/** Below this px width we treat the column as collapsed/hidden — clamp up */
const MIN_WIDTH = 60;
/** Beyond this we clamp down — runaway drags are usually mistakes */
const MAX_WIDTH = 800;

export function useColumnWidths(tableId: string) {
  const [widths, setWidths] = useState<Record<string, number>>({});

  // Load saved widths from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + tableId);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          setWidths(parsed);
        }
      }
    } catch {
      // localStorage unavailable / quota exceeded / corrupted JSON
      // — silently ignore and use defaults
    }
  }, [tableId]);

  /**
   * Set a single column's width. Clamps to MIN_WIDTH/MAX_WIDTH and
   * persists to localStorage immediately so refreshes don't lose the
   * adjustment. Does nothing on the server.
   */
  const setWidth = useCallback(
    (fieldSlug: string, width: number) => {
      const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(width)));
      setWidths((prev) => {
        const next = { ...prev, [fieldSlug]: clamped };
        try {
          localStorage.setItem(STORAGE_PREFIX + tableId, JSON.stringify(next));
        } catch {
          // ignore — width still applies in-memory for this session
        }
        return next;
      });
    },
    [tableId]
  );

  /** Reset all widths back to defaults (clears localStorage entry) */
  const resetWidths = useCallback(() => {
    setWidths({});
    try {
      localStorage.removeItem(STORAGE_PREFIX + tableId);
    } catch {
      // ignore
    }
  }, [tableId]);

  return { widths, setWidth, resetWidths };
}
