import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getAdminAccess } from '@/lib/admin/access';
import { homeRouteForRoles } from '@/lib/roles';

// Public page (excluded from middleware auth). Auth.js routes ALL sign-in errors
// here via `pages.error`, so a genuine domain rejection (no session) and a benign
// transient check failure (e.g. a duplicate/replayed OAuth callback that hits
// `InvalidCheck: pkceCodeVerifier` AFTER the real login already set a session)
// both land here. Self-heal: if the visitor actually has a valid session, this
// error is spurious — bounce them into the app instead of showing a dead-end.
export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) {
    // Already authenticated — the error was a stray callback, not a real denial.
    const { isAdmin, roles } = await getAdminAccess();
    redirect(isAdmin ? '/studio' : homeRouteForRoles(roles));
  }

  const { error } = await searchParams;
  // Only a true sign-in rejection means the account isn't allowed. Other Auth.js
  // errors (Configuration/Verification/OAuth*) are not domain problems.
  const isDomainDenial = error === 'AccessDenied';

  return (
    <main className="grid min-h-screen place-items-center bg-bg-muted p-8">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full bg-brand">
          <span className="text-xl text-white">🔒</span>
        </div>
        <h1 className="text-2xl font-bold text-text">
          {isDomainDenial ? 'Access denied' : "Couldn't sign you in"}
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          {isDomainDenial ? (
            <>
              This tool is limited to <strong>@mindvalley.com</strong> Google accounts. Sign in
              with your Mindvalley work account to continue.
            </>
          ) : (
            <>Something interrupted the sign-in. Please try again with your Mindvalley account.</>
          )}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
