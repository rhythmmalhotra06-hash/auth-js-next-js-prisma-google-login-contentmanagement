import type { QueueTicket } from '@/lib/tickets/data';

// The mandated standard: the first five columns are identical across ALL views —
// Title, Priority, Assigned, Ticket Status, Priority Status.

function Badge({ value, kind }: { value: string | null; kind: 'ticket' | 'prio' }) {
  if (!value) return <span className="text-neutral-400">—</span>;
  const cls = kind === 'prio' ? 'bg-[#572280]/10 text-[#572280]' : 'bg-neutral-100 text-neutral-700';
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{value}</span>;
}

export function TicketTable({ tickets }: { tickets: QueueTicket[] }) {
  if (tickets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
        No tickets yet. Submit one from the intake form.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            {/* Mandated first five columns */}
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Priority</th>
            <th className="px-4 py-3 font-medium">Assigned</th>
            <th className="px-4 py-3 font-medium">Ticket Status</th>
            <th className="px-4 py-3 font-medium">Priority Status</th>
            {/* Context columns */}
            <th className="px-4 py-3 font-medium">Event Type</th>
            <th className="px-4 py-3 font-medium">Asset Type</th>
            <th className="px-4 py-3 font-medium">Due</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((t) => (
            <tr key={t.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
              <td className="px-4 py-3 font-medium text-neutral-900">{t.title}</td>
              <td className="px-4 py-3 text-neutral-700">{t.priorityScore ?? <span className="text-neutral-400">unscored</span>}</td>
              <td className="px-4 py-3 text-neutral-700">{t.assignee ?? <span className="text-neutral-400">unassigned</span>}</td>
              <td className="px-4 py-3"><Badge value={t.ticketStatus} kind="ticket" /></td>
              <td className="px-4 py-3"><Badge value={t.prioStatus} kind="prio" /></td>
              <td className="px-4 py-3 text-neutral-600">{t.eventType ?? '—'}</td>
              <td className="px-4 py-3 text-neutral-600">{t.assetType ?? '—'}</td>
              <td className="px-4 py-3 text-neutral-600">{t.dueDate ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
