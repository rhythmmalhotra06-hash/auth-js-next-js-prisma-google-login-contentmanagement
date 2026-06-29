import { Suspense } from 'react';
import { AppShell } from '@/components/ui/AppShell';
import { getQueueTickets } from '@/lib/tickets/data';
import { getScoringConfig } from '@/lib/scoring-config/repository';
import { QueueTable } from '@/components/tickets/QueueTable';
import { ApprovedClipsSection } from '@/components/clips/ApprovedClipsSection';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { FunnelCapacity } from '@/components/ui/FunnelCapacity';
import { Icon } from '@/components/ui/Icon';
import { QueueSkeleton, CardSkeleton } from '@/components/ui/Skeletons';
import { guardRoute } from '@/lib/auth/route-guard';

export const dynamic = 'force-dynamic';

const days = (due: string | null) => (due ? Math.ceil((new Date(due).getTime() - Date.now()) / 86400000) : null);

async function ManagerBody() {
  const [tickets, cfg] = await Promise.all([getQueueTickets(), getScoringConfig()]);
  const unassigned = tickets.filter((t) => !t.assignee).length;
  const dueSoon = tickets.filter((t) => { const d = days(t.dueDate); return d != null && d >= 0 && d <= 3; }).length;
  const inReview = tickets.filter((t) => t.ticketStatus === 'Review').length;

  return (
    <>
      <KpiGrid>
        <Kpi label="In queue" value={tickets.length} sub="active requests" i={0} />
        <Kpi tone="alert" icon={<Icon name="user" size={13} />} label="Unassigned" value={unassigned} sub="need an editor" i={1} />
        <Kpi tone="danger" icon={<Icon name="clock" size={13} />} label="Due ≤ 3 days" value={dueSoon} sub="at risk" i={2} />
        <Kpi label="In review" value={inReview} sub="awaiting sign-off" i={3} />
      </KpiGrid>
      <FunnelCapacity tickets={tickets} cfg={cfg} />
      <Suspense fallback={<CardSkeleton />}>
        <ApprovedClipsSection />
      </Suspense>
      <QueueTable tickets={tickets} storageKey="manager-queue" scoringConfig={cfg} />
    </>
  );
}

export default async function ManagerPage() {
  await guardRoute('/manager');
  return (
    <AppShell
      title="Manager — Prioritization Queue"
      subtitle="all teams · ordered by priority score"
    >
      <Suspense fallback={<QueueSkeleton kpis={4} />}>
        <ManagerBody />
      </Suspense>
    </AppShell>
  );
}
