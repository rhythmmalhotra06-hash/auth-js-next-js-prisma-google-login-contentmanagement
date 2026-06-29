'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { Bucket } from '@/lib/studio/data';
import { starString } from '@/lib/studio/format';

export interface DrillRow {
  id: string;
  title: string;
  sub: string;
  rank: number | null;
  status: Bucket;
}

type Filter = 'all' | 'active' | 'review' | 'done';

const DOT: Record<Bucket, { cls: string; label: string }> = {
  ship: { cls: 'sd-done', label: 'Shipped' },
  rev: { cls: 'sd-rev', label: 'In review' },
  prod: { cls: 'sd-prod', label: 'In production' },
  todo: { cls: 'sd-todo', label: 'To do' },
};

/** Asset-by-asset rows for a launch — the literal answer to "where is the ticket". */
export function LaunchDrillTable({ rows }: { rows: DrillRow[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const visible = rows.filter((r) => {
    if (filter === 'active') return r.status === 'prod' || r.status === 'todo';
    if (filter === 'review') return r.status === 'rev';
    if (filter === 'done') return r.status === 'ship';
    return true;
  });
  const chip = (k: Filter, label: string) => (
    <button type="button" className={cn('chipbtn', filter === k && 'on')} onClick={() => setFilter(k)}>{label}</button>
  );
  return (
    <>
      <div className="st-filters">
        {chip('all', 'Everything')}
        {chip('active', 'In progress')}
        {chip('review', 'In review')}
        {chip('done', 'Shipped')}
      </div>
      <div className="st-list">
        {visible.length === 0 ? (
          <div className="st-row"><div className="main"><div className="nm subtle">Nothing in this filter.</div></div></div>
        ) : (
          visible.map((r) => (
            <Link key={r.id} href={`/tickets/${r.id}`} className="st-row" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="st-stars">{starString(r.rank)}</span>
              <div className="main">
                <div className="nm">{r.title}</div>
                <div className="sb">{r.sub}</div>
              </div>
              <span className={cn('col hide-sm st-dot', DOT[r.status].cls)}>{DOT[r.status].label}</span>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
