// Who can open the v2 surfaces while they are being tested.
//
// These pages carry real names beside real numbers — an editor's retention against their
// peers'. That is fine for the people who agreed to look at it and wrong as a thing the whole
// domain can stumble into, so /v2 is allowlisted rather than merely signed-in.
//
// Same shape as lib/studio/access.ts: a code default plus a comma-separated env override, so
// the list changes without a redeploy. On `main` this file gates nothing, because no /v2 route
// exists there — which is what makes merging the branch inert for the team.

import { auth } from '@/lib/auth';

const V2_ALLOWLIST = ['rhythm@mindvalley.com'];

function envAllowlist(): string[] {
  return (process.env.V2_ALLOWLIST_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isV2Allowlisted(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return V2_ALLOWLIST.includes(e) || envAllowlist().includes(e);
}

export interface V2Session {
  email: string;
  name: string | null;
}

/**
 * Returns the session for an allowlisted viewer, or null.
 *
 * Null rather than a redirect so each page can say *why* it is empty. A page that bounces you
 * to the sign-in screen you just came from teaches nobody anything.
 */
export async function getV2Session(): Promise<V2Session | null> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!isV2Allowlisted(email)) return null;
  return { email: email!, name: session?.user?.name ?? null };
}
