import { auth } from '@/lib/auth';
import { getEmployeeForSession } from '@/lib/employee';
import { ADMIN_ROLE, hasRole } from '@/lib/roles';

// Admin access = the signed-in user's Employees record carries the 'Admin' role.
// A bootstrap list is always treated as Admin so we can never be locked out before
// any record is tagged (seed + optional ADMIN_BOOTSTRAP_EMAILS env override).
const BOOTSTRAP_ADMINS = ['rhythm@mindvalley.com'];

function bootstrapEmails(): string[] {
  const env = (process.env.ADMIN_BOOTSTRAP_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...BOOTSTRAP_ADMINS.map((e) => e.toLowerCase()), ...env];
}

export interface AdminAccess {
  email: string | null;
  isAdmin: boolean;
  roles: string[];
  division: string | null; // org division from the Employees record (e.g. "Marketing")
}

export async function getAdminAccess(): Promise<AdminAccess> {
  const session = await auth();

  // Dev-login override: roles come from the local dev login, not Airtable. Inert
  // in production (devRoles is never set on the session there — see auth.config).
  if (process.env.NODE_ENV !== 'production') {
    const devRoles = (session as { devRoles?: string } | null)?.devRoles;
    if (devRoles !== undefined) {
      const roles = devRoles.split(',').map((s) => s.trim()).filter(Boolean);
      const devDivision = (session as { devDivision?: string } | null)?.devDivision ?? null;
      return { email: session?.user?.email ?? null, isAdmin: roles.includes(ADMIN_ROLE), roles, division: devDivision };
    }
  }

  const employee = await getEmployeeForSession();
  const email = employee?.email ?? session?.user?.email ?? null;
  const byRole = hasRole(employee?.roles, ADMIN_ROLE);
  const byBootstrap = !!email && bootstrapEmails().includes(email.toLowerCase());
  return { email, isAdmin: byRole || byBootstrap, roles: employee?.roles ?? [], division: employee?.division ?? null };
}
