'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { ReviewItem } from '@/lib/studio/data';
import { starString } from '@/lib/studio/format';
import { useReview } from '@/components/studio/useReview';

type Filter = 'all' | 'event' | 'high';
const HIGH_SCORE = 3.5;

/** Full review queue — filter chips + per-row Approve / Send back. */
export function ReviewQueueTable({ items }: { items: ReviewItem[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');
  const hide = (id: string) => setHidden((prev) => new Set(prev).add(id));

  const visible = items
    .filter((i) => !hidden.has(i.id))
    .filter((i) => {
      if (filter === 'event') return !!i.event;
      if (filter === 'high') return Number(i.score) >= HIGH_SCORE;
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
        {chip('all', 'All pending')}
        {chip('event', 'Tied to an event')}
        {chip('high', 'High score')}
      </div>
      <div className="st-list">
        {visible.length === 0 ? (
          <div className="st-row"><div className="main"><div className="nm subtle">Nothing in this filter.</div></div></div>
        ) : (
          visible.map((it) => <Row key={it.id} item={it} onDone={() => hide(it.id)} />)
        )}
      </div>
    </>
  );
}

function Row({ item, onDone }: { item: ReviewItem; onDone: () => void }) {
  const r = useReview(item.id, onDone);
  return (
    <>
      <div className="st-row">
        <span className="st-stars">{starString(item.rank)}</span>
        <div className="main">
          <div className="nm">{item.title}</div>
          <div className="sb">{item.event ?? 'No event'}{item.score ? ` · score ${item.score}` : ''}</div>
        </div>
        <div className="st-rowacts">
          {r.mode === 'idle' ? (
            <>
              <button className="st-sendback" onClick={() => r.setMode('note')} disabled={r.pending}>Send back</button>
              <button className="st-approve" onClick={r.approve} disabled={r.pending}>Approve</button>
            </>
          ) : (
            <>
              <button className="st-sendback" onClick={() => r.setMode('idle')} disabled={r.pending}>Cancel</button>
              <button className="st-approve" onClick={r.sendBack} disabled={r.pending}>Submit note</button>
            </>
          )}
        </div>
      </div>
      {r.mode === 'note' && (
        <div className="st-row">
          <textarea autoFocus value={r.note} onChange={(e) => r.setNote(e.target.value)}
            placeholder="What needs changing? Saved to V's Notes and sent back for revision." />
        </div>
      )}
      {r.err && <div className="st-row" style={{ color: 'var(--red-content)', fontSize: 12 }}>{r.err}</div>}
    </>
  );
}
