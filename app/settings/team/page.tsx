import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/ui/AppShell';
import { TeamRolesEditor, type TeamEmployee } from '@/components/settings/TeamRolesEditor';
import { listAllEmployeeRecords } from '@/lib/repositories/employee.repository';
import { getAdminAccess } from '@/lib/admin/access';
import { ROLES, ROLE_DESCRIPTIONS, homeRouteForRoles } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export default async function TeamRolesPage() {
  const access = await getAdminAccess();
  if (!access.isAdmin) redirect(homeRouteForRoles(access.roles)); // admin-only surface
  const employees = await listAllEmployeeRecords();

  const rows: TeamEmployee[] = employees.map((e) => ({
    id: e.id,
    name: e.name,
    email: e.email,
    active: e.active,
    roles: e.roles,
    division: e.division,
    team: e.team,
  }));

  // Division filter options (active people surface first via the repo's sort).
  const divisions = Array.from(new Set(rows.map((r) => r.division).filter((d): d is string => !!d))).sort();
  // Default the filter to the Creatives division when present — that's the team we manage.
  const defaultDivision = divisions.find((d) => /creativ/i.test(d)) ?? 'All';

  return (
    <AppShell
      title="Admin panel"
      subtitle="Assign app roles — editors, managers, approvers, admins, and more. Admins can edit clip rules and manage roles."
    >
      <Link href="/settings/clip-rules" className="btn ghost sm" style={{ textDecoration: 'none', marginBottom: 14 }}>Clip rules →</Link>
      <div>
        <TeamRolesEditor
          employees={rows}
          allRoles={ROLES}
          roleDescriptions={ROLE_DESCRIPTIONS}
          divisions={divisions}
          defaultDivision={defaultDivision}
          canEdit={access.isAdmin}
        />
      </div>
    </AppShell>
  );
}
