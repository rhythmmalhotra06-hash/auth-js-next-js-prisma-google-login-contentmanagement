// Studio access allowlist — named individuals who get the founder/exec Studio surface on
// top of the role gate (Admin + 'Executive / CEO' already pass in requireStudioAccess).
// Mirrors the BOOTSTRAP_ADMINS pattern in lib/admin/access.ts: a code default plus an
// optional env override (STUDIO_ALLOWLIST_EMAILS, comma-separated) so the list can change
// without a redeploy. Emails are compared lower-cased.

const STUDIO_ALLOWLIST = ['vishen@mindvalley.com', 'titus@mindvalley.com'];

function envAllowlist(): string[] {
  return (process.env.STUDIO_ALLOWLIST_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** True if this email is explicitly granted the Studio surface (regardless of roles). */
export function isStudioAllowlisted(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return STUDIO_ALLOWLIST.includes(e) || envAllowlist().includes(e);
}
