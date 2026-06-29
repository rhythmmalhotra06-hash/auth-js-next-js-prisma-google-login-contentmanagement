import { AppShell } from '@/components/ui/AppShell';
import { BackLink } from '@/components/studio/BackLink';
import { LaunchCard } from '@/components/studio/LaunchCard';
import { requireStudioAccess } from '@/lib/studio/guard';
import { loadStudio, getLaunches } from '@/lib/studio/data';

export const dynamic = 'force-dynamic';

export default async function LaunchesPage() {
  await requireStudioAccess();
  const data = await loadStudio();
  const launches = getLaunches(data.active, data.recentShipped);

  return (
    <AppShell title="Launches" subtitle={`Everything in flight, grouped by event · ${launches.length} active`}>
      <BackLink />
      {launches.length === 0
        ? <div className="empty">No active launches.</div>
        : launches.map((l) => <LaunchCard key={l.slug} launch={l} />)}
    </AppShell>
  );
}
