import { redirect } from 'next/navigation';
import { auth, signIn } from '@/lib/auth';
import { getEmployeeForSession } from '@/lib/employee';
import { homeRouteForRoles } from '@/lib/roles';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

export default async function Home() {
  const session = await auth();
  if (session) {
    const employee = await getEmployeeForSession();
    redirect(homeRouteForRoles(employee?.roles));
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div
        className="relative hidden flex-col justify-between p-12 text-white lg:flex"
        style={{ background: 'linear-gradient(135deg, #572280 0%, #3b1759 100%)' }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold tracking-wide">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#F5B000' }} />
          Mindvalley · Creative Services
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Content Production
            <br />& Management
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            One place for intake, prioritization, production, approval and performance —
            replacing scattered Jira boards and Airtable bases.
          </p>
        </div>
        <div className="text-xs text-white/50">A Blinkwork tool</div>
      </div>

      {/* Login card */}
      <div className="flex items-center justify-center bg-neutral-50 p-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <h1 className="text-2xl font-bold" style={{ color: '#572280' }}>Creative Services</h1>
          </div>

          <h2 className="text-2xl font-bold text-neutral-900">Sign in</h2>
          <p className="mt-1 text-sm text-neutral-500">Use your Mindvalley Google account to continue.</p>

          <form
            className="mt-8"
            action={async () => {
              'use server';
              await signIn('google', { redirectTo: '/' });
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm font-medium text-neutral-700 shadow-sm transition hover:bg-neutral-50"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </form>

          <p className="mt-6 text-xs text-neutral-400">Team-only access · @mindvalley.com accounts.</p>
        </div>
      </div>
    </main>
  );
}
