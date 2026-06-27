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
