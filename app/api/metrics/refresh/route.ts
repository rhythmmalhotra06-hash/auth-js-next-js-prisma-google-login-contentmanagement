import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { refreshTicketMetrics } from '@/lib/metrics/snapshot';

// Nightly metrics refresh — scans the Airtable ticket table once and persists the
// status tally (e.g. all-time Shipped) to Postgres so dashboards read one cheap row
// instead of scanning ~10k rows on every load. Run in-service so DATABASE_URL
// (Kessel-injected) points at the managed DB. Protected by a bearer secret.
//
//   curl -X POST "$URL/api/metrics/refresh" -H "Authorization: Bearer $SYNC_SECRET"

export const runtime = 'nodejs'; // Prisma pg adapter needs Node, not edge
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
    const metrics = await refreshTicketMetrics();
    return NextResponse.json({ ok: true, metrics });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
