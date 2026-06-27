import { AppShell } from '@/components/ui/AppShell';
import { getQueueTickets } from '@/lib/tickets/data';
import { QueueTable } from '@/components/tickets/QueueTable';

export const dynamic = 'force-dynamic';

export default async function TicketsPage() {
  const tickets = await getQueueTickets();

  return (
    <AppShell
      title="Creative Queue"
      subtitle={`${tickets.length} request${tickets.length === 1 ? '' : 's'} · ordered by priority`}
    >
      <QueueTable tickets={tickets} />
    </AppShell>
  );
}
