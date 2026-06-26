import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { drainBlinklifeOutbox, pushVishenReview } from '@/lib/blinklife/push';

// Drain the BlinkLife push outbox (portal → BlinkLife editor tasks). Runs in-service
// so DATABASE_URL + BLINKLIFE_TOKEN resolve. Bearer-gated like the Airtable sync
// routes; schedule via a Kessel internal job (the deployed app is IAP-gated, so an
// external curl needs a Google OIDC token — use the internal scheduler instead).
//
//   curl -X POST "$URL/api/push/blinklife"            -H "Authorization: Bearer $SYNC_SECRET"
//   curl -X POST "$URL/api/push/blinklife?review=true" -H "Authorization: Bearer $SYNC_SECRET"  # also refresh Vishen's page

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.BLINKLIFE_SYNC_SECRET || process.env.SYNC_SECRET;
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
  const withReview = new URL(req.url).searchParams.get('review') === 'true';
  try {
    const report = await drainBlinklifeOutbox();
    const review = withReview ? await pushVishenReview() : undefined;
    return NextResponse.json({ ok: true, report, review });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
