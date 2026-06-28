import { Suspense } from 'react';
import { AppShell } from '@/components/ui/AppShell';
import { getQueueTickets } from '@/lib/tickets/data';
import { QueueTable } from '@/components/tickets/QueueTable';
import { TableSkeleton } from '@/components/ui/Skeletons';

export const dynamic = 'force-dynamic';

async function TicketsBody() {
  const tickets = await getQueueTickets();
  return <QueueTable tickets={tickets} storageKey="all-queue" />;
}

export default function TicketsPage() {
  return (
    <AppShell title="Creative Queue" subtitle="ordered by priority">
      <Suspense fallback={<TableSkeleton />}>
        <TicketsBody />
      </Suspense>
    </AppShell>
  );
}
