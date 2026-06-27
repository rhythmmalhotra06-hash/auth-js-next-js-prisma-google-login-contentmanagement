// App access/permission roles. Source of truth shared by the Employees "Roles"
// Airtable multi-select, the admin panel selector, and role-based gating.
// Keep this list in sync with the Airtable single-/multi-select options.

export const ROLES = [
  'Editor',
  'Designer',
  'Manager',
  'Approver',
  'Admin',
  'Executive / CEO',
  'Stakeholder',
  'Agency / External',
] as const;

export type Role = (typeof ROLES)[number];

/** Role that can manage other people's roles and edit clip rules / config. */
export const ADMIN_ROLE: Role = 'Admin';

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  Editor: 'Works the editor queue — updates ticket status, attaches raw/final assets.',
  Designer: 'Design-asset production — same queue/production surface as editors.',
  Manager: 'Prioritization board: assign/reassign, set priority status, approve, capacity.',
  Approver: 'Signs off at decision-lock stages (brand/legal/exec) before Published.',
  Admin: 'Manages roles and edits clip rules / system config.',
  'Executive / CEO': 'Read-across visibility — who made what and how it performed.',
  Stakeholder: 'Read-only status + performance, no editing.',
  'Agency / External': 'Free external reviewer — read/comment only, no editor seat.',
};

export function isRole(v: string | null | undefined): v is Role {
  return !!v && (ROLES as readonly string[]).includes(v);
}

export function hasRole(roles: readonly string[] | null | undefined, role: Role): boolean {
  return !!roles && roles.includes(role);
}

// ── Role-based routing ───────────────────────────────────────────────────────
// The three role surfaces and which roles may open each. Untagged users are NOT
// gated (rollout-safe — they keep the legacy open access until someone tags them);
// Admins can open everything.

export type GatedRoute = '/editor' | '/manager' | '/stakeholder';

const ROUTE_ROLES: Record<GatedRoute, Role[]> = {
  '/editor': ['Editor', 'Designer'],
  '/manager': ['Manager', 'Approver'],
  '/stakeholder': ['Stakeholder', 'Agency / External', 'Executive / CEO'],
};

// Anyone who signs in but hasn't been given an explicit role is treated as a
// Stakeholder — read-only status access. (Every @mindvalley.com account can sign
// in; production/management access is opt-in via the Admin panel.)
export function effectiveRoles(roles: readonly string[] | null | undefined): string[] {
  return roles && roles.length > 0 ? [...roles] : ['Stakeholder'];
}

export function canAccessRoute(roles: readonly string[] | null | undefined, route: GatedRoute): boolean {
  const r = effectiveRoles(roles);
  if (r.includes(ADMIN_ROLE)) return true; // admins see everything
  return ROUTE_ROLES[route].some((need) => r.includes(need));
}

/**
 * Whether a sidebar nav item should be shown. Admins and untagged users see
 * everything (rollout-safe). Otherwise: the three role surfaces follow
 * canAccessRoute; settings is admin-only; the internal production tools
 * (/vishen, /intake, /media) show only to production/management roles.
 */
export function canSeeNav(roles: readonly string[] | null | undefined, isAdmin: boolean, href: string): boolean {
  if (isAdmin) return true;
  const r = effectiveRoles(roles);
  switch (href) {
    case '/manager':
    case '/editor':
    case '/stakeholder':
      return canAccessRoute(r, href);
    case '/settings/clip-rules':
    case '/settings/team':
      return false; // admin-only (admins already returned true above)
    default:
      return canAccessRoute(r, '/editor') || canAccessRoute(r, '/manager');
  }
}

/** The surface a user lands on by default, based on their roles (untagged → Stakeholder). */
export function homeRouteForRoles(roles: readonly string[] | null | undefined): GatedRoute {
  const r = effectiveRoles(roles);
  if (r.includes('Editor') || r.includes('Designer')) {
    // Editors/designers land on their queue unless they're also a manager/approver.
    if (!(r.includes('Manager') || r.includes('Approver') || r.includes('Admin'))) return '/editor';
  }
  if (
    r.length > 0 &&
    !r.includes('Manager') &&
    !r.includes('Approver') &&
    !r.includes('Admin') &&
    (r.includes('Stakeholder') || r.includes('Agency / External') || r.includes('Executive / CEO'))
  ) {
    return '/stakeholder';
  }
  return '/manager'; // managers, approvers, admins, and the legacy untagged default
}
