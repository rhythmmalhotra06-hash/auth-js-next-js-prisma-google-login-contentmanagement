import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { PULL_RUNNERS } from '@/lib/airtable/pull-registry';

// Inbound pull (Airtable → Postgres): import edits the team made in Airtable, with
// echo-suppression + last-writer-wins conflict handling, across every registered
// domain (tickets today; shoots/social/media as they migrate). Runs in-service so
// DATABASE_URL resolves. Bearer-gated; drive from a Kessel internal cron every ~2–3 min.
//
//   curl -X POST "$URL/api/sync/pull"                 -H "Authorization: Bearer $SYNC_SECRET"
//   curl -X POST "$URL/api/sync/pull?fullResync=true" -H "Authorization: Bearer $SYNC_SECRET"  # ignore cursor
//   curl -X POST "$URL/api/sync/pull?entity=ticket"   -H "Authorization: Bearer $SYNC_SECRET"  # one domain

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
  const url = new URL(req.url);
  const fullResync = url.searchParams.get('fullResync') === 'true';
  const only = url.searchParams.get('entity');
  const runners = only ? PULL_RUNNERS.filter((r) => r.entity === only) : PULL_RUNNERS;
  if (only && runners.length === 0) {
    return NextResponse.json({ ok: false, error: `unknown entity: ${only}` }, { status: 400 });
  }
  try {
    const reports: Record<string, unknown> = {};
    for (const r of runners) reports[r.entity] = await r.run({ fullResync });
    return NextResponse.json({ ok: true, reports });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
