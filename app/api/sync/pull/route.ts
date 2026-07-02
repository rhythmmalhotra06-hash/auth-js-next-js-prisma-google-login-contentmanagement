import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { pullTickets } from '@/lib/airtable/pull';

// Inbound pull (Airtable → Postgres): import ticket edits the team made in Airtable,
// with echo-suppression + last-writer-wins conflict handling. Runs in-service so
// DATABASE_URL resolves. Bearer-gated; drive from a Kessel internal cron every ~2–3 min.
//
//   curl -X POST "$URL/api/sync/pull"                 -H "Authorization: Bearer $SYNC_SECRET"
//   curl -X POST "$URL/api/sync/pull?fullResync=true" -H "Authorization: Bearer $SYNC_SECRET"  # ignore cursor

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
  const fullResync = new URL(req.url).searchParams.get('fullResync') === 'true';
  try {
    const report = await pullTickets({ fullResync });
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
