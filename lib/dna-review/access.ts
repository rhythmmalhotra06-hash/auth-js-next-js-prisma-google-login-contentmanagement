// DNA review permission — reuses the exact computation already in
// app/settings/asset-types/page.tsx (isManager) plus isFounder() (the same Executive/CEO
// check lib/studio/guard.ts uses for Studio access). No new permission scheme. Used both
// to gate dismissing a `flag` finding / overriding a missing review, and to gate
// approving a proposed DnaReviewRule in Settings.

import { prisma } from '@/lib/prisma';
import { getAdminAccess } from '@/lib/admin/access';
import { getEmployeeForSession } from '@/lib/employee';
import { hasRole, isFounder } from '@/lib/roles';

export interface DnaAccess {
  email: string | null;
  canGovern: boolean; // can dismiss a flag / override a missing review / approve a rule for this asset type
}

/** Team-lead recIds for one asset type (by PG uuid), read straight from the Postgres
 *  mirror — no Airtable round-trip needed for a permission check. */
async function assetTypeTeamLeadIds(assetTypeId: string): Promise<string[]> {
  const rows = await prisma.assetTypeTeamLead.findMany({
    where: { assetTypeId },
    select: { employee: { select: { airtableId: true } } },
  });
  return rows.map((r) => r.employee.airtableId).filter((x): x is string => !!x);
}

/** Asset-type-scoped DNA governance check: admin, manager/approver, founder/exec, or the
 *  asset type's own team lead (never the assigned editor of the ticket in question — that
 *  check happens at the call site, since this function has no notion of "assignee").
 *  `assetTypeId` is the Postgres uuid (Ticket.assetTypeId / AssetType.id). */
export async function getDnaAccessForAssetType(assetTypeId: string | null): Promise<DnaAccess> {
  const [access, employee] = await Promise.all([getAdminAccess(), getEmployeeForSession()]);
  const isManager = access.isAdmin || hasRole(access.roles, 'Manager') || hasRole(access.roles, 'Approver');
  let teamLeadOfThis = false;
  if (!isManager && !isFounder(access.roles) && employee && assetTypeId) {
    const leadIds = await assetTypeTeamLeadIds(assetTypeId);
    teamLeadOfThis = leadIds.includes(employee.id);
  }
  return { email: access.email, canGovern: isManager || isFounder(access.roles) || teamLeadOfThis };
}
