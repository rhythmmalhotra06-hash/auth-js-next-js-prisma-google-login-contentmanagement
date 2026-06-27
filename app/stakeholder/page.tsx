import { AppShell } from '@/components/ui/AppShell';
import { getQueueTickets } from '@/lib/tickets/data';
import { QueueTable } from '@/components/tickets/QueueTable';

export const dynamic = 'force-dynamic';

// Read-only view — the free, unlimited stakeholder/agency surface (Ziflow pattern).
// Distribution links + live performance metrics arrive with the Performance Loop (E7).
export default async function StakeholderPage() {
  const tickets = await getQueueTickets();
  return (
    <AppShell
      title="Stakeholder — Status"
      subtitle={`Read-only · ${tickets.length} request${tickets.length === 1 ? '' : 's'} · performance metrics arrive with the Performance Loop`}
    >
      <QueueTable tickets={tickets} />
    </AppShell>
  );
}
