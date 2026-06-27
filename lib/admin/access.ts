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
}

export async function getAdminAccess(): Promise<AdminAccess> {
  const employee = await getEmployeeForSession();
  let email = employee?.email ?? null;
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  const byRole = hasRole(employee?.roles, ADMIN_ROLE);
  const byBootstrap = !!email && bootstrapEmails().includes(email.toLowerCase());
  return { email, isAdmin: byRole || byBootstrap };
}
