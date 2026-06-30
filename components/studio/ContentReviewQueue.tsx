'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { TicketStatusBadge } from '@/components/ui/Badge';
import { approveContentReview, sendBackContentReview } from '@/app/studio/actions';
import type { ContentReviewItem } from '@/lib/studio/data';

// Work awaiting review, grouped by ticket status. Approve (→ Approved) or
// send back (→ In Revision + note) inline; the title opens the ticket.
const GROUPS: { status: string; label: string }[] = [
  { status: 'Review', label: 'In review' },
  { status: 'In Revision', label: 'In revision' },
];

function dueLabel(due: string | null) {
  if (!due) return null;
  const d = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  if (Number.isNaN(d)) return null;
  if (d < 0) return <span className="due far">overdue</span>;
  const cls = d <= 2 ? 'soon' : d <= 6 ? 'mid' : 'far';
  return <span className={`due ${cls}`}>due {d}d</span>;
}

export function ContentReviewQueue({ items }: { items: ContentReviewItem[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const hide = (id: string) => setHidden((prev) => new Set(prev).add(id));
  const visible = items.filter((i) => !hidden.has(i.id));

  return (
    <div className="stack">
      {GROUPS.map((g) => {
        const rows = visible.filter((i) => i.ticketStatus === g.status);
        return (
          <section key={g.status}>
            <div className="sec-head">
              <h3>{g.label}</h3>
              <span className="hint">{rows.length} ticket{rows.length === 1 ? '' : 's'}</span>
            </div>
            {rows.length === 0 ? (
              <div className="empty">Nothing {g.label.toLowerCase()}.</div>
            ) : (
              <div className="st-list">
                {rows.map((it) => <Row key={it.id} item={it} onDone={() => hide(it.id)} />)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Row({ item, onDone }: { item: ContentReviewItem; onDone: () => void }) {
  const [mode, setMode] = useState<'idle' | 'note'>('idle');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function approve() {
    setErr(null);
    start(async () => {
      const r = await approveContentReview(item.id);
      if (r.ok) onDone(); else setErr(r.error ?? 'Failed');
    });
  }
  function sendBack() {
    if (!note.trim()) { setErr('Add a note before sending back'); return; }
    setErr(null);
    start(async () => {
      const r = await sendBackContentReview(item.id, note);
      if (r.ok) onDone(); else setErr(r.error ?? 'Failed');
    });
  }

  return (
    <>
      <div className="st-row">
        <div className="main">
          <Link href={`/tickets/${item.id}`} className="nm st-rowlink">{item.title}</Link>
          <div className="sb">{item.event ?? 'No event'}{item.assignee ? ` · ${item.assignee}` : ''}</div>
        </div>
        {dueLabel(item.dueDate)}
        <TicketStatusBadge status={item.ticketStatus} />
        <div className="st-rowacts">
          {mode === 'idle' ? (
            <>
              <button className="st-sendback" onClick={() => setMode('note')} disabled={pending}>Send back</button>
              <button className="st-approve" onClick={approve} disabled={pending}>Approve</button>
            </>
          ) : (
            <>
              <button className="st-sendback" onClick={() => setMode('idle')} disabled={pending}>Cancel</button>
              <button className="st-approve" onClick={sendBack} disabled={pending}>Submit note</button>
            </>
          )}
        </div>
      </div>
      {mode === 'note' && (
        <div className="st-row">
          <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="What needs changing? Saved to V's Notes and sent back for revision." />
        </div>
      )}
      {err && <div className="st-row" style={{ color: 'var(--red-content)', fontSize: 12 }}>{err}</div>}
    </>
  );
}
