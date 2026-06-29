'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import type { ReviewItem } from '@/lib/studio/data';
import { useReview } from '@/components/studio/useReview';

/** The hero "waiting on you" block — calm green when clear, one saturated commit block when pending. */
export function SignOffHero({ items }: { items: ReviewItem[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const hide = (id: string) => setHidden((prev) => new Set(prev).add(id));
  const visible = items.filter((i) => !hidden.has(i.id));

  if (visible.length === 0) {
    return (
      <div className="st-signoff-clear">
        <div className="badge"><Icon name="check" size={20} /></div>
        <div>
          <h3>Nothing is waiting on you</h3>
          <p>The team can keep moving. Anything that needs your sign-off shows up here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="st-commit">
      <div className="st-commit-head">
        <div className="lhs">
          <Icon name="list" size={18} />
          <h3>{visible.length} {visible.length === 1 ? 'thing needs' : 'things need'} your sign-off</h3>
          <span className="cnt">priority</span>
        </div>
        <Link href="/studio/sign-off" className="go">Review all <Icon name="arrow" size={14} /></Link>
      </div>
      <div className="st-commit-list">
        {visible.slice(0, 3).map((it) => <Row key={it.id} item={it} onDone={() => hide(it.id)} />)}
      </div>
    </div>
  );
}

function Row({ item, onDone }: { item: ReviewItem; onDone: () => void }) {
  const r = useReview(item.id, onDone);
  return (
    <>
      <div className="st-commit-row">
        <div className="title">
          <b>{item.title}</b>
          <div className="meta">{item.event ?? 'No event'}{item.score ? ` · score ${item.score}` : ''}</div>
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
        <div className="st-noteform">
          <textarea autoFocus value={r.note} onChange={(e) => r.setNote(e.target.value)}
            placeholder="What needs changing? Saved to V's Notes and sent back for revision." />
        </div>
      )}
      {r.err && <div className="st-noteform" style={{ color: 'var(--red-content)', fontSize: 12 }}>{r.err}</div>}
    </>
  );
}
