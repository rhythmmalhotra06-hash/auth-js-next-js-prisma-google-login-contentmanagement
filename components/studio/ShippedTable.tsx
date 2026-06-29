import Link from 'next/link';
import { TierBadge } from '@/components/ui/TierBadge';
import type { QueueTicket } from '@/lib/tickets/data';

/** Recently shipped, newest first — used by the full /studio/shipped view. */
export function ShippedTable({ tickets }: { tickets: QueueTicket[] }) {
  if (tickets.length === 0) {
    return <div className="st-list"><div className="st-row"><div className="main"><div className="nm subtle">Nothing shipped yet.</div></div></div></div>;
  }
  return (
    <div className="st-list">
      {tickets.map((t) => (
        <Link key={t.id} href={`/tickets/${t.id}`} className="st-row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="st-dot sd-done" style={{ width: 74, flexShrink: 0 }}>Shipped</span>
          <div className="main">
            <div className="nm">{t.title}</div>
            <div className="sb"><TierBadge event={t.eventType} />{t.assetType ? ` · ${t.assetType}` : ''}</div>
          </div>
          <span className="col hide-sm">{t.assignee ?? '—'}</span>
        </Link>
      ))}
    </div>
  );
}
