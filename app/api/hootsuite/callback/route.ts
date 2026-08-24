import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAccess } from '@/lib/admin/access';
import { completeAuthorization } from '@/lib/hootsuite/oauth';

// Step 2: Hootsuite redirects back here with a code. Swap it for tokens and store them
// sealed, then land the admin back on the integration page with the outcome.
//
// State is compared against the cookie set in /connect — without that check, a link from
// anywhere could complete an OAuth flow into this app's stored credential.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function back(params: Record<string, string>): NextResponse {
  const base = process.env.NEXT_PUBLIC_URL ?? process.env.AUTH_URL ?? 'http://localhost:3000';
  const u = new URL('/admin/hootsuite', base);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return NextResponse.redirect(u);
}

export async function GET(req: Request) {
  const { isAdmin, email } = await getAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: 'Admins only.' }, { status: 403 });

  const url = new URL(req.url);
  const denied = url.searchParams.get('error');
  if (denied) {
    return back({ error: `${denied}: ${url.searchParams.get('error_description') ?? 'authorization was not granted'}` });
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const jar = await cookies();
  const verifier = jar.get('hs_pkce')?.value;
  const expectedState = jar.get('hs_state')?.value;

  jar.delete('hs_pkce');
  jar.delete('hs_state');

  if (!code) return back({ error: 'Hootsuite returned no authorization code.' });
  if (!verifier || !expectedState) return back({ error: 'The connect attempt expired. Start again.' });
  if (state !== expectedState) return back({ error: 'State mismatch — the connect attempt was not the one started here.' });

  try {
    await completeAuthorization(code, verifier, email);
    return back({ connected: '1' });
  } catch (err) {
    return back({ error: err instanceof Error ? err.message : String(err) });
  }
}
