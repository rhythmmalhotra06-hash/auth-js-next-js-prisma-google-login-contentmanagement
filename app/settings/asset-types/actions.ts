'use server';

import { revalidatePath } from 'next/cache';
import { getAdminAccess } from '@/lib/admin/access';
import { getEmployeeForSession } from '@/lib/employee';
import { getAssetTypeLeadIds, updateAssetTypeDna } from '@/lib/asset-types/repository';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Save DNA for one asset type (E9.7). Authorized for admins (any asset type) and the
 * asset type's team lead (their own only) — re-checked server-side against the live
 * team-lead links, never trusting the client.
 */
export async function saveAssetTypeDna(
  recId: string,
  requirements: string,
  feedbackStandards: string,
): Promise<ActionResult> {
  if (!recId) return { ok: false, error: 'Missing asset type' };

  const [access, employee] = await Promise.all([getAdminAccess(), getEmployeeForSession()]);
  let allowed = access.isAdmin;
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
