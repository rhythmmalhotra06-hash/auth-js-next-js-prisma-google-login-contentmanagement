import { notFound } from 'next/navigation';
import { AppShell } from '@/components/ui/AppShell';
import { BackLink } from '@/components/studio/BackLink';
import { DrillHero } from '@/components/studio/DrillHero';
import { LaunchDrillTable, type DrillRow } from '@/components/studio/LaunchDrillTable';
import { requireStudioAccess } from '@/lib/studio/guard';
import { loadStudio, launchTickets, statusBucket } from '@/lib/studio/data';

export const dynamic = 'force-dynamic';

export default async function LaunchDrillPage({ params }: { params: Promise<{ event: string }> }) {
  await requireStudioAccess();
  const { event } = await params;
  const data = await loadStudio();
  const { launch, tickets } = launchTickets(event, data.active, data.recentShipped);
  if (!launch) notFound();

  const rows: DrillRow[] = tickets.map((t) => ({
    id: t.id,
    title: t.title,
    sub: [t.assetType, t.assignee].filter(Boolean).join(' · ') || '—',
    rank: t.queueRank,
    status: statusBucket(t.ticketStatus),
  }));

  return (
    <AppShell title={launch.event} subtitle="Asset-by-asset status — where each ticket is, and who's on it">
      <BackLink href="/studio/launches" label="Back to launches" />
      <DrillHero launch={launch} />
      <div style={{ marginTop: 18 }}>
        <LaunchDrillTable rows={rows} />
      </div>
    </AppShell>
  );
}
