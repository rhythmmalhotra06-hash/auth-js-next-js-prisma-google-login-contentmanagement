import { AppShell } from '@/components/ui/AppShell';
import { getQueueTickets } from '@/lib/tickets/data';
import { QueueTable } from '@/components/tickets/QueueTable';
import { ApprovedClipsPanel } from '@/components/clips/ApprovedClipsPanel';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { FunnelCapacity } from '@/components/ui/FunnelCapacity';
import { Icon } from '@/components/ui/Icon';
import { listClipsByStatus, listMediaSources } from '@/lib/media/repository';
import { getIntakeReferenceData } from '@/lib/intake/data';
import { guardRoute } from '@/lib/auth/route-guard';

export const dynamic = 'force-dynamic';

const days = (due: string | null) => (due ? Math.ceil((new Date(due).getTime() - Date.now()) / 86400000) : null);

export default async function ManagerPage() {
  await guardRoute('/manager');
  const [tickets, approvedRes, sourcesRes, reference] = await Promise.all([
    getQueueTickets(),
    listClipsByStatus('Approved'),
    listMediaSources(100),
    getIntakeReferenceData(),
  ]);
  const unassigned = tickets.filter((t) => !t.assignee).length;
  const dueSoon = tickets.filter((t) => { const d = days(t.dueDate); return d != null && d >= 0 && d <= 3; }).length;
  const inReview = tickets.filter((t) => t.ticketStatus === 'Review').length;
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
      <KpiGrid>
        <Kpi label="In queue" value={tickets.length} sub="active requests" i={0} />
        <Kpi tone="alert" icon={<Icon name="user" size={13} />} label="Unassigned" value={unassigned} sub="need an editor" i={1} />
        <Kpi tone="danger" icon={<Icon name="clock" size={13} />} label="Due ≤ 3 days" value={dueSoon} sub="at risk" i={2} />
        <Kpi label="In review" value={inReview} sub="awaiting sign-off" i={3} />
      </KpiGrid>
      <FunnelCapacity tickets={tickets} />
      <ApprovedClipsPanel approved={approved} sourceNames={sourceNames} sourceUrls={sourceUrls} reference={reference} />
      <QueueTable tickets={tickets} />
    </AppShell>
  );
}
