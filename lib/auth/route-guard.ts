import { redirect } from 'next/navigation';
import { getEmployeeForSession } from '@/lib/employee';
import { canAccessRoute, homeRouteForRoles, type GatedRoute } from '@/lib/roles';

// Server-component guard for the role surfaces. Call at the top of a page:
//   await guardRoute('/manager');
// Untagged users (no Employees record or no roles) pass through unchanged; tagged
// users without the route's role are bounced to their own home surface.
export async function guardRoute(route: GatedRoute): Promise<void> {
  const employee = await getEmployeeForSession();
  const roles = employee?.roles;
  if (!canAccessRoute(roles, route)) {
    redirect(homeRouteForRoles(roles));
  }
}
