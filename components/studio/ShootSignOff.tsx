'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { shortDate } from '@/lib/studio/format';
import { approveShoot, declineShoot } from '@/app/studio/actions';
import type { ShootSignOffItem } from '@/lib/studio/data';

/** Shoots waiting on Vishen's sign-off — mirrors the ticket SignOffHero commit block. */
export function ShootSignOff({ items }: { items: ShootSignOffItem[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const hide = (id: string) => setHidden((prev) => new Set(prev).add(id));
  const visible = items.filter((i) => !hidden.has(i.id));

  if (visible.length === 0) return null;

  return (
    <>
      <div className="sec-head">
        <h3>Shoots awaiting your sign-off</h3>
        <span className="hint">approve filming, or send it back</span>
        <Link href="/shoots" className="st-seeall">See all shoots →</Link>
      </div>
      <div className="st-commit">
        <div className="st-commit-list">
          {visible.slice(0, 5).map((it) => <Row key={it.id} item={it} onDone={() => hide(it.id)} />)}
        </div>
      </div>
    </>
  );
}

function Row({ item, onDone }: { item: ShootSignOffItem; onDone: () => void }) {
  const [mode, setMode] = useState<'idle' | 'note'>('idle');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const meta = [item.format, item.filmingDate ? shortDate(item.filmingDate) : null, item.filmingLocation]
    .filter(Boolean)
    .join(' · ');

  function approve() {
    setErr(null);
    start(async () => {
      const res = await approveShoot(item.id);
      if (res.ok) onDone();
      else setErr(res.error ?? 'Failed');
    });
  }

  function decline() {
    setErr(null);
    start(async () => {
      const res = await declineShoot(item.id, note);
      if (res.ok) onDone();
      else setErr(res.error ?? 'Failed');
    });
  }

  return (
    <>
      <div className="st-commit-row">
        <div className="title">
          <b>{item.title}</b>
          <div className="meta">{meta || 'No filming details yet'}</div>
        </div>
        <div className="st-rowacts">
          {mode === 'idle' ? (
            <>
              <button className="st-sendback" onClick={() => setMode('note')} disabled={pending}>Decline</button>
              <button className="st-approve" onClick={approve} disabled={pending}>
                <Icon name="check" size={14} /> Approve
              </button>
            </>
          ) : (
            <>
              <button className="st-sendback" onClick={() => setMode('idle')} disabled={pending}>Cancel</button>
              <button className="st-approve" onClick={decline} disabled={pending}>Confirm decline</button>
            </>
          )}
        </div>
      </div>
      {mode === 'note' && (
        <div className="st-noteform">
          <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Optional: why is this not happening? Saved to the shoot's notes. Leave blank to just cancel." />
        </div>
      )}
      {err && <div className="st-noteform" style={{ color: 'var(--red-content)', fontSize: 12 }}>{err}</div>}
    </>
  );
}
