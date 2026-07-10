// One-time (idempotent) backfill: mirror all 📺 Shoots → Postgres so PG can become the
// read/write source for shoots. Upsert on airtable_id — safe to re-run. Reference sync
// need not run first (shoot links are stored as recId arrays, not resolved FKs).

import { listAll } from './rest';
import { SHOOTS } from './field-map';
import { upsertShootsFromRecords } from './shoot-upsert';
import { seedPullCursor } from './pull-core';
import { SHOOT_PULL_CURSOR } from './pull-shoots';

const F = SHOOTS.fields;

export async function backfillShoots(): Promise<{ fetched: number; upserted: number }> {
  const res = await listAll(SHOOTS.baseId, SHOOTS.tableId);
  if (!res.ok) throw new Error(res.error.message);
  const upserted = await upsertShootsFromRecords(res.data);
  // Seed the pull cursor so the first post-backfill pull is incremental (no reassert storm).
  await seedPullCursor(SHOOT_PULL_CURSOR, res.data, (r) => (typeof r.fields[F.lastModified] === 'string' ? (r.fields[F.lastModified] as string) : null));
  return { fetched: res.data.length, upserted };
}
