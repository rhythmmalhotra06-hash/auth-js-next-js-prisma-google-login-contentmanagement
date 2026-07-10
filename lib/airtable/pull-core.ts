// Inbound-pull scaffolding shared by every domain. The generic parts — read the
// SyncState cursor, fetch only records changed since it, advance + persist the cursor —
// live here; the domain supplies its cursor field, filter format, and an importer that
// owns echo-suppression / conflict resolution for its own model.
//
// Cursor sorting relies on the cursor field being a FIXED-WIDTH, chronologically-sortable
// string — true for both the ticket "YYYY-MM-DD HH:mm:ss" formula field and native
// Airtable lastModifiedTime ISO values ("2026-07-07T..Z"). Don't mix formats within a
// domain.
//
// KNOWN LIMITATION (inherited from the original ticket sync; unchanged by the migration) —
// harden before the team-heavy domains (shoots/vishen videos) rely on inbound edits:
//   1. Echo-suppression is TIME-ONLY, not field-aware: any Airtable edit whose modified time
//      falls within ~90s AFTER our own push is treated as an echo and skipped — even if a
//      teammate genuinely changed a different field in that window. The cursor still advances
//      past it (it must, or the pull would loop forever on that fixed-timestamp echo), so that
//      edit is dropped from PG until the row is touched again. A proper fix compares the incoming
//      fields against what we pushed (store the pushed snapshot) instead of a time window.
//   2. The cursor is second-resolution + strict IS_AFTER, so a second edit landing in the SAME
//      clock second as the watermark, not returned in the current snapshot, can be missed.
// Both are low-probability with a 2–3 min poll + human edit rates and are acceptable for the
// interim; the periodic full reference/backfill reconcile is the backstop.

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
