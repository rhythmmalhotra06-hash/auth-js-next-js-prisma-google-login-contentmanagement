// Guards for API route handlers.
//
// These return a Response to send (deny) or null (allow), rather than redirecting
// like the page guards in lib/social/guard.ts and lib/studio/guard.ts. Routes here
// are called by `fetch` from the browser or by schedulers, so a 401 JSON body is the
// right answer — a redirect would be parsed as a successful response by the client.
//
// NOTE: middleware.ts deliberately excludes /api from the session matcher ("the sync
// route guards itself"), so *every* route under app/api is public unless it calls one
// of these. There is no blanket protection to fall back on.

import { auth } from '@/lib/auth';

/**
 * Require a signed-in user. For endpoints a human triggers from the portal.
 *
 * Use this on anything that spends money or writes data on demand: without it the
 * route is reachable by anyone who knows the URL, since middleware skips /api.
 */
export async function requireSession(): Promise<Response | null> {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: 'You need to be signed in to do this.' }, { status: 401 });
  }
  return null;
}

/**
 * Require the shared-secret header used by the scheduled jobs (auto-discover,
 * Slack scan, Major Videos sync, clip convert).
 *
 * FAIL-CLOSED: an unset DISCOVER_SHARED_SECRET denies the request. These routes
 * previously skipped the check entirely when the env var was missing, which meant a
 * dropped or renamed secret would silently expose them rather than break them
 * loudly. They also documented IAP as the primary gate, but the service moved to a
 * host that has none — so this header is the only gate left.
 */
export function requireDiscoverSecret(req: Request): Response | null {
  const secret = process.env.DISCOVER_SHARED_SECRET;
  if (!secret) {
    console.error('[guard] DISCOVER_SHARED_SECRET is not set — denying scheduled-job request');
    return Response.json({ error: 'Endpoint is not configured.' }, { status: 503 });
  }
  if (req.headers.get('x-discover-secret') !== secret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
