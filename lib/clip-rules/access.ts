import { getAdminAccess } from '@/lib/admin/access';

// Clip-rules editing is gated by the same Admin role as the rest of the admin
// surfaces (see lib/admin/access.ts). Roles are managed at /settings/team.
export interface ClipRulesAccess {
  email: string | null;
  canEdit: boolean;
}

export async function getClipRulesAccess(): Promise<ClipRulesAccess> {
  const { email, isAdmin } = await getAdminAccess();
  return { email, canEdit: isAdmin };
}
