'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { TicketStatusBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { starString } from '@/lib/studio/format';
import { approveContentReview, sendBackContentReview } from '@/app/studio/actions';
import type { ContentReviewItem } from '@/lib/studio/data';

// Work awaiting review, grouped by ticket status, filterable by editor / event /
// asset type and ordered by starred priority. Approve (→ Approved) or send back
// (→ In Revision + note) inline; the title and folder link open for review.
const GROUPS: { status: string; label: string }[] = [
  { status: 'Review', label: 'In review' },
  { status: 'In Revision', label: 'In revision' },
];

const uniq = (vals: (string | null)[]) =>
  [...new Set(vals.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));

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
  const [editor, setEditor] = useState('');
  const [event, setEvent] = useState('');
  const [asset, setAsset] = useState('');
  const hide = (id: string) => setHidden((prev) => new Set(prev).add(id));

  const editors = useMemo(() => uniq(items.map((i) => i.assignee)), [items]);
  const events = useMemo(() => uniq(items.map((i) => i.event)), [items]);
  const assets = useMemo(() => uniq(items.map((i) => i.assetType)), [items]);

  const visible = items.filter(
    (i) => !hidden.has(i.id)
      && (!editor || i.assignee === editor)
      && (!event || i.event === event)
      && (!asset || i.assetType === asset),
  );

  return (
    <>
      <div className="filters">
        <span className="flab">Filter</span>
        <select value={editor} onChange={(e) => setEditor(e.target.value)} aria-label="Filter by editor">
          <option value="">All editors</option>
          {editors.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={event} onChange={(e) => setEvent(e.target.value)} aria-label="Filter by event type">
          <option value="">All event types</option>
          {events.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={asset} onChange={(e) => setAsset(e.target.value)} aria-label="Filter by asset type">
          <option value="">All asset types</option>
          {assets.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

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
    </>
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

  const meta = [item.event ?? 'No event', item.assetType, item.assignee].filter(Boolean).join(' · ');

  return (
    <>
      <div className="st-row">
        <span className="st-stars" title="Priority ranking">{starString(item.rank)}</span>
        <div className="main">
          <Link href={`/tickets/${item.id}`} className="nm st-rowlink">{item.title}</Link>
          <div className="sb">{meta}</div>
        </div>
        {dueLabel(item.dueDate)}
        <TicketStatusBadge status={item.ticketStatus} />
        {item.folderUrl && (
          <a className="btn sm" href={item.folderUrl} target="_blank" rel="noopener noreferrer" title="Open asset folder">
            <Icon name="ext" size={14} /> Folder
          </a>
        )}
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
