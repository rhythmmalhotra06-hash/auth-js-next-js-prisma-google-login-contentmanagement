// Inbound pull for the Media Sources READ-MIRROR: Airtable → Postgres. Airtable is the source
// of truth here (writes go there + write-through), so this is a plain incremental upsert — no
// echo-suppression / conflict logic needed (PG never originates a competing write). Catches
// external Airtable edits (and is the safety net if a write-through was missed).

import { MEDIA_SOURCES } from './field-map';
import { upsertMediaSourcesFromRecords } from './media-source-upsert';
import { runPull, type PullReport, type PullStats } from './pull-core';

export const MEDIA_SOURCE_PULL_CURSOR = 'media_source_pull_cursor';
const F = MEDIA_SOURCES.fields;

async function importMediaSourceRecords(records: import('./rest').AirtableRecord[]): Promise<PullStats> {
  const imported = records.length ? await upsertMediaSourcesFromRecords(records) : 0;
  return { imported, echoSkipped: 0, conflictSkipped: 0 };
}

export async function pullMediaSources(opts: { fullResync?: boolean } = {}): Promise<PullReport> {
  return runPull(
    {
      cursorKey: MEDIA_SOURCE_PULL_CURSOR,
      baseId: MEDIA_SOURCES.baseId,
      tableId: MEDIA_SOURCES.tableId,
      // No base filter — all Media Sources rows are app-owned; just fetch changed since cursor.
      buildFilter: (since) =>
        since ? `IS_AFTER(DATETIME_PARSE({App Last Modified (sync)}, 'YYYY-MM-DD HH:mm:ss'), DATETIME_PARSE("${since}", 'YYYY-MM-DD HH:mm:ss'))` : undefined,
      rawModified: (r) => (typeof r.fields[F.lastModified] === 'string' ? (r.fields[F.lastModified] as string) : null),
      importRecords: importMediaSourceRecords,
    },
    opts,
  );
}
