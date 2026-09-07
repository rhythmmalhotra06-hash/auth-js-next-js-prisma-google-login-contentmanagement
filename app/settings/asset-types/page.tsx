import { redirect } from 'next/navigation';
import { AppShell } from '@/components/ui/AppShell';
import { AssetTypeEditor } from '@/components/settings/AssetTypeEditor';
import { getAdminAccess } from '@/lib/admin/access';
import { getEmployeeForSession } from '@/lib/employee';
import { hasRole, isFounder, homeRouteForRoles } from '@/lib/roles';
import { listAssetTypeDna } from '@/lib/asset-types/repository';
import { listDnaRulesForAssetTypes } from '@/lib/dna-review/repository';

export const dynamic = 'force-dynamic';

export default async function AssetTypeDnaPage() {
  const [access, employee, rowsRes] = await Promise.all([
    getAdminAccess(),
    getEmployeeForSession(),
    listAssetTypeDna(),
  ]);
  const rows = rowsRes.ok ? rowsRes.data : [];
  const rulesByAssetType = await listDnaRulesForAssetTypes(
    rows.map((r) => r.assetTypePgId).filter((id): id is string => !!id),
  );

  // Admins + managers get in for oversight; a team lead of any asset type gets in to
  // edit their own. Everyone else is bounced to their home surface.
  const isManager = access.isAdmin || hasRole(access.roles, 'Manager') || hasRole(access.roles, 'Approver');
  const teamLeadOfAny = !!employee && rows.some((r) => r.teamLeadIds.includes(employee.id));
  if (!isManager && !teamLeadOfAny) redirect(homeRouteForRoles(access.roles));

  return (
    <AppShell
      title="Asset types & DNA"
      subtitle="The creative DNA, requirements and feedback standards for each asset type. Admins edit all; team leads edit the asset types they lead."
    >
      <AssetTypeEditor
        rows={rows}
        myEmployeeId={employee?.id ?? null}
        isAdmin={access.isAdmin}
        // DNA-rule governance (E13) is broader than DNA-text edit rights: manager/approver
        // and founder/exec can approve/dismiss learned rules for oversight, matching
        // lib/dna-review/access.ts's server-side check — not just admin + team lead.
        canGovernDna={isManager || isFounder(access.roles)}
        dnaRulesByAssetType={Object.fromEntries(
          [...rulesByAssetType.entries()].map(([k, v]) => [
            k,
            v.map((r) => ({ id: r.id, statement: r.statement, rationale: r.rationale, active: r.active, source: r.source, note: r.note })),
          ]),
        )}
      />
    </AppShell>
  );
}
