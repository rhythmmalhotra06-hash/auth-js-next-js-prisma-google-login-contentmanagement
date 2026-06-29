import { notFound } from 'next/navigation';
import { AppShell } from '@/components/ui/AppShell';
import { BackLink } from '@/components/studio/BackLink';
import { DrillHero } from '@/components/studio/DrillHero';
import { QueueTable } from '@/components/tickets/QueueTable';
import { requireStudioAccess } from '@/lib/studio/guard';
import { loadStudio, launchTickets } from '@/lib/studio/data';

export const dynamic = 'force-dynamic';

export default async function LaunchDrillPage({ params }: { params: Promise<{ event: string }> }) {
  await requireStudioAccess();
  const { event } = await params;
  const data = await loadStudio();
  const { launch, tickets } = launchTickets(event, data.active, data.recentShipped);
  if (!launch) notFound();

  return (
    <AppShell title={launch.event} subtitle="Asset-by-asset status — where each ticket is, and who's on it">
      <BackLink href="/studio/launches" label="Back to launches" />
      <DrillHero launch={launch} />
      <div style={{ marginTop: 18 }}>
        <QueueTable tickets={tickets} basePath="/tickets" storageKey="studio-launch" scoringConfig={data.scoringConfig} />
      </div>
    </AppShell>
  );
}
