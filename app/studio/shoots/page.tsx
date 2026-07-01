import { AppShell } from '@/components/ui/AppShell';
import { BackLink } from '@/components/studio/BackLink';
import { ShootSignOff } from '@/components/studio/ShootSignOff';
import { ShootsBoard } from '@/components/shoots/ShootsBoard';
import { requireStudioAccess } from '@/lib/studio/guard';
import { loadStudio, getPendingShoots, toShootSignOffItem } from '@/lib/studio/data';
import { getIntakeReferenceData } from '@/lib/intake/data';

export const dynamic = 'force-dynamic';

// Founder-only shoots surface: what needs Vishen's sign-off on top, every shoot below.
// The "All shoots" grid reuses the team board (filters / sortable columns / column menu).
export default async function StudioShootsPage() {
  await requireStudioAccess();
  const [data, ref] = await Promise.all([loadStudio(), getIntakeReferenceData()]);
  const pending = getPendingShoots(data.shoots).map(toShootSignOffItem);
  const employeeNames: Record<string, string> = Object.fromEntries(ref.employees.map((e) => [e.id, e.name]));

  return (
    <AppShell title="Shoots" subtitle="Approve filming requests, and see every shoot">
      <BackLink />
      <ShootSignOff items={pending} />
      <div className="sec-head" style={{ marginTop: 20 }}>
        <h3>All shoots</h3>
        <span className="hint">filter, sort and choose columns</span>
      </div>
      <ShootsBoard rows={data.shoots} employeeNames={employeeNames} />
    </AppShell>
  );
}
