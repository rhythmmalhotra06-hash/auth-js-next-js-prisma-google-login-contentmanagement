import { redirect } from 'next/navigation';
import { getAdminAccess } from '@/lib/admin/access';
import { isMarketingDivision, homeRouteForRoles } from '@/lib/roles';

/**
 * Gate every Social route to the Marketing division + admins. Managers/approvers/
 * execs may also open it (oversight) — they see everything anyway. Everyone else is
 * bounced to their own home surface. (Mirrors lib/studio/guard.ts.)
 */
export async function requireSocialAccess(): Promise<void> {
  const { roles, isAdmin, division } = await getAdminAccess();
  const oversight =
    roles.includes('Manager') || roles.includes('Approver') || roles.includes('Executive / CEO');
  if (!isAdmin && !isMarketingDivision(division) && !oversight) redirect(homeRouteForRoles(roles));
}
