// Inbound-pull scaffolding shared by every domain. The generic parts — read the
// SyncState cursor, fetch only records changed since it, advance + persist the cursor —
// live here; the domain supplies its cursor field, filter format, and an importer that
// owns echo-suppression / conflict resolution for its own model.
//
// Cursor sorting relies on the cursor field being a FIXED-WIDTH, chronologically-sortable
// string — true for both the ticket "YYYY-MM-DD HH:mm:ss" formula field and native
// Airtable lastModifiedTime ISO values ("2026-07-07T..Z"). Don't mix formats within a
// domain.

import { prisma } from '@/lib/prisma';
import { listAll, type AirtableRecord } from './rest';

export interface PullStats { imported: number; echoSkipped: number; conflictSkipped: number }
export interface PullReport extends PullStats { scanned: number; cursor: string | null }

export interface PullDomain {
  /** SyncState key holding this domain's watermark. */
  cursorKey: string;
  baseId: string;
  tableId: string;
  /** Build the filterByFormula for this fetch. `since` is null on the first/full pass —
   *  return a base filter (e.g. "only our rows") or undefined to fetch everything. */
  buildFilter(since: string | null): string | undefined;
  /** Extract the raw cursor string from a record (for advancing the watermark). */
  rawModified(rec: AirtableRecord): string | null;
  /** Import changed records into PG, owning echo-suppression + conflict handling. */
  importRecords(records: AirtableRecord[]): Promise<PullStats>;
}

export async function runPull(domain: PullDomain, opts: { fullResync?: boolean } = {}): Promise<PullReport> {
  const state = opts.fullResync ? null : await prisma.syncState.findUnique({ where: { key: domain.cursorKey } });
  const since = state?.value ?? null;

  const filter = domain.buildFilter(since);
  const res = await listAll(domain.baseId, domain.tableId, { ...(filter ? { filterByFormula: filter } : {}) });
  if (!res.ok) throw new Error(res.error.message);
  const records = res.data as AirtableRecord[];

  // Advance the cursor to the newest modified value we saw (fixed-width string sort).
  let cursor = since;
  for (const r of records) {
    const raw = domain.rawModified(r);
    if (raw && (!cursor || raw > cursor)) cursor = raw;
  }

  const stats = await domain.importRecords(records);

  if (cursor && cursor !== since) {
    await prisma.syncState.upsert({
      where: { key: domain.cursorKey },
      create: { key: domain.cursorKey, value: cursor },
      update: { value: cursor },
    });
  }

  return { scanned: records.length, ...stats, cursor };
}
