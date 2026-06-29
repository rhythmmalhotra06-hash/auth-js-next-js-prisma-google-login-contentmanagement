import { AppShell } from '@/components/ui/AppShell';
import { BackLink } from '@/components/studio/BackLink';
import { ShippedTable } from '@/components/studio/ShippedTable';
import { requireStudioAccess } from '@/lib/studio/guard';
import { loadStudio } from '@/lib/studio/data';

export const dynamic = 'force-dynamic';

export default async function ShippedPage() {
  await requireStudioAccess();
  const data = await loadStudio();

  return (
    <AppShell title="Recently shipped" subtitle="Delivered work, newest first">
      <BackLink />
      <ShippedTable tickets={data.recentShipped} />
    </AppShell>
  );
}
