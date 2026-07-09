import { redirect } from 'next/navigation';
import { getAdminAccess } from '@/lib/admin/access';
import { isFounder, homeRouteForRoles } from '@/lib/roles';
import { isStudioAllowlisted } from '@/lib/studio/access';

/** Gate every Studio route to the founder (Executive / CEO) + admins + the studio allowlist
 *  (named people like Vishen and Titus — see lib/studio/access.ts). */
export async function requireStudioAccess(): Promise<void> {
  const { roles, isAdmin, email } = await getAdminAccess();
  if (!isAdmin && !isFounder(roles) && !isStudioAllowlisted(email)) redirect(homeRouteForRoles(roles));
}
