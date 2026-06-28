'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { ColumnDef } from './useTableView';

// Show/hide column popover. Locked columns (the mandated 5) render checked + disabled.
export function ColumnsMenu<T>({ columns, isVisible, onToggle, onReset, hiddenCount }: {
  columns: ColumnDef<T>[];
  isVisible: (key: string) => boolean;
  onToggle: (key: string) => void;
  onReset: () => void;
  hiddenCount: number;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="colmenu-wrap" ref={wrapRef}>
      <button type="button" className="btn sm" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Icon name="columns" size={14} /> Columns{hiddenCount > 0 && <span className="colmenu-badge">{hiddenCount}</span>}
      </button>
      {open && (
        <div className="colmenu" role="menu">
          <div className="colmenu-head">Show columns</div>
          {columns.map((c) => (
            <label key={c.key} className="colmenu-item">
              <input type="checkbox" checked={isVisible(c.key)} disabled={c.locked} onChange={() => onToggle(c.key)} />
              <span>{c.label}</span>
              {c.locked && <span className="colmenu-req"><Icon name="lock" size={10} /> required</span>}
            </label>
          ))}
          <button type="button" className="colmenu-reset" onClick={onReset}>Reset to default</button>
        </div>
      )}
    </div>
  );
}
