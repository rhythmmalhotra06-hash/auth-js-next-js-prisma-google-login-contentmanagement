import Link from 'next/link';

// Public page (excluded from middleware auth). Shown when Auth.js rejects a
// sign-in — e.g. a non-@mindvalley.com Google account.
export default function AccessDeniedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-bg-muted p-8">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full bg-brand">
          <span className="text-xl text-white">🔒</span>
        </div>
        <h1 className="text-2xl font-bold text-text">Access denied</h1>
        <p className="mt-2 text-sm text-text-muted">
          This tool is limited to <strong>@mindvalley.com</strong> Google accounts. Sign in with your
          Mindvalley work account to continue.
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
