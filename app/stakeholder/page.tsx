import { AppNav } from '@/components/AppNav';
import { getQueueTickets } from '@/lib/tickets/data';
import { TicketTable } from '@/components/tickets/TicketTable';

export const dynamic = 'force-dynamic';

// Read-only view — the free, unlimited stakeholder/agency surface (Ziflow pattern).
// Distribution links + live performance metrics arrive with the Performance Loop (E7).
export default async function StakeholderPage() {
  const tickets = await getQueueTickets();
  return (
    <main className="min-h-screen bg-neutral-50 py-10">
      <div className="mx-auto max-w-6xl px-4">
        <AppNav active="Stakeholder" />
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-neutral-900">Stakeholder — Status</h1>
          <p className="mt-1 text-sm text-neutral-500">Read-only · {tickets.length} request{tickets.length === 1 ? '' : 's'} · performance metrics arrive with E7</p>
        </div>
        <TicketTable tickets={tickets} readOnly />
      </div>
    </main>
  );
}
