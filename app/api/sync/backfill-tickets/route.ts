import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { listAll } from '@/lib/airtable/rest';
import { TICKETS } from '@/lib/airtable/field-map';
import { upsertTicketsFromRecords } from '@/lib/airtable/ticket-upsert';
import { TICKET_PULL_CURSOR } from '@/lib/airtable/pull';
import { prisma } from '@/lib/prisma';

// Phase 1 backfill: mirror the ACTIVE Prio Requests set into Postgres so PG can
// become the read source for tickets. Runs in-service (DATABASE_URL auto-injected).
// Idempotent (upsert on airtable_id) — safe to re-run. Reference sync must run first.
//
//   curl -X POST "$URL/api/sync/backfill-tickets" -H "Authorization: Bearer $SYNC_SECRET"
//   ?all=true → include the ~9k Done/Won't Do history too (slow; normally leave it in Airtable).

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const ACTIVE_FILTER = `NOT(OR({Ticket Status} = 'Done', {Ticket Status} = "Won't Do"))`;

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
    const res = await listAll(TICKETS.baseId, TICKETS.tableId, {
      ...(includeAll ? {} : { filterByFormula: ACTIVE_FILTER }),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: res.error.message }, { status: 502 });
    }
    const result = await upsertTicketsFromRecords(res.data);

    // Seed the inbound-pull cursor to the newest modified time we just imported, so
    // the first pull is incremental (not a full 10k rescan). Fixed-width UTC strings
    // sort chronologically.
    const F = TICKETS.fields;
    let cursor: string | null = null;
    for (const r of res.data) {
      const v = r.fields[F.lastModified];
      if (typeof v === 'string' && (!cursor || v > cursor)) cursor = v;
    }
    if (cursor) {
      await prisma.syncState.upsert({
        where: { key: TICKET_PULL_CURSOR },
        create: { key: TICKET_PULL_CURSOR, value: cursor },
        update: { value: cursor },
      });
    }

    return NextResponse.json({ ok: true, fetched: res.data.length, cursor, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
