/**
 * useGridKeyboardNav - Excel/Sheets-style keyboard navigation for the grid
 *
 * What it provides:
 *   - Arrow keys move the active cell one step in the direction
 *   - Tab / Shift+Tab move horizontally
 *   - Enter moves down (matching Sheets default)
 *   - Escape clears active cell selection
 *   - Home/End jump to start/end of row
 *   - Ctrl+Home/Ctrl+End jump to top-left/bottom-right of table
 *   - Page Up/Down move 10 rows at a time
 *
 * Active cell coordinates are { row, col } indices into the visible grid.
 * The hook only manages the coordinates — visual highlighting and cell
 * editing trigger are handled by the consuming component.
 */

'use client';

import { useState, useCallback, useEffect } from 'react';

export interface CellCoord {
  row: number;
  col: number;
}

interface UseGridKeyboardNavOpts {
  /** Total visible rows in the grid */
  rowCount: number;
  /** Total visible cols in the grid */
  colCount: number;
  /** Whether keyboard nav is currently enabled (e.g. disable while editing) */
  enabled?: boolean;
  /** Called when Enter pressed on a cell — opens the cell editor */
  onActivate?: (coord: CellCoord) => void;
  /** Optional: scroll cell into view when it changes */
  scrollToCell?: (coord: CellCoord) => void;
}

export function useGridKeyboardNav({
  rowCount,
  colCount,
  enabled = true,
  onActivate,
  scrollToCell,
}: UseGridKeyboardNavOpts) {
  const [active, setActive] = useState<CellCoord | null>(null);

  const move = useCallback(
    (drow: number, dcol: number) => {
      setActive((prev) => {
        if (!prev) {
          // No active cell yet → start at top-left when arrow is pressed
          return { row: 0, col: 0 };
        }
        const next: CellCoord = {
          row: Math.max(0, Math.min(rowCount - 1, prev.row + drow)),
          col: Math.max(0, Math.min(colCount - 1, prev.col + dcol)),
        };
        return next;
      });
    },
    [rowCount, colCount]
  );

  const setCell = useCallback((coord: CellCoord | null) => {
    setActive(coord);
  }, []);

  // Auto-scroll into view whenever active cell changes
  useEffect(() => {
    if (active && scrollToCell) {
      scrollToCell(active);
    }
  }, [active, scrollToCell]);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Don't hijack keys when user is typing inside a real input field.
      // The grid's own EditableCell uses inputs only WHILE editing — when
      // not editing, focus is on the cell wrapper, so arrows work as expected.
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          move(-1, 0);
          break;
        case 'ArrowDown':
          e.preventDefault();
          move(1, 0);
          break;
        case 'ArrowLeft':
          // Note: Hebrew RTL — visual "left" arrow should still move the
          // logical cursor right (next column) because column order is
          // reversed visually. Adjust if your grid renders RTL columns.
          e.preventDefault();
          move(0, 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          move(0, -1);
          break;
        case 'Tab':
          e.preventDefault();
          move(0, e.shiftKey ? 1 : -1);
          break;
        case 'Enter':
          if (active && onActivate) {
            e.preventDefault();
            onActivate(active);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setActive(null);
          break;
        case 'Home':
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            setActive({ row: 0, col: 0 });
          } else {
            setActive((p) => (p ? { ...p, col: 0 } : { row: 0, col: 0 }));
          }
          break;
        case 'End':
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            setActive({ row: rowCount - 1, col: colCount - 1 });
          } else {
            setActive((p) => (p ? { ...p, col: colCount - 1 } : { row: 0, col: colCount - 1 }));
          }
          break;
        case 'PageDown':
          e.preventDefault();
          move(10, 0);
          break;
        case 'PageUp':
          e.preventDefault();
          move(-10, 0);
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, move, active, onActivate, rowCount, colCount]);

  return { active, setCell, move };
}
