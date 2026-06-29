'use client';

import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import type { SortState } from './useTableView';

// A sortable column header. Renders a button when onSort is given; sets aria-sort.
// Caret is faint on hover, solid + rotated when this column is the active sort.
// When onResizeStart is given, a drag handle on the right edge resizes the column.
export function SortableTh({ label, sortKey, sort, onSort, onResizeStart, style }: {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort?: (key: string) => void;
  onResizeStart?: (e: React.PointerEvent<HTMLElement>) => void;
  style?: React.CSSProperties;
}) {
  const handle = onResizeStart ? (
    <span
      className="th-resize"
      onPointerDown={onResizeStart}
      onClick={(e) => e.stopPropagation()}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label} column`}
    />
  ) : null;

  if (!onSort) {
    return (
      <th style={style}>
        {label}
        {handle}
      </th>
    );
  }
  const active = sort?.key === sortKey;
  const dir = active ? sort!.dir : undefined;
  return (
    <th style={style} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="th-sort" onClick={() => onSort(sortKey)}>
        <span>{label}</span>
        <Icon name="chevron" size={12} className={cn('th-caret', active && 'on', dir === 'asc' && 'up')} />
      </button>
      {handle}
    </th>
  );
}
