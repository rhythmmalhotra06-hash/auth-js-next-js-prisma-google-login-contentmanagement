// Inbound pull: Airtable → Postgres for 🎬 Vishen Videos (excludes Rejected). Same conflict
// model as the other domains. The team maintains this table heavily, so the pull is the main
// path that keeps PG fresh; the app only pushes approval/rating/views24h.

import { prisma } from '@/lib/prisma';
import { VISHEN_VIDEOS } from './field-map';
import { type AirtableRecord } from './rest';
import { upsertVishenVideosFromRecords } from './vishen-video-upsert';
import { runPull, type PullReport, type PullStats } from './pull-core';

export const VISHEN_VIDEO_PULL_CURSOR = 'vishen_video_pull_cursor';
const F = VISHEN_VIDEOS.fields;
const ECHO_WINDOW_MS = 90_000;
const NOT_REJECTED = `NOT({Status} = 'Rejected')`;

function parseTs(v: unknown): Date | null {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(`${v.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function importVishenVideoRecords(records: AirtableRecord[]): Promise<PullStats> {
  const recIds = records.map((r) => r.id);
  const existing = recIds.length
    ? await prisma.vishenVideo.findMany({ where: { airtableId: { in: recIds } }, select: { id: true, airtableId: true, updatedAt: true, airtablePushedAt: true } })
    : [];
  const byRec = new Map(existing.map((v) => [v.airtableId as string, v]));

  const toImport: AirtableRecord[] = [];
  const reassert: string[] = [];
  let echoSkipped = 0, conflictSkipped = 0;

  for (const r of records) {
    const rawMod = typeof r.fields[F.lastModified] === 'string' ? (r.fields[F.lastModified] as string) : null;
    const mod = parseTs(rawMod);
    const pg = byRec.get(r.id);

    if (!pg) { toImport.push(r); continue; }
    if (!mod) { toImport.push(r); continue; }

    if (pg.airtablePushedAt && mod.getTime() <= pg.airtablePushedAt.getTime() + ECHO_WINDOW_MS) {
      echoSkipped++;
      continue;
    }
    if (mod.getTime() > pg.updatedAt.getTime()) {
      toImport.push(r);
    } else {
      conflictSkipped++;
      reassert.push(pg.id);
    }
  }

  if (toImport.length) await upsertVishenVideosFromRecords(toImport);
  if (reassert.length) {
    await prisma.airtableOutbox.createMany({ data: reassert.map((id) => ({ entity: 'vishenVideo', entityId: id, op: 'upsert' })) });
  }

  return { imported: toImport.length, echoSkipped, conflictSkipped };
}

export async function pullVishenVideos(opts: { fullResync?: boolean } = {}): Promise<PullReport> {
  return runPull(
    {
      cursorKey: VISHEN_VIDEO_PULL_CURSOR,
      baseId: VISHEN_VIDEOS.baseId,
      tableId: VISHEN_VIDEOS.tableId,
      buildFilter: (since) =>
        since
          ? `AND(${NOT_REJECTED}, IS_AFTER(DATETIME_PARSE({App Last Modified (sync)}, 'YYYY-MM-DD HH:mm:ss'), DATETIME_PARSE("${since}", 'YYYY-MM-DD HH:mm:ss')))`
          : NOT_REJECTED,
      rawModified: (r) => (typeof r.fields[F.lastModified] === 'string' ? (r.fields[F.lastModified] as string) : null),
      importRecords: importVishenVideoRecords,
    },
    opts,
  );
}
