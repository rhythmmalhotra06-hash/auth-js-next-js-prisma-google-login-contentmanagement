'use client';

import { cn } from '@/lib/cn';
import { Icon } from '@/components/ui/Icon';
import type { SortState } from './useTableView';

// A sortable column header. Renders a button when onSort is given; sets aria-sort.
// Caret is faint on hover, solid + rotated when this column is the active sort.
export function SortableTh({ label, sortKey, sort, onSort, style }: {
  label: string;
  sortKey: string;
  sort: SortState;
  onSort?: (key: string) => void;
  style?: React.CSSProperties;
}) {
  if (!onSort) return <th style={style}>{label}</th>;
  const active = sort?.key === sortKey;
  const dir = active ? sort!.dir : undefined;
  return (
    <th style={style} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="th-sort" onClick={() => onSort(sortKey)}>
        <span>{label}</span>
        <Icon name="chevron" size={12} className={cn('th-caret', active && 'on', dir === 'asc' && 'up')} />
      </button>
    </th>
  );
}
