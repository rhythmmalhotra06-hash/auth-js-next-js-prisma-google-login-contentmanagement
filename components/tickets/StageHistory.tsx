import { TicketStatusBadge } from '@/components/ui/Badge';
import { buildStageHistory, formatDays } from '@/lib/tickets/timeline';
import type { TicketEventRow } from '@/lib/tickets/data';

/** Renders a ticket's ticket_status transition history — how long it sat in each
 *  stage, and how long it's been in the current one — from its TicketEvent rows.
 *  Server component; no client state needed. */
export function StageHistory({ createdAt, events }: { createdAt: string; events: TicketEventRow[] }) {
  const spans = buildStageHistory(events);

  if (spans.length === 0) {
    return (
      <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
        No stage history recorded — created {new Date(createdAt).toLocaleDateString()}, before this ticket&apos;s audit trail began.
      </p>
    );
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      {spans.map((s, i) => {
        const open = s.exitedAt === null;
        return (
          <div key={`${s.status}-${s.enteredAt}-${i}`} className="field-row">
            <div className="k"><TicketStatusBadge status={s.status} /></div>
            <div className="v" style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}>
              {open
                ? <span className="risk high">current — {formatDays(s.days)} and counting</span>
                : <span>{formatDays(s.days)}</span>}
              {s.actor && <span className="subtle">· {s.actor}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
