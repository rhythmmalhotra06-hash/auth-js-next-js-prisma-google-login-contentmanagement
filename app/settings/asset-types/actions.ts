'use server';

import { revalidatePath } from 'next/cache';
import { getAdminAccess } from '@/lib/admin/access';
import { hasRole, isFounder } from '@/lib/roles';
import { getEmployeeForSession } from '@/lib/employee';
import { getAssetTypeLeadIds, updateAssetTypeDna } from '@/lib/asset-types/repository';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Save DNA for one asset type (E9.7). Authorized for admins, managers/approvers and
 * founders/execs (any asset type), plus the asset type's team lead (their own only) —
 * re-checked server-side against the live team-lead links, never trusting the client.
 *
 * Managers were added 2026-09-08: Titus (role `Manager`, not `Admin`) could already
 * approve/dismiss learned DNA *rules* via app/settings/dna-actions.ts, which uses
 * getDnaAccessForAssetType().canGovern — but not edit DNA *text*, which checked
 * `isAdmin` only. Same role set both sides now.
 *
 * NOTE: `teamLeadIds` here actually resolves Airtable's "Sub Lead" field, not "Team Lead"
 * — field-map.ts maps `teamLeads` to fldwO5GJ7OUoeJHfL ("Sub Lead"), while the real
 * "Team Lead" (fld0cS6VU1olTKkMM) is unmapped and points at a different employees table.
 * That mismapping is tracked separately; granting managers is what unblocks the actual
 * team leads today.
 */
export async function saveAssetTypeDna(
  recId: string,
  requirements: string,
  feedbackStandards: string,
): Promise<ActionResult> {
  if (!recId) return { ok: false, error: 'Missing asset type' };

  const [access, employee] = await Promise.all([getAdminAccess(), getEmployeeForSession()]);
  let allowed =
    access.isAdmin ||
    hasRole(access.roles, 'Manager') ||
    hasRole(access.roles, 'Approver') ||
    isFounder(access.roles);
  if (!allowed && employee) {
    const leadIds = await getAssetTypeLeadIds(recId);
    allowed = leadIds.includes(employee.id);
  }
  if (!allowed) return { ok: false, error: 'You can only edit DNA for asset types you lead.' };

  const res = await updateAssetTypeDna(
    recId,
    { requirements: requirements.trim(), feedbackStandards: feedbackStandards.trim() },
    access.email,
  );
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidatePath('/settings/asset-types');
  return { ok: true };
}
