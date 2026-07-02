// Ticket backfill core (Airtable Prio → Postgres), shared by the bearer-gated route
// and the admin-triggered button on /admin/sync. Idempotent (upsert on airtable_id),
// and seeds the inbound-pull cursor so the first pull is incremental, not a full rescan.

import { prisma } from '@/lib/prisma';
import { listAll } from './rest';
import { TICKETS } from './field-map';
import { bulkInsertTicketsFromRecords } from './ticket-upsert';
import { TICKET_PULL_CURSOR } from './pull';

const ACTIVE_FILTER = `NOT(OR({Ticket Status} = 'Done', {Ticket Status} = "Won't Do"))`;

export interface BackfillReport { fetched: number; upserted: number; unresolved: number; cursor: string | null }

export async function backfillTickets(opts: { includeAll?: boolean } = {}): Promise<BackfillReport> {
  const res = await listAll(TICKETS.baseId, TICKETS.tableId, {
    ...(opts.includeAll ? {} : { filterByFormula: ACTIVE_FILTER }),
  });
  if (!res.ok) throw new Error(res.error.message);

  const result = await bulkInsertTicketsFromRecords(res.data);

  // Seed the pull cursor to the newest modified time imported (fixed-width UTC strings
  // sort chronologically), so the first inbound pull only fetches later edits.
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

  return { fetched: res.data.length, cursor, ...result };
}
