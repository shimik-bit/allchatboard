/**
 * useUndoStack - simple bounded undo stack for record edits
 *
 * Tracks the last N edits (default 20) so users can Ctrl+Z to revert.
 * Each entry contains everything needed to reverse the operation:
 *   - what record
 *   - what field
 *   - what value to restore (the OLD value)
 *
 * NOT a full undo/redo system — just a one-way "undo recent change" stack.
 * Redo is intentionally omitted to keep the mental model simple (matches
 * what most users actually do in Sheets: Ctrl+Z to fix a mistake, then
 * keep typing).
 *
 * Limitations to be aware of:
 *   - Only tracks single-cell edits, not bulk operations or deletes.
 *     Bulk actions are confirmed via dialog so undo is less critical there.
 *   - Doesn't survive page refresh.
 *   - Stack lives per component instance, not globally.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';

export interface UndoEntry {
  recordId: string;
  fieldSlug: string;
  oldValue: any;
  // Optional human-readable description for tooltips/notifications:
  // "ביטול עריכה של 'סכום' ב-EXP-0001"
  description?: string;
  timestamp: number;
}

const MAX_UNDO_ENTRIES = 20;

export function useUndoStack() {
  const [stack, setStack] = useState<UndoEntry[]>([]);

  /**
   * Push an entry onto the undo stack.
   * Should be called BEFORE the actual edit happens (so we capture the
   * value as it was before the change).
   */
  const push = useCallback((entry: Omit<UndoEntry, 'timestamp'>) => {
    setStack((prev) => {
      const next = [...prev, { ...entry, timestamp: Date.now() }];
      // Cap the stack size to prevent unbounded memory growth on long sessions
      if (next.length > MAX_UNDO_ENTRIES) {
        return next.slice(next.length - MAX_UNDO_ENTRIES);
      }
      return next;
    });
  }, []);

  /**
   * Pop the most recent entry. Returns null if stack is empty.
   * Caller is responsible for actually applying the revert (calling
   * the API to set the value back).
   */
  const pop = useCallback((): UndoEntry | null => {
    let popped: UndoEntry | null = null;
    setStack((prev) => {
      if (prev.length === 0) return prev;
      popped = prev[prev.length - 1];
      return prev.slice(0, prev.length - 1);
    });
    return popped;
  }, []);

  const canUndo = stack.length > 0;
  const lastEntry = stack[stack.length - 1] ?? null;

  return { push, pop, canUndo, lastEntry, stackSize: stack.length };
}

/**
 * Hook helper: register Ctrl+Z / Cmd+Z to call onUndo.
 * Pass the same onUndo function you wire up to the visible Undo button.
 *
 * Skipped when the user is typing inside an input/textarea (otherwise
 * Ctrl+Z would conflict with the browser's native text-undo).
 */
export function useCtrlZ(onUndo: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod || e.key !== 'z' || e.shiftKey) return;

      // Don't hijack Ctrl+Z while user is editing text in an input.
      // The browser's built-in text undo is more useful there.
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }

      e.preventDefault();
      onUndo();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onUndo]);
}
