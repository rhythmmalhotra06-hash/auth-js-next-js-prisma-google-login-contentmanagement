import { AppShell } from '@/components/ui/AppShell';
import { getQueueTickets } from '@/lib/tickets/data';
import { QueueTable } from '@/components/tickets/QueueTable';
import { ApprovedClipsPanel } from '@/components/clips/ApprovedClipsPanel';
import { listClipsByStatus, listMediaSources } from '@/lib/media/repository';

export const dynamic = 'force-dynamic';

export default async function ManagerPage() {
  const [tickets, approvedRes, sourcesRes] = await Promise.all([
    getQueueTickets(),
    listClipsByStatus('Approved'),
    listMediaSources(100),
  ]);
  const approved = approvedRes.ok ? approvedRes.data : [];
  const sourceNames: Record<string, string> = Object.fromEntries(
    (sourcesRes.ok ? sourcesRes.data : []).map((s) => [s.id, s.title || s.sourceUrl || 'Untitled source']),
  );

  return (
    <AppShell
      title="Manager — Prioritization Queue"
      subtitle={`${tickets.length} request${tickets.length === 1 ? '' : 's'} · all teams · ordered by priority score`}
    >
      <ApprovedClipsPanel approved={approved} sourceNames={sourceNames} />
      <QueueTable tickets={tickets} />
    </AppShell>
  );
}
