'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { RankItem } from '@/lib/studio/data';
import { StarRating } from '@/components/studio/StarRating';

type Filter = 'all' | 'ranked' | 'unranked';

/** Priority ranking queue — the active production queue with editable stars. */
export function PriorityRanking({ items }: { items: RankItem[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const visible = items.filter((i) => {
    if (filter === 'ranked') return i.rank != null;
    if (filter === 'unranked') return i.rank == null;
    return true;
  });

  const chip = (key: Filter, label: string) => (
    <button type="button" className={cn('chipbtn', filter === key && 'on')} onClick={() => setFilter(key)}>
      {label}
    </button>
  );

  return (
    <>
      <div className="st-filters">
        {chip('all', 'Everything')}
        {chip('unranked', 'Not yet ranked')}
        {chip('ranked', 'Ranked')}
      </div>
      <div className="st-list">
        {visible.length === 0 ? (
          <div className="st-row"><div className="main"><div className="nm subtle">Nothing in this filter.</div></div></div>
        ) : (
          visible.map((it) => (
            <div className="st-row" key={it.id}>
              <StarRating ticketId={it.id} value={it.rank} />
              <div className="main">
                <div className="nm">{it.title}</div>
                <div className="sb">{it.event ?? 'No event'}{it.assetType ? ` · ${it.assetType}` : ''}</div>
              </div>
              <span className="col hide-sm">{it.score ? `score ${it.score}` : '—'}</span>
            </div>
          ))
        )}
      </div>
    </>
  );
}
