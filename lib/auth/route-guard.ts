import { redirect } from 'next/navigation';
import { getAdminAccess } from '@/lib/admin/access';
import { canAccessRoute, homeRouteForRoles, type GatedRoute } from '@/lib/roles';

// Server-component guard for the role surfaces. Call at the top of a page:
//   await guardRoute('/manager');
// Admins pass anywhere; untagged users are treated as Stakeholder; a tagged user
// without the route's role is bounced to their own home surface. Uses getAdminAccess
// so the dev-login role override is honored consistently with the nav.
export async function guardRoute(route: GatedRoute): Promise<void> {
  const { roles, isAdmin } = await getAdminAccess();
  if (isAdmin) return;
  if (!canAccessRoute(roles, route)) {
    redirect(homeRouteForRoles(roles));
  }
}
