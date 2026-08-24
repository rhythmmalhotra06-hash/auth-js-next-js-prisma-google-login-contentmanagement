import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAccess } from '@/lib/admin/access';
import { startAuthorization } from '@/lib/hootsuite/oauth';

// Step 1 of connecting Hootsuite: send an admin to Hootsuite's consent screen.
//
// Admin-only — this grant becomes the app's standing credential for pulling analytics, so
// it must not be initiable by any signed-in user. The PKCE verifier and state live in
// short-lived httpOnly cookies rather than the database, so an abandoned attempt can't be
// replayed against a later one.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TEN_MINUTES = 600;

export async function GET() {
  const { isAdmin } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: 'Admins only.' }, { status: 403 });

  try {
    const { url, verifier, state } = await startAuthorization();
    const jar = await cookies();
    const opts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: TEN_MINUTES };
    jar.set('hs_pkce', verifier, opts);
    jar.set('hs_state', state, opts);
    return NextResponse.redirect(url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(new URL(`/admin/hootsuite?error=${encodeURIComponent(message)}`, process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'));
  }
}
