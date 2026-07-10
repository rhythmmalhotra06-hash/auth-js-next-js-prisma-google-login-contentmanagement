import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { backfillShoots } from '@/lib/airtable/shoot-backfill';

// Phase 2 backfill: mirror 📺 Shoots → Postgres so PG can become the read/write source
// for shoots. Runs in-service (DATABASE_URL auto-injected). Idempotent (upsert on
// airtable_id) — safe to re-run.
//
//   curl -X POST "$URL/api/sync/backfill-shoots" -H "Authorization: Bearer $SYNC_SECRET"

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
    const report = await backfillShoots();
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
