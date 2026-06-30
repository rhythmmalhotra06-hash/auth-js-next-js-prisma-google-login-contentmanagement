import Link from 'next/link';
import { TicketStatusBadge } from '@/components/ui/Badge';
import type { ContentReviewItem } from '@/lib/studio/data';

// Work awaiting review, grouped by ticket status. Each row opens the ticket.
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
  return (
    <div className="stack">
      {GROUPS.map((g) => {
        const rows = items.filter((i) => i.ticketStatus === g.status);
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
                {rows.map((it) => (
                  <Link key={it.id} href={`/tickets/${it.id}`} className="st-row st-rowlink">
                    <div className="main">
                      <div className="nm">{it.title}</div>
                      <div className="sb">{it.event ?? 'No event'}{it.assignee ? ` · ${it.assignee}` : ''}</div>
                    </div>
                    {dueLabel(it.dueDate)}
                    <TicketStatusBadge status={it.ticketStatus} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
