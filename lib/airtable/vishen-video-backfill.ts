// One-time (idempotent) backfill: mirror 🎬 Videos → Postgres. Excludes Rejected (matches
// listVishenVideos). Upsert on airtable_id — safe to re-run.

import { listAll } from './rest';
import { VISHEN_VIDEOS } from './field-map';
import { upsertVishenVideosFromRecords } from './vishen-video-upsert';
import { seedPullCursor } from './pull-core';
import { VISHEN_VIDEO_PULL_CURSOR } from './pull-vishen-videos';

const F = VISHEN_VIDEOS.fields;

export async function backfillVishenVideos(): Promise<{ fetched: number; upserted: number }> {
  const res = await listAll(VISHEN_VIDEOS.baseId, VISHEN_VIDEOS.tableId, { filterByFormula: `NOT({Status} = 'Rejected')` });
  if (!res.ok) throw new Error(res.error.message);
  const upserted = await upsertVishenVideosFromRecords(res.data);
  // Seed the pull cursor so the first post-backfill pull is incremental (no reassert storm).
  await seedPullCursor(VISHEN_VIDEO_PULL_CURSOR, res.data, (r) => (typeof r.fields[F.lastModified] === 'string' ? (r.fields[F.lastModified] as string) : null));
  return { fetched: res.data.length, upserted };
}
