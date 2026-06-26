import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { migrateHistory } from '@/lib/airtable/migrate';

// Historical migration (tickets + assets), run in-service so DATABASE_URL
// (auto-injected by Kessel) points at the right managed Postgres. Protected by
// the same bearer secret as the reference sync. Run the reference sync first.
//
//   curl -X POST "$URL/api/sync/history" -H "Authorization: Bearer $SYNC_SECRET"
//   add ?dryRun=true to fetch + map without writing.

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
  const dryRun = new URL(req.url).searchParams.get('dryRun') === 'true';
  try {
    const report = await migrateHistory({ dryRun });
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
