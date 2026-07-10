// One-time (idempotent) backfill: mirror all 📺 Shoots → Postgres so PG can become the
// read/write source for shoots. Upsert on airtable_id — safe to re-run. Reference sync
// need not run first (shoot links are stored as recId arrays, not resolved FKs).

import { listAll } from './rest';
import { SHOOTS } from './field-map';
import { upsertShootsFromRecords } from './shoot-upsert';

export async function backfillShoots(): Promise<{ fetched: number; upserted: number }> {
  const res = await listAll(SHOOTS.baseId, SHOOTS.tableId);
  if (!res.ok) throw new Error(res.error.message);
  const upserted = await upsertShootsFromRecords(res.data);
  return { fetched: res.data.length, upserted };
}
