'use server';

import { revalidatePath } from 'next/cache';
import { getAdminAccess } from '@/lib/admin/access';
import { updateEmployeeRoles } from '@/lib/repositories/employee.repository';
import { isRole } from '@/lib/roles';

export interface RolesResult {
  ok: boolean;
  error?: string;
}

/** Overwrite an employee's app roles. Admin-only. */
export async function setEmployeeRoles(employeeId: string, roles: string[]): Promise<RolesResult> {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return { ok: false, error: 'Only admins can change roles.' };

  // Drop anything not in the known role set so a stale client can't write garbage.
  const clean = Array.from(new Set(roles.filter(isRole)));

  const res = await updateEmployeeRoles(employeeId, clean);
  if (!res.ok) return { ok: false, error: res.error.message };

  revalidatePath('/settings/team');
  revalidatePath('/settings/clip-rules'); // admin grants/revokes affect clip-rules access too
  return { ok: true };
}
