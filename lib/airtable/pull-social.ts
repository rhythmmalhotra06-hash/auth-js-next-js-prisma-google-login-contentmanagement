// Inbound pull: Airtable → Postgres for 📣 SOCIAL (engine-origin rows only). Same conflict
// model as tickets/shoots. The base filter keeps non-engine board rows out of PG on every
// pass (the Social table also holds the team's manual rows).

import { prisma } from '@/lib/prisma';
import { SOCIAL } from './field-map';
import { type AirtableRecord } from './rest';
import { upsertSocialFromRecords } from './social-upsert';
import { runPull, type PullReport, type PullStats } from './pull-core';

export const SOCIAL_PULL_CURSOR = 'social_pull_cursor';
const F = SOCIAL.fields;
const ECHO_WINDOW_MS = 90_000;

// Engine-origin marker: a non-empty Clip Source URL. Applied on every pass so the board's
// manual rows never enter PG.
const ENGINE_FILTER = `NOT({Clip Source URL} = '')`;

function parseTs(v: unknown): Date | null {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(`${v.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function importSocialRecords(records: AirtableRecord[]): Promise<PullStats> {
  const recIds = records.map((r) => r.id);
  const existing = recIds.length
    ? await prisma.socialPost.findMany({ where: { airtableId: { in: recIds } }, select: { id: true, airtableId: true, updatedAt: true, airtablePushedAt: true } })
    : [];
  const byRec = new Map(existing.map((s) => [s.airtableId as string, s]));

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

  if (toImport.length) await upsertSocialFromRecords(toImport);
  if (reassert.length) {
    await prisma.airtableOutbox.createMany({ data: reassert.map((id) => ({ entity: 'social', entityId: id, op: 'upsert' })) });
  }

  return { imported: toImport.length, echoSkipped, conflictSkipped };
}

export async function pullSocial(opts: { fullResync?: boolean } = {}): Promise<PullReport> {
  return runPull(
    {
      cursorKey: SOCIAL_PULL_CURSOR,
      baseId: SOCIAL.baseId,
      tableId: SOCIAL.tableId,
      buildFilter: (since) =>
        since
          ? `AND(${ENGINE_FILTER}, IS_AFTER(DATETIME_PARSE({App Last Modified (sync)}, 'YYYY-MM-DD HH:mm:ss'), DATETIME_PARSE("${since}", 'YYYY-MM-DD HH:mm:ss')))`
          : ENGINE_FILTER,
      rawModified: (r) => (typeof r.fields[F.lastModified] === 'string' ? (r.fields[F.lastModified] as string) : null),
      importRecords: importSocialRecords,
    },
    opts,
  );
}
