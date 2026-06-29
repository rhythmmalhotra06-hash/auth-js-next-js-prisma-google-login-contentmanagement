import { redirect } from 'next/navigation';
import { getAdminAccess } from '@/lib/admin/access';
import { isFounder, homeRouteForRoles } from '@/lib/roles';

/** Gate every Studio route to the founder + admins (mirrors app/studio/page.tsx). */
export async function requireStudioAccess(): Promise<void> {
  const { roles, isAdmin } = await getAdminAccess();
  if (!isAdmin && !isFounder(roles)) redirect(homeRouteForRoles(roles));
}
