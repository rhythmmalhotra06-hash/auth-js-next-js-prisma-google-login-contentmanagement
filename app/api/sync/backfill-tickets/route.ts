import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { backfillTickets } from '@/lib/airtable/backfill';

// Phase 1 backfill: mirror the ACTIVE Prio Requests set into Postgres so PG can
// become the read source for tickets. Runs in-service (DATABASE_URL auto-injected).
// Idempotent (upsert on airtable_id) — safe to re-run. Reference sync must run first.
//
//   curl -X POST "$URL/api/sync/backfill-tickets" -H "Authorization: Bearer $SYNC_SECRET"
//   ?all=true → include the ~9k Done/Won't Do history too (slow; normally leave it in Airtable).

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
  const includeAll = new URL(req.url).searchParams.get('all') === 'true';
  try {
    const report = await backfillTickets({ includeAll });
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
