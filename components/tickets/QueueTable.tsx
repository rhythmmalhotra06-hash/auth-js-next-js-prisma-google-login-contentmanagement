'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { TicketStatusBadge, PrioStatusBadge } from '@/components/ui/Badge';
import type { QueueTicket } from '@/lib/tickets/data';

// Filterable queue table. Mandated first five columns (CLAUDE.md §7):
// Title · Priority · Assigned · Ticket Status · Priority Status. Filters across
// Priority Status, Ticket Status, Event Type, Asset Type, Type of Request.
// Rows click through to the ticket record.

type Dim = 'prioStatus' | 'ticketStatus' | 'eventType' | 'assetType' | 'typeOfRequest';
const FILTERS: { key: Dim; label: string }[] = [
  { key: 'prioStatus', label: 'Priority Status' },
  { key: 'ticketStatus', label: 'Ticket Status' },
  { key: 'eventType', label: 'Event Type' },
  { key: 'assetType', label: 'Asset Type' },
  { key: 'typeOfRequest', label: 'Type of Request' },
];

const uniq = (rows: QueueTicket[], key: Dim) =>
  [...new Set(rows.map((r) => r[key]).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));

export function QueueTable({ tickets }: { tickets: QueueTicket[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<Record<Dim, string>>({
    prioStatus: '', ticketStatus: '', eventType: '', assetType: '', typeOfRequest: '',
  });

  const options = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, uniq(tickets, f.key)])) as Record<Dim, string[]>,
    [tickets],
  );

  const rows = useMemo(
    () => tickets.filter((t) => FILTERS.every((f) => !sel[f.key] || t[f.key] === sel[f.key])),
    [tickets, sel],
  );

  const activeFilters = FILTERS.filter((f) => sel[f.key]).length;

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <select
            key={f.key}
            value={sel[f.key]}
            onChange={(e) => setSel((s) => ({ ...s, [f.key]: e.target.value }))}
            className={cn(
              'h-9 rounded-[8px] border bg-surface px-2.5 text-sm outline-none focus-visible:shadow-[var(--mv-shadow-focus)]',
              sel[f.key] ? 'border-brand text-brand-content' : 'border-border-default text-text-muted',
            )}
          >
            <option value="">{f.label}: All</option>
            {options[f.key].map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        {activeFilters > 0 && (
          <button
            onClick={() => setSel({ prioStatus: '', ticketStatus: '', eventType: '', assetType: '', typeOfRequest: '' })}
            className="h-9 rounded-[8px] px-2.5 text-sm font-medium text-text-muted hover:text-text"
          >
            Clear ({activeFilters})
          </button>
        )}
        <span className="ml-auto text-[12.5px] text-text-subtle tabular-nums">{rows.length} of {tickets.length}</span>
      </div>

      <div className="overflow-x-auto rounded-[12px] border border-border-default bg-surface shadow-[var(--mv-shadow-light)]">
        <table className="w-full text-sm">
          <thead className="text-left text-[10.5px] uppercase tracking-wide text-text-subtle">
            <tr className="border-b border-border-default">
              <th className="px-4 py-2.5">Title</th>
              <th className="px-4 py-2.5 text-right">Priority</th>
              <th className="px-4 py-2.5">Assigned</th>
              <th className="px-4 py-2.5">Ticket Status</th>
              <th className="px-4 py-2.5">Priority Status</th>
              <th className="px-4 py-2.5">Event</th>
              <th className="px-4 py-2.5">Asset</th>
              <th className="px-4 py-2.5">Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr
                key={t.id}
                onClick={() => router.push(`/tickets/${t.id}`)}
                className="cursor-pointer border-b border-border-muted last:border-0 hover:bg-bg-subtle"
              >
                <td className="px-4 py-2.5 font-medium text-text">{t.title}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-text-muted">{t.queueRank ?? t.priorityScore ?? '—'}</td>
                <td className="px-4 py-2.5 text-text-muted">{t.assignee ?? '—'}</td>
                <td className="px-4 py-2.5"><TicketStatusBadge status={t.ticketStatus} /></td>
                <td className="px-4 py-2.5"><PrioStatusBadge status={t.prioStatus} /></td>
                <td className="px-4 py-2.5 text-text-muted">{t.eventType ?? '—'}</td>
                <td className="px-4 py-2.5 text-text-muted">{t.assetType ?? '—'}</td>
                <td className="px-4 py-2.5 text-text-muted">{t.typeOfRequest ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-text-subtle">No tickets match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
