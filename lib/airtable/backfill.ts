// Ticket backfill core (Airtable Prio → Postgres), shared by the bearer-gated route
// and the admin-triggered button on /admin/sync. Streams page-by-page so memory stays
// bounded (loading all ~10k at once OOM'd the container → 503) and each page is a few
// bulk INSERTs (not one round-trip per ticket → fatal cross-region). Idempotent
// (skipDuplicates on airtable_id); seeds the inbound-pull cursor so the first pull is
// incremental, not a full rescan.

import { prisma } from '@/lib/prisma';
import { listRecords } from './rest';
import { TICKETS } from './field-map';
import { buildTicketRefMaps, insertTicketRecords } from './ticket-upsert';
import { TICKET_PULL_CURSOR } from './pull';

const ACTIVE_FILTER = `NOT(OR({Ticket Status} = 'Done', {Ticket Status} = "Won't Do"))`;

export interface BackfillReport { fetched: number; upserted: number; unresolved: number; cursor: string | null }

export async function backfillTickets(opts: { includeAll?: boolean } = {}): Promise<BackfillReport> {
  const F = TICKETS.fields;
  const params = opts.includeAll ? {} : { filterByFormula: ACTIVE_FILTER };

  const maps = await buildTicketRefMaps(); // once, reused across pages

  let fetched = 0, upserted = 0, unresolved = 0;
  let cursor: string | null = null;
  let offset: string | undefined;

  // Stream one Airtable page (~100 records) at a time: insert it, drop it, next page.
  do {
    const page = await listRecords(TICKETS.baseId, TICKETS.tableId, { ...params, offset });
    if (!page.ok) throw new Error(page.error.message);
    const recs = page.data.records;
    fetched += recs.length;

    const r = await insertTicketRecords(recs, maps);
    upserted += r.upserted;
    unresolved += r.unresolved;

    for (const rec of recs) {
      const v = rec.fields[F.lastModified];
      if (typeof v === 'string' && (!cursor || v > cursor)) cursor = v;
    }
    offset = page.data.offset;
  } while (offset);

  // Seed the pull cursor to the newest modified time imported (fixed-width UTC strings
  // sort chronologically), so the first inbound pull only fetches later edits.
  if (cursor) {
    await prisma.syncState.upsert({
      where: { key: TICKET_PULL_CURSOR },
      create: { key: TICKET_PULL_CURSOR, value: cursor },
      update: { value: cursor },
    });
  }

  return { fetched, upserted, unresolved, cursor };
}
