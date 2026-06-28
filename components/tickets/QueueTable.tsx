'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { TicketStatusBadge, PrioStatusBadge } from '@/components/ui/Badge';
import { TierBadge } from '@/components/ui/TierBadge';
import { Icon } from '@/components/ui/Icon';
import { loadMap, riskOf } from '@/lib/tickets/intel';
import type { QueueTicket } from '@/lib/tickets/data';

// Filterable queue table — ported to the prototype `.list` look. Mandated first
// five columns (CLAUDE.md §7): Title · Priority · Assigned · Ticket Status ·
// Priority Status. Clickable funnel + filters across the taxonomy dimensions.

type Dim = 'prioStatus' | 'ticketStatus' | 'eventType' | 'assetType' | 'typeOfRequest';
const FILTERS: { key: Dim; label: string }[] = [
  { key: 'eventType', label: 'All event types' },
  { key: 'assetType', label: 'All asset types' },
  { key: 'prioStatus', label: 'All priority statuses' },
  { key: 'typeOfRequest', label: 'All request types' },
];

const uniq = (rows: QueueTicket[], key: Dim) =>
  [...new Set(rows.map((r) => r[key]).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));

const TICKET_ORDER = ['Backlog', 'To Do', 'In Progress', 'In Revision', 'Review', 'Approved', 'Shipping', 'Done', "Won't Do"];
const orderIdx = (s: string) => { const i = TICKET_ORDER.indexOf(s); return i === -1 ? TICKET_ORDER.length : i; };

function dueChip(due: string | null) {
  if (!due) return null;
  const d = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  if (Number.isNaN(d)) return null;
  if (d < 0) return <span className="due far">overdue</span>;
  const cls = d <= 2 ? 'soon' : d <= 6 ? 'mid' : 'far';
  return <span className={`due ${cls}`}>due {d}d</span>;
}

export function QueueTable({ tickets, basePath = '/tickets' }: { tickets: QueueTicket[]; basePath?: string }) {
  const router = useRouter();
  const [sel, setSel] = useState<Record<Dim, string>>({
    prioStatus: '', ticketStatus: '', eventType: '', assetType: '', typeOfRequest: '',
  });

  const options = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, uniq(tickets, f.key)])) as Record<Dim, string[]>,
    [tickets],
  );
  const rows = useMemo(
    () => tickets.filter((t) => (Object.keys(sel) as Dim[]).every((k) => !sel[k] || t[k] === sel[k])),
    [tickets, sel],
  );
  const load = useMemo(() => loadMap(tickets), [tickets]);
  const funnel = useMemo(() => {
    const scoped = tickets.filter((t) =>
      FILTERS.every((f) => !sel[f.key] || t[f.key] === sel[f.key]),
    );
    const counts = new Map<string, number>();
    for (const t of scoped) { const s = t.ticketStatus; if (s) counts.set(s, (counts.get(s) ?? 0) + 1); }
    return [...counts.entries()].sort((a, b) => orderIdx(a[0]) - orderIdx(b[0])).map(([status, count]) => ({ status, count }));
  }, [tickets, sel]);

  const activeFilters = (Object.keys(sel) as Dim[]).filter((k) => sel[k]).length;

  return (
    <div>
      {funnel.length > 0 && (
        <div className="sortchips" style={{ marginBottom: 14 }}>
          {funnel.map(({ status, count }) => (
            <button key={status} className={cn('chipbtn', sel.ticketStatus === status && 'on')}
              onClick={() => setSel((s) => ({ ...s, ticketStatus: s.ticketStatus === status ? '' : status }))}>
              <b style={{ fontVariantNumeric: 'tabular-nums' }}>{count}</b> {status}
            </button>
          ))}
        </div>
      )}

      <div className="filters">
        <span className="flab">Filter</span>
        {FILTERS.map((f) => (
          <select key={f.key} value={sel[f.key]} onChange={(e) => setSel((s) => ({ ...s, [f.key]: e.target.value }))}>
            <option value="">{f.label}</option>
            {options[f.key].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        {activeFilters > 0 && (
          <button className="btn sm ghost" onClick={() => setSel({ prioStatus: '', ticketStatus: '', eventType: '', assetType: '', typeOfRequest: '' })}>
            Clear ({activeFilters})
          </button>
        )}
        <span className="subtle" style={{ marginLeft: 'auto', fontSize: 12 }}>{rows.length} of {tickets.length}</span>
      </div>

      <div className="tw"><div className="tscroll"><table className="list">
        <thead><tr>
          <th>Title</th><th>Priority</th><th>Assigned</th><th>Ticket status</th><th>Priority status</th>
        </tr></thead>
        <tbody>
          {rows.map((t) => {
            const r = riskOf(t, load);
            return (
            <tr key={t.id} className={cn(!t.assignee && 'attn')} onClick={() => router.push(`${basePath}/${t.id}`)}>
              <td>
                <div className="t-title">{t.title}</div>
                <div className="t-meta">
                  <TierBadge event={t.eventType} /> <span>{t.assetType ?? '—'}</span>
                  {r.level && (
                    <span className={`risk ${r.level}`} title={r.why.join(' · ')}>
                      <Icon name="clock" size={11} /> {r.level === 'high' ? 'at risk' : 'watch'}
                    </span>
                  )}
                </div>
              </td>
              <td style={{ width: 120 }}>
                <span className="score">{t.queueRank ?? t.priorityScore ?? '—'}</span> {dueChip(t.dueDate)}
              </td>
              <td style={{ width: 150 }}>{t.assignee ?? <span className="subtle">Unassigned</span>}</td>
              <td style={{ width: 130 }}><TicketStatusBadge status={t.ticketStatus} /></td>
              <td style={{ width: 150 }}><PrioStatusBadge status={t.prioStatus} /></td>
            </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan={5} className="empty">No requests match these filters.</td></tr>}
        </tbody>
      </table></div></div>
    </div>
  );
}
