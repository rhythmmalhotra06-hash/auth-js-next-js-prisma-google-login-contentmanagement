import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { drainOutbox } from '@/lib/airtable/push';

// Drain the Airtable push outbox (portal → Airtable ticket sync). Runs in-service
// so DATABASE_URL + AIRTABLE_API_KEY resolve. Bearer-gated like the other sync
// routes; schedule via a Kessel internal job (curl every ~1–2 min).
//
//   curl -X POST "$URL/api/sync/push" -H "Authorization: Bearer $SYNC_SECRET"

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
    const report = await drainOutbox();
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
