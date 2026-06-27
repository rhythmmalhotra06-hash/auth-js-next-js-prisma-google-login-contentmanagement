import { convertCheckedClips } from '@/app/media/actions';

// Node runtime: Airtable reads + writes (and createTicket fan-out).
export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Airtable checkbox → ticket. Scans 🎬 Clip Suggestions for rows where the
 * "Create Ticket" box is ticked (and not Dismissed), converts each into a Prio
 * Request ticket — inheriting Event/Asset Type, Official Calendar, Due Date and
 * requester from the parent 📺 Media Source — links the ticket back to the clip,
 * flips Status to Approved, and unticks the box so it won't re-fire.
 *
 * Driven by the same scheduler as /api/media/discover (the app is IAP-gated, so an
 * inbound Airtable webhook is blocked — we poll on a cadence instead). Auth: Google
 * OIDC (IAP) + the x-discover-secret shared-secret header. Optional env for the
 * requester fallback when a source has no Submitted By: DEFAULT_TICKET_REQUESTER_ID.
 */
export async function POST(req: Request) {
  const secret = process.env.DISCOVER_SHARED_SECRET;
  if (secret) {
    const provided = req.headers.get('x-discover-secret');
    if (provided !== secret) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await convertCheckedClips();
  const status = result.error ? 502 : 200;
  return Response.json(result, { status });
}

// GET for manual/cron flexibility (same logic).
export const GET = POST;
