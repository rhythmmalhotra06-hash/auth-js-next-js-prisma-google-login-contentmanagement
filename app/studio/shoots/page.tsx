import { AppShell } from '@/components/ui/AppShell';
import { BackLink } from '@/components/studio/BackLink';
import { ShootSignOff } from '@/components/studio/ShootSignOff';
import { FounderShootsGrid } from '@/components/studio/FounderShootsGrid';
import { requireStudioAccess } from '@/lib/studio/guard';
import { loadStudio, getPendingShoots, toShootSignOffItem } from '@/lib/studio/data';

export const dynamic = 'force-dynamic';

// Founder-only shoots surface: what needs Vishen's sign-off on top, every shoot below.
// Distinct from the team /shoots board.
export default async function StudioShootsPage() {
  await requireStudioAccess();
  const data = await loadStudio();
  const pending = getPendingShoots(data.shoots).map(toShootSignOffItem);

  return (
    <AppShell title="Shoots" subtitle="Approve filming requests, and see every shoot">
      <BackLink />
      <ShootSignOff items={pending} showSeeAll={false} />
      <div className="sec-head" style={{ marginTop: 20 }}>
        <h3>All shoots</h3>
        <span className="hint">{data.shoots.length} total</span>
      </div>
      <FounderShootsGrid shoots={data.shoots} />
    </AppShell>
  );
}
