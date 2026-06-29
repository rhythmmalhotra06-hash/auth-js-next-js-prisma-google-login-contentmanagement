import { getAdminAccess } from '@/lib/admin/access';

// Scoring/capacity config is gated by the same Admin role as the other admin
// surfaces (see lib/admin/access.ts). Roles are managed at /settings/team.
export interface ScoringConfigAccess {
  email: string | null;
  canEdit: boolean;
}

export async function getScoringConfigAccess(): Promise<ScoringConfigAccess> {
  const { email, isAdmin } = await getAdminAccess();
  return { email, canEdit: isAdmin };
}
