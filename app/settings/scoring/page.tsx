import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/ui/AppShell';
import { ScoringConfigEditor, type PersonRow } from '@/components/settings/ScoringConfigEditor';
import { getAdminAccess } from '@/lib/admin/access';
import { homeRouteForRoles } from '@/lib/roles';
import { getScoringConfig, listGlobalRows, listEventTypeRows, listAssetTypeRows } from '@/lib/scoring-config/repository';
import { getEligibleAssignees } from '@/lib/tickets/data';

export const dynamic = 'force-dynamic';

export default async function ScoringConfigPage() {
  const access = await getAdminAccess();
  if (!access.isAdmin) redirect(homeRouteForRoles(access.roles)); // admin-only surface

  const [cfg, globals, eventTypes, assetTypes, assignees] = await Promise.all([
    getScoringConfig(),
    listGlobalRows(),
    listEventTypeRows(),
    listAssetTypeRows(),
    getEligibleAssignees(),
  ]);

  const people: PersonRow[] = assignees.map((a) => ({
    id: a.id,
    name: a.name,
    group: a.group,
    capacity: a.name in cfg.capacityByName ? cfg.capacityByName[a.name] : null,
  }));

  return (
    <AppShell
      title="Capacity & scoring"
      subtitle="Tune how full editors get and how the queue is prioritized. Defaults match today's behaviour; changes are live (priority weights need a recompute)."
    >
      <Link href="/settings/team" className="btn ghost sm" style={{ textDecoration: 'none', marginBottom: 14 }}>← Admin panel</Link>
      <ScoringConfigEditor
        globals={globals.ok ? globals.data : []}
        eventTypes={eventTypes.ok ? eventTypes.data : []}
        assetTypes={assetTypes.ok ? assetTypes.data : []}
        people={people}
        defaultCapacity={cfg.defaultCapacity}
        canEdit={access.isAdmin}
      />
    </AppShell>
  );
}
