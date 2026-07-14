import { handlers } from '@/lib/auth'
import type { NextRequest } from 'next/server'

// ─── TEMPORARY DIAGNOSTIC (auth pkce InvalidCheck investigation, 2026-07-13) ───
// Logs, on the Google OAuth callback only, whether the check cookies made the
// round trip back from Google. Values are NEVER logged — only cookie names and
// byte-lengths, plus which query params arrived. Remove once the cause is found.
function logCallbackCookies(req: NextRequest) {
  try {
    const url = new URL(req.url)
    if (!url.pathname.endsWith('/callback/google')) return

    const authCookies = req.cookies
      .getAll()
      .filter((c) => c.name.includes('authjs'))
      .map((c) => `${c.name}=${c.value?.length ?? 0}b`)

    console.log(
      '[auth-diag] callback/google',
      JSON.stringify({
        hasCode: url.searchParams.has('code'),
        hasState: url.searchParams.has('state'),
        error: url.searchParams.get('error') ?? null,
        // any authjs cookie the browser sent back (name + length only)
        authCookies,
        // the specific check we care about
        hasPkce: authCookies.some((c) => c.startsWith('__Secure-authjs.pkce.code_verifier')),
        // proxy header sanity — wrong proto/host breaks secure-cookie name matching
        xfProto: req.headers.get('x-forwarded-proto'),
        xfHost: req.headers.get('x-forwarded-host'),
        host: req.headers.get('host'),
      }),
    )
  } catch (e) {
    console.log('[auth-diag] logging error', (e as Error)?.message)
  }
}

const baseGET = handlers.GET

export const GET = (req: NextRequest) => {
  logCallbackCookies(req)
  return baseGET(req)
}

export const { POST } = handlers
