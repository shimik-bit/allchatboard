/**
 * useGridCopyPaste - Excel-style copy/paste for individual cells
 *
 * V1 scope: single-cell copy and paste.
 * Future: range selection, paste-into-many-cells.
 *
 * Copy: Ctrl+C copies the active cell's text representation to clipboard
 *       (so it pastes correctly into Excel/Sheets too).
 * Paste: Ctrl+V reads the clipboard and writes it into the active cell
 *        via the provided onPasteCell callback. The caller decides how
 *        to interpret the pasted text for the cell's field type.
 */

'use client';

import { useEffect } from 'react';
import type { CellCoord } from './useGridKeyboardNav';

interface UseCopyPasteOpts {
  /** Currently active cell, if any */
  activeCell: CellCoord | null;
  /** Get the current display text for a cell (used by Ctrl+C) */
  getCellText: (coord: CellCoord) => string;
  /** Apply pasted text to a cell (used by Ctrl+V) */
  onPasteCell?: (coord: CellCoord, text: string) => void | Promise<void>;
}

export function useGridCopyPaste({
  activeCell,
  getCellText,
  onPasteCell,
}: UseCopyPasteOpts) {
  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      // Don't interfere with normal text-selection copy
      if (window.getSelection()?.toString()) return;
      if (!activeCell) return;

      const text = getCellText(activeCell);
      if (text === undefined || text === null) return;

      e.preventDefault();
      e.clipboardData?.setData('text/plain', text);
    };

    const onPaste = async (e: ClipboardEvent) => {
      if (!activeCell || !onPasteCell) return;

      // Skip if user is inside a real editable input — they probably
      // want to paste into that field, not the grid cell.
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }

      const text = e.clipboardData?.getData('text/plain');
      if (text === undefined) return;

      e.preventDefault();
      await onPasteCell(activeCell, text);
    };

    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
    };
  }, [activeCell, getCellText, onPasteCell]);
}
