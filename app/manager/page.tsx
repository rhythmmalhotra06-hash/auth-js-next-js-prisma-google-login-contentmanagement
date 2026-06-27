import { AppShell } from '@/components/ui/AppShell';
import { getQueueTickets } from '@/lib/tickets/data';
import { QueueTable } from '@/components/tickets/QueueTable';
import { ApprovedClipsPanel } from '@/components/clips/ApprovedClipsPanel';
import { listClipsByStatus, listMediaSources } from '@/lib/media/repository';
import { getIntakeReferenceData } from '@/lib/intake/data';
import { guardRoute } from '@/lib/auth/route-guard';

export const dynamic = 'force-dynamic';

export default async function ManagerPage() {
  await guardRoute('/manager');
  const [tickets, approvedRes, sourcesRes, reference] = await Promise.all([
    getQueueTickets(),
    listClipsByStatus('Approved'),
    listMediaSources(100),
    getIntakeReferenceData(),
  ]);
  const approved = approvedRes.ok ? approvedRes.data : [];
  const sources = sourcesRes.ok ? sourcesRes.data : [];
  const sourceNames: Record<string, string> = Object.fromEntries(
    sources.map((s) => [s.id, s.title || s.sourceUrl || 'Untitled source']),
  );
  const sourceUrls: Record<string, string> = Object.fromEntries(
    sources.filter((s) => s.sourceUrl).map((s) => [s.id, s.sourceUrl as string]),
  );

  return (
    <AppShell
      title="Manager — Prioritization Queue"
      subtitle={`${tickets.length} request${tickets.length === 1 ? '' : 's'} · all teams · ordered by priority score`}
    >
      <ApprovedClipsPanel approved={approved} sourceNames={sourceNames} sourceUrls={sourceUrls} reference={reference} />
      <QueueTable tickets={tickets} />
    </AppShell>
  );
}
