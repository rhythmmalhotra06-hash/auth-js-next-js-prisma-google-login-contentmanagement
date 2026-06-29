import { AppShell } from '@/components/ui/AppShell';
import { BackLink } from '@/components/studio/BackLink';
import { QueueTable } from '@/components/tickets/QueueTable';
import { requireStudioAccess } from '@/lib/studio/guard';
import { loadStudio } from '@/lib/studio/data';

export const dynamic = 'force-dynamic';

export default async function LaunchesPage() {
  await requireStudioAccess();
  const data = await loadStudio();

  return (
    <AppShell title="Launches" subtitle="Everything in flight — filter by event type, asset type and more">
      <BackLink />
      <QueueTable tickets={data.active} basePath="/tickets" storageKey="studio-launches" scoringConfig={data.scoringConfig} />
    </AppShell>
  );
}
