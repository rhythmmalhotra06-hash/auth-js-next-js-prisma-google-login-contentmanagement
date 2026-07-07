import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { reconcileClipTicketLinks } from '@/lib/media/ticket-links';

// Reconcile ticket ↔ clip links (🎬 Clip Suggestions + Clips (Sync)) for clips that were
// converted to tickets. Idempotent + best-effort; heals links once the ticket has mirrored to
// Airtable and the synced-clip row exists. Bearer-gated; drive from a Kessel internal scheduled
// job every ~5 min.
//
//   curl -X POST "$URL/api/media/link-tickets" -H "Authorization: Bearer $SYNC_SECRET"

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const report = await reconcileClipTicketLinks();
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
