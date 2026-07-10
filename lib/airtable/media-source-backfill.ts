// One-time (idempotent) backfill: mirror ALL 📺 Media Sources → Postgres (incl. Archived, so the
// dedupe reads findMediaSourceByUrl/existing* are complete). Upsert on airtable_id.

import { listAll } from './rest';
import { MEDIA_SOURCES } from './field-map';
import { upsertMediaSourcesFromRecords } from './media-source-upsert';
import { seedPullCursor } from './pull-core';
import { MEDIA_SOURCE_PULL_CURSOR } from './pull-media-sources';

const F = MEDIA_SOURCES.fields;

export async function backfillMediaSources(): Promise<{ fetched: number; upserted: number }> {
  const res = await listAll(MEDIA_SOURCES.baseId, MEDIA_SOURCES.tableId);
  if (!res.ok) throw new Error(res.error.message);
  const upserted = await upsertMediaSourcesFromRecords(res.data);
  // Seed the pull cursor so the first post-backfill pull is incremental (media has no reassert
  // path, but this keeps re-runs cheap + consistent with the other domains).
  await seedPullCursor(MEDIA_SOURCE_PULL_CURSOR, res.data, (r) => (typeof r.fields[F.lastModified] === 'string' ? (r.fields[F.lastModified] as string) : null));
  return { fetched: res.data.length, upserted };
}
