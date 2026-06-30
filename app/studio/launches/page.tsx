import { AppShell } from '@/components/ui/AppShell';
import { BackLink } from '@/components/studio/BackLink';
import { QueueTable } from '@/components/tickets/QueueTable';
import { requireStudioAccess } from '@/lib/studio/guard';
import { loadStudio } from '@/lib/studio/data';

export const dynamic = 'force-dynamic';

export default async function LaunchesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStudioAccess();
  const data = await loadStudio();
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const initialFilters = {
    ticketStatus: pick('ticketStatus'),
    prioStatus: pick('prioStatus'),
    eventType: pick('eventType'),
    assetType: pick('assetType'),
    officialCalendar: pick('officialCalendar'),
    typeOfRequest: pick('typeOfRequest'),
  };

  return (
    <AppShell title="Launches" subtitle="Everything in flight — filter by event type, asset type and more">
      <BackLink />
      <QueueTable tickets={data.active} basePath="/tickets" storageKey="studio-launches" scoringConfig={data.scoringConfig} initialFilters={initialFilters} />
    </AppShell>
  );
}
