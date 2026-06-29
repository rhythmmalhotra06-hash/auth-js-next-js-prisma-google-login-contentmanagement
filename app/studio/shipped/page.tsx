import { AppShell } from '@/components/ui/AppShell';
import { BackLink } from '@/components/studio/BackLink';
import { QueueTable } from '@/components/tickets/QueueTable';
import { requireStudioAccess } from '@/lib/studio/guard';
import { loadStudio } from '@/lib/studio/data';

export const dynamic = 'force-dynamic';

export default async function ShippedPage() {
  await requireStudioAccess();
  const data = await loadStudio();

  return (
    <AppShell title="Recently shipped" subtitle="Delivered work, newest first">
      <BackLink />
      <QueueTable tickets={data.recentShipped} basePath="/tickets" storageKey="studio-shipped" scoringConfig={data.scoringConfig} />
    </AppShell>
  );
}
