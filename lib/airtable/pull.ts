// Inbound pull: Airtable → Postgres for TICKETS. Closes the two-way loop so a
// Mindvalley editor's Airtable ticket edit reaches the portal. Incremental via the
// "App Last Modified (sync)" cursor; guarded against ping-pong with our own pushes.
//
// The generic cursor/fetch/advance machinery lives in pull-core.ts; this file is the
// ticket domain: its cursor field, filter format, and the echo/conflict importer.
//
// Conflict model (record-level last-writer-wins, per the plan):
//   • ECHO — incoming modified time within ~90s AFTER ticket.airtablePushedAt → skip
//     (it's our own drainer write reflecting back).
//   • Airtable newer than ticket.updatedAt → import (+ an "updated from Airtable" event).
//   • Portal newer → skip and re-enqueue a push to re-assert our state.
//
// The mapping reuses upsertTicketsFromRecords (same backbone as the backfill), so
// there is exactly one Airtable-Prio → tickets mapping.

import { prisma } from '@/lib/prisma';
import { TICKETS } from './field-map';
import { type AirtableRecord } from './rest';
import { upsertTicketsFromRecords } from './ticket-upsert';
import { runPull, type PullReport, type PullStats } from './pull-core';

export const TICKET_PULL_CURSOR = 'ticket_pull_cursor';
const F = TICKETS.fields;
const ECHO_WINDOW_MS = 90_000;

// Field emits 'YYYY-MM-DD HH:mm:ss' in UTC (see field-map). Parse to a Date.
function parseTs(v: unknown): Date | null {
  if (typeof v !== 'string' || !v) return null;
  const d = new Date(`${v.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function statusOf(v: unknown): string | null {
  const raw = (v as Record<string, unknown>)?.[F.ticketStatus];
  if (typeof raw === 'string') return raw || null;
  if (raw && typeof raw === 'object' && 'name' in raw) return String((raw as { name: unknown }).name);
  return null;
}

async function importTicketRecords(records: AirtableRecord[]): Promise<PullStats> {
  const recIds = records.map((r) => r.id);
  const existing = recIds.length
    ? await prisma.ticket.findMany({ where: { airtableId: { in: recIds } }, select: { id: true, airtableId: true, updatedAt: true, airtablePushedAt: true } })
    : [];
  const byRec = new Map(existing.map((t) => [t.airtableId as string, t]));

  const toImport: AirtableRecord[] = [];
  const provenance: { pgId: string; status: string | null }[] = [];
  const reassert: string[] = [];
  let echoSkipped = 0, conflictSkipped = 0;

  for (const r of records) {
    const rawMod = typeof r.fields[F.lastModified] === 'string' ? (r.fields[F.lastModified] as string) : null;
    const mod = parseTs(rawMod);
    const pg = byRec.get(r.id);

    if (!pg) { toImport.push(r); continue; } // new to us → import
    if (!mod) { toImport.push(r); continue; } // no timestamp → import to be safe

    if (pg.airtablePushedAt && mod.getTime() <= pg.airtablePushedAt.getTime() + ECHO_WINDOW_MS) {
      echoSkipped++; // our own push echoing back
      continue;
    }
    if (mod.getTime() > pg.updatedAt.getTime()) {
      toImport.push(r);
      provenance.push({ pgId: pg.id, status: statusOf(r.fields) });
    } else {
      conflictSkipped++; // portal state is newer — re-assert it to Airtable
      reassert.push(pg.id);
    }
  }

  if (toImport.length) await upsertTicketsFromRecords(toImport);

  // Provenance events for existing tickets overwritten from Airtable.
  if (provenance.length) {
    await prisma.ticketEvent.createMany({
      data: provenance.map((p) => ({ ticketId: p.pgId, toState: p.status ?? 'Updated', note: 'updated from Airtable' })),
    });
  }
  // Re-assert portal-newer records via the outbox (drainer will push them).
  if (reassert.length) {
    await prisma.airtableOutbox.createMany({ data: reassert.map((id) => ({ entity: 'ticket', entityId: id, op: 'upsert' })) });
  }

  return { imported: toImport.length, echoSkipped, conflictSkipped };
}

export async function pullTickets(opts: { fullResync?: boolean } = {}): Promise<PullReport> {
  return runPull(
    {
      cursorKey: TICKET_PULL_CURSOR,
      baseId: TICKETS.baseId,
      tableId: TICKETS.tableId,
      // DATETIME_PARSE both sides so the formatted-string field compares as a real datetime.
      // No cursor → undefined (full scan).
      buildFilter: (since) =>
        since ? `IS_AFTER(DATETIME_PARSE({App Last Modified (sync)}, 'YYYY-MM-DD HH:mm:ss'), DATETIME_PARSE("${since}", 'YYYY-MM-DD HH:mm:ss'))` : undefined,
      rawModified: (r) => (typeof r.fields[F.lastModified] === 'string' ? (r.fields[F.lastModified] as string) : null),
      importRecords: importTicketRecords,
    },
    opts,
  );
}
