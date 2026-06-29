import type { QueueTicket } from '@/lib/tickets/data';
import { type ScoringConfig, capacityFor, loadWeightFor } from '@/lib/scoring-config/config';

const initials = (name: string) =>
  name.split(/\s+/).map((p) => p[0]?.toUpperCase() ?? '').slice(0, 2).join('') || '—';

const round1 = (n: number) => Math.round(n * 10) / 10;

// Lifecycle funnel + per-editor capacity — computed from the ticket list.
// `cfg` supplies per-editor capacity, type-weighted load, and colour thresholds;
// without it the bars fall back to the original flat 4-per-editor behaviour.
export function FunnelCapacity({ tickets, cfg }: { tickets: QueueTicket[]; cfg?: ScoringConfig }) {
  const stages = [
    { n: 'Requested', c: 'var(--blue)', f: (t: QueueTicket) => ['Backlog', 'To Do', 'Request on Hold'].includes(t.ticketStatus ?? '') },
    { n: 'In production', c: 'var(--amber)', f: (t: QueueTicket) => ['In Progress', 'In Revision'].includes(t.ticketStatus ?? '') },
    { n: 'In review', c: 'var(--brand)', f: (t: QueueTicket) => ['Review', 'Approved'].includes(t.ticketStatus ?? '') },
    { n: 'Published', c: 'var(--green)', f: (t: QueueTicket) => ['Done', 'Shipping'].includes(t.ticketStatus ?? '') },
  ].map((s) => ({ ...s, ct: tickets.filter(s.f).length }));
  const mx = Math.max(...stages.map((s) => s.ct), 1);

  const active = tickets.filter((t) => !['Done', "Won't Do"].includes(t.ticketStatus ?? ''));
  const byEditor = new Map<string, number>();
  for (const t of active) {
    if (!t.assignee) continue;
    const w = cfg ? loadWeightFor(cfg, t.eventType, t.assetType) : 1;
    byEditor.set(t.assignee, (byEditor.get(t.assignee) ?? 0) + w);
  }
  const caps = [...byEditor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const amberPct = cfg?.amberPct ?? 75;
  const redPct = cfg?.redPct ?? 100;

  return (
    <div className="datarow">
      <div className="panel">
        <h4>Lifecycle funnel</h4>
        <div className="funnel">
          {stages.map((s) => (
            <div className="fstage" key={s.n}>
              <span className="nm">{s.n}</span>
              <div className="fbar-wrap"><div className="fbar" style={{ width: `${Math.round((s.ct / mx) * 100)}%`, background: s.c }} /></div>
              <span className="ct">{s.ct}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h4>Editor capacity</h4>
        {caps.length === 0 && <p className="subtle" style={{ fontSize: 13 }}>No assigned work in flight.</p>}
        {caps.map(([name, load]) => {
          const cap = cfg ? capacityFor(cfg, name) : 4;
          const usedPct = cap > 0 ? (load / cap) * 100 : 100;
          const pct = Math.min(usedPct, 100);
          const col = usedPct >= redPct ? 'var(--red)' : usedPct >= amberPct ? 'var(--amber)' : 'var(--green)';
          return (
            <div className="cap-row" key={name}>
              <span className="who"><span className="avatar">{initials(name)}</span>{name}</span>
              <div className="cap-bar-wrap"><div className="cap-bar" style={{ width: `${pct}%`, background: col }} /></div>
              <span className="n">{round1(load)}/{round1(cap)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
