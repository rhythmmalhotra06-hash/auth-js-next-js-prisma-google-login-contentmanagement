// Inbound pull: Airtable → Postgres for 🗓️ Comms Calendar (the DAY-LEVEL calendar).
//
// Same conflict model as tickets/shoots/social: last-writer-wins on Airtable's own
// lastModifiedTime, a ~90s echo window so our own push doesn't ping-pong back, and a
// re-assert through the outbox when PG is the newer side.
//
// Cursor is the native `Last Modified` (lastModifiedTime) field, whose ISO values are
// fixed-width and sort chronologically — the format pull-core requires. Do NOT mix it with
// the "YYYY-MM-DD HH:mm:ss" formula format the ticket/social domains use.
//
// No row filter: unlike 📣 Social (where an origin marker keeps the team's manual rows out of
// PG) every row of this calendar is in scope — it IS the calendar.

import { prisma } from '@/lib/prisma';
import { COMMS_DAY } from './field-map';
import { type AirtableRecord } from './rest';
import { upsertCommsDaysFromRecords } from './comms-day-upsert';
import { runPull, type PullReport, type PullStats } from './pull-core';

export const COMMS_DAYS_PULL_CURSOR = 'comms_days_pull_cursor';
const ECHO_WINDOW_MS = 90_000;

const rawModified = (r: AirtableRecord): string | null =>
  typeof r.fields[COMMS_DAY.lastModified] === 'string' ? (r.fields[COMMS_DAY.lastModified] as string) : null;

function parseTs(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function importCommsDayRecords(records: AirtableRecord[]): Promise<PullStats> {
  const recIds = records.map((r) => r.id);
  const existing = recIds.length
    ? await prisma.commsDay.findMany({
        where: { airtableId: { in: recIds } },
        select: { id: true, airtableId: true, updatedAt: true, airtablePushedAt: true },
      })
    : [];
  const byRec = new Map(existing.map((c) => [c.airtableId as string, c]));

  const toImport: AirtableRecord[] = [];
  const reassert: string[] = [];
  let echoSkipped = 0;
  let conflictSkipped = 0;

  for (const r of records) {
    const mod = parseTs(rawModified(r));
    const pg = byRec.get(r.id);

    if (!pg || !mod) { toImport.push(r); continue; }

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

  if (toImport.length) await upsertCommsDaysFromRecords(toImport);
  if (reassert.length) {
    await prisma.airtableOutbox.createMany({
      data: reassert.map((id) => ({ entity: 'commsDay', entityId: id, op: 'upsert' })),
    });
  }

  return { imported: toImport.length, echoSkipped, conflictSkipped };
}

export async function pullCommsDays(opts: { fullResync?: boolean } = {}): Promise<PullReport> {
  return runPull(
    {
      cursorKey: COMMS_DAYS_PULL_CURSOR,
      baseId: COMMS_DAY.baseId,
      tableId: COMMS_DAY.tableId,
      // `Last Modified` is a native lastModifiedTime field, so IS_AFTER can compare it directly
      // — no DATETIME_PARSE round-trip like the formula-backed ticket/social cursors need.
      buildFilter: (since) => (since ? `IS_AFTER({Last Modified}, "${since}")` : undefined),
      rawModified,
      importRecords: importCommsDayRecords,
    },
    opts,
  );
}
