import Link from 'next/link';
import { getQueueTickets } from '@/lib/tickets/data';
import { TicketTable } from '@/components/tickets/TicketTable';

export const dynamic = 'force-dynamic';

export default async function TicketsPage() {
  const tickets = await getQueueTickets();

  return (
    <main className="min-h-screen bg-neutral-50 py-10">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Creative Queue</h1>
            <p className="mt-1 text-sm text-neutral-500">{tickets.length} request{tickets.length === 1 ? '' : 's'} · ordered by priority score (unscored until E4)</p>
          </div>
          <Link href="/intake" className="rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ backgroundColor: '#572280' }}>
            + New request
          </Link>
        </div>
        <TicketTable tickets={tickets} />
      </div>
    </main>
  );
}
