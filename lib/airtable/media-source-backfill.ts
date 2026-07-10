// One-time (idempotent) backfill: mirror ALL 📺 Media Sources → Postgres (incl. Archived, so the
// dedupe reads findMediaSourceByUrl/existing* are complete). Upsert on airtable_id.

import { listAll } from './rest';
import { MEDIA_SOURCES } from './field-map';
import { upsertMediaSourcesFromRecords } from './media-source-upsert';

export async function backfillMediaSources(): Promise<{ fetched: number; upserted: number }> {
  const res = await listAll(MEDIA_SOURCES.baseId, MEDIA_SOURCES.tableId);
  if (!res.ok) throw new Error(res.error.message);
  const upserted = await upsertMediaSourcesFromRecords(res.data);
  return { fetched: res.data.length, upserted };
}
