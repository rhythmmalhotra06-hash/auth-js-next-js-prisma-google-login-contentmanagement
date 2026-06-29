'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

export interface ColumnDef<T> {
  key: string;
  label: string;
  /** Mandated columns (CLAUDE.md §7) — always visible, can't be hidden. */
  locked?: boolean;
  /** Hidden by default unless locked; user can reveal via the Columns menu. */
  defaultVisible?: boolean;
  sortable?: boolean;
  numeric?: boolean;
  /** Default column width in px (resizable by the user; persisted per view). */
  width?: number;
  /** Value used for comparison; strings compared case-insensitively, numbers numerically. */
  sortAccessor?: (row: T) => string | number | null;
}

const DEFAULT_COL_WIDTH = 150;
const MIN_COL_WIDTH = 80;
const MAX_COL_WIDTH = 640;
const clampWidth = (px: number) => Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, Math.round(px)));

export type SortState = { key: string; dir: 'asc' | 'desc' } | null;

// Locked → always on; otherwise honor defaultVisible (default false for optional columns).
function initialVisibility<T>(columns: ColumnDef<T>[]): Record<string, boolean> {
  return Object.fromEntries(columns.map((c) => [c.key, c.locked ? true : c.defaultVisible === true]));
}

function initialWidths<T>(columns: ColumnDef<T>[]): Record<string, number> {
  return Object.fromEntries(columns.map((c) => [c.key, c.width ?? DEFAULT_COL_WIDTH]));
}

/**
 * Sort state + column visibility for a list view, persisted per-view to localStorage.
 * SSR-safe: renders deterministic defaults, then hydrates saved prefs after mount.
 */
export function useTableView<T>({ columns, storageKey, defaultSort = null }: {
  columns: ColumnDef<T>[]; storageKey: string; defaultSort?: SortState;
}) {
  const [visible, setVisible] = useState<Record<string, boolean>>(() => initialVisibility(columns));
  const [sort, setSort] = useState<SortState>(defaultSort);
  const [widths, setWidths] = useState<Record<string, number>>(() => initialWidths(columns));
  const [hydrated, setHydrated] = useState(false);

  // Hydrate saved prefs after mount (avoids server/client mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`tableview:${storageKey}`);
      if (raw) {
        const saved = JSON.parse(raw) as { visible?: Record<string, boolean>; sort?: SortState; widths?: Record<string, number> };
        if (saved.visible) {
          setVisible((v) => {
            const next = { ...v };
            for (const c of columns) if (!c.locked && typeof saved.visible![c.key] === 'boolean') next[c.key] = saved.visible![c.key];
            return next;
          });
        }
        if (saved.sort !== undefined) setSort(saved.sort);
        if (saved.widths) {
          setWidths((w) => {
            const next = { ...w };
            for (const c of columns) if (typeof saved.widths![c.key] === 'number') next[c.key] = clampWidth(saved.widths![c.key]);
            return next;
          });
        }
      }
    } catch {
      /* ignore malformed storage */
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist after hydration so we never overwrite saved prefs with defaults on first paint.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(`tableview:${storageKey}`, JSON.stringify({ visible, sort, widths }));
    } catch {
      /* storage full / unavailable */
    }
  }, [visible, sort, widths, hydrated, storageKey]);

  const toggleSort = useCallback((key: string) => {
    setSort((s) => {
      if (!s || s.key !== key) return { key, dir: 'asc' };
      if (s.dir === 'asc') return { key, dir: 'desc' };
      return null; // third click clears back to default order
    });
  }, []);

  const toggleColumn = useCallback((key: string) => {
    setVisible((v) => ({ ...v, [key]: !v[key] }));
  }, []);

  const reset = useCallback(() => {
    setVisible(initialVisibility(columns));
    setSort(defaultSort);
    setWidths(initialWidths(columns));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setWidth = useCallback((key: string, px: number) => {
    setWidths((w) => ({ ...w, [key]: clampWidth(px) }));
  }, []);
  const widthOf = useCallback(
    (key: string) => widths[key] ?? columns.find((c) => c.key === key)?.width ?? DEFAULT_COL_WIDTH,
    [widths, columns],
  );

  const isVisible = useCallback((key: string) => visible[key] ?? false, [visible]);
  const visibleColumns = useMemo(() => columns.filter((c) => visible[c.key]), [columns, visible]);
  const hiddenCount = useMemo(() => columns.filter((c) => !c.locked && !visible[c.key]).length, [columns, visible]);

  const sortRows = useCallback((rows: T[]): T[] => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortAccessor) return rows;
    const acc = col.sortAccessor;
    const mult = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = acc(a), bv = acc(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls sink regardless of direction
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mult;
      return String(av).localeCompare(String(bv)) * mult;
    });
  }, [sort, columns]);

  return { visible, isVisible, visibleColumns, hiddenCount, sort, toggleSort, toggleColumn, reset, sortRows, widths, widthOf, setWidth };
}
