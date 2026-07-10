// One-time (idempotent) backfill: mirror 🎬 Videos → Postgres. Excludes Rejected (matches
// listVishenVideos). Upsert on airtable_id — safe to re-run.

import { listAll } from './rest';
import { VISHEN_VIDEOS } from './field-map';
import { upsertVishenVideosFromRecords } from './vishen-video-upsert';

export async function backfillVishenVideos(): Promise<{ fetched: number; upserted: number }> {
  const res = await listAll(VISHEN_VIDEOS.baseId, VISHEN_VIDEOS.tableId, { filterByFormula: `NOT({Status} = 'Rejected')` });
  if (!res.ok) throw new Error(res.error.message);
  const upserted = await upsertVishenVideosFromRecords(res.data);
  return { fetched: res.data.length, upserted };
}
