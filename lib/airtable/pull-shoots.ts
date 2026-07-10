// Inbound pull: Airtable → Postgres for 📺 SHOOTS. Same conflict model as tickets
// (echo-suppression + record-level last-writer-wins), built on the generic runPull.
//
// The cursor field "App Last Modified (sync)" exists on the Shoots table (SHOOTS.fields.lastModified
// = fldrfHdoRnXSqp7K3, created 2026-07-09), so this IS registered in pull-registry.ts — gated on
// SHOOTS_BACKEND=postgres so it only runs once shoots are PG-backed (and their columns exist).

import { prisma } from '@/lib/prisma';
import { SHOOTS } from './field-map';
import { type AirtableRecord } from './rest';
import { upsertShootsFromRecords } from './shoot-upsert';
import { runPull, type PullReport, type PullStats } from './pull-core';

export const SHOOT_PULL_CURSOR = 'shoot_pull_cursor';
const F = SHOOTS.fields;
const ECHO_WINDOW_MS = 90_000;

function parseTs(v: unknown): Date | null {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(`${v.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function importShootRecords(records: AirtableRecord[]): Promise<PullStats> {
  const recIds = records.map((r) => r.id);
  const existing = recIds.length
    ? await prisma.shoot.findMany({ where: { airtableId: { in: recIds } }, select: { id: true, airtableId: true, updatedAt: true, airtablePushedAt: true } })
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

  if (toImport.length) await upsertShootsFromRecords(toImport);
  if (reassert.length) {
    await prisma.airtableOutbox.createMany({ data: reassert.map((id) => ({ entity: 'shoot', entityId: id, op: 'upsert' })) });
  }

  return { imported: toImport.length, echoSkipped, conflictSkipped };
}

export async function pullShoots(opts: { fullResync?: boolean } = {}): Promise<PullReport> {
  return runPull(
    {
      cursorKey: SHOOT_PULL_CURSOR,
      baseId: SHOOTS.baseId,
      tableId: SHOOTS.tableId,
      buildFilter: (since) =>
        since ? `IS_AFTER(DATETIME_PARSE({App Last Modified (sync)}, 'YYYY-MM-DD HH:mm:ss'), DATETIME_PARSE("${since}", 'YYYY-MM-DD HH:mm:ss'))` : undefined,
      rawModified: (r) => (typeof r.fields[F.lastModified] === 'string' ? (r.fields[F.lastModified] as string) : null),
      importRecords: importShootRecords,
    },
    opts,
  );
}
