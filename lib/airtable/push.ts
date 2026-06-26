// Outbox drainer: push pending ticket writes to Airtable. Reads current ticket
// state (so rapid successive edits collapse to one push), batches ≤10/request via
// the client, then records the returned recId + a push timestamp.
//
// Triggered by POST /api/sync/push (bearer-gated), scheduled by a Kessel internal
// job. Best-effort and idempotent: a failed batch leaves its rows pending (with an
// incremented attempt count) for the next run; after MAX_ATTEMPTS a row is parked
// as 'error' so it stops retrying and is visible.

import { prisma } from '@/lib/prisma';
import { TICKETS } from './field-map';
import { createRecords, updateRecords, type NewRecord, type RecordPatch } from './client';
import { ticketToAirtableFields, type TicketForPush } from './push-map';
import { PUSH_ENABLED } from './outbox';

const MAX_ATTEMPTS = 5;
const BATCH = 10; // Airtable write cap

export interface DrainReport {
  enabled: boolean;
  tickets: number;
  created: number;
  updated: number;
  failed: number;
}

const chunk = <T>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};

type LoadedTicket = NonNullable<Awaited<ReturnType<typeof loadTicket>>>;

async function loadTicket(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    select: {
      id: true, airtableId: true,
      creativeBrief: true, cta: true, dueDate: true, notes: true, sourceLinks: true,
      prioStatus: true, ticketStatus: true, typeOfRequest: true, teamServiceLevel: true,
      eventType: { select: { airtableId: true } },
      assetType: { select: { airtableId: true } },
      assignee: { select: { airtableId: true } },
      requester: { select: { airtableId: true } },
      officialCalendar: { select: { airtableId: true } },
      authors: { select: { author: { select: { airtableId: true } } } },
    },
  });
}

function toPushFields(t: LoadedTicket): Record<string, unknown> {
  const shape: TicketForPush = {
    creativeBrief: t.creativeBrief,
    cta: t.cta,
    dueDate: t.dueDate,
    notes: t.notes,
    sourceLinks: t.sourceLinks,
    prioStatus: t.prioStatus,
    ticketStatus: t.ticketStatus,
    typeOfRequest: t.typeOfRequest,
    teamServiceLevel: t.teamServiceLevel,
    eventTypeAirtableId: t.eventType?.airtableId ?? null,
    assetTypeAirtableId: t.assetType?.airtableId ?? null,
    assigneeAirtableId: t.assignee?.airtableId ?? null,
    requesterAirtableId: t.requester?.airtableId ?? null,
    officialCalendarAirtableId: t.officialCalendar?.airtableId ?? null,
    authorAirtableIds: t.authors.map((a) => a.author?.airtableId).filter((x): x is string => !!x),
  };
  return ticketToAirtableFields(shape);
}

/** Mark all outbox rows for the given tickets as done, and stamp the push time. */
async function markDone(ticketIds: string[], rowIdsByTicket: Map<string, string[]>) {
  const rowIds = ticketIds.flatMap((id) => rowIdsByTicket.get(id) ?? []);
  const now = new Date();
  await prisma.$transaction([
    prisma.airtableOutbox.updateMany({ where: { id: { in: rowIds } }, data: { status: 'done', processedAt: now } }),
    prisma.ticket.updateMany({ where: { id: { in: ticketIds } }, data: { airtablePushedAt: now } }),
  ]);
}

/** Record a failure against a group of tickets (retry until MAX_ATTEMPTS, then park). */
async function markFailed(ticketIds: string[], rowIdsByTicket: Map<string, string[]>, err: unknown) {
  const rowIds = ticketIds.flatMap((id) => rowIdsByTicket.get(id) ?? []);
  const message = err instanceof Error ? err.message : String(err);
  // Park rows that have exhausted retries; bump the rest.
  await prisma.airtableOutbox.updateMany({
    where: { id: { in: rowIds }, attempts: { gte: MAX_ATTEMPTS - 1 } },
    data: { status: 'error', lastError: message, attempts: { increment: 1 } },
  });
  await prisma.airtableOutbox.updateMany({
    where: { id: { in: rowIds }, status: 'pending' },
    data: { lastError: message, attempts: { increment: 1 } },
  });
}

export async function drainOutbox(limit = 200): Promise<DrainReport> {
  if (!PUSH_ENABLED) return { enabled: false, tickets: 0, created: 0, updated: 0, failed: 0 };

  const rows = await prisma.airtableOutbox.findMany({
    where: { status: 'pending' },
    orderBy: { enqueuedAt: 'asc' },
    take: limit,
    select: { id: true, ticketId: true },
  });
  if (rows.length === 0) return { enabled: true, tickets: 0, created: 0, updated: 0, failed: 0 };

  // Collapse to distinct tickets; keep all row ids so we can resolve them together.
  const rowIdsByTicket = new Map<string, string[]>();
  for (const r of rows) {
    const list = rowIdsByTicket.get(r.ticketId) ?? [];
    list.push(r.id);
    rowIdsByTicket.set(r.ticketId, list);
  }

  // Load current state and split into creates (no recId yet) vs updates.
  const creates: { ticketId: string; rec: NewRecord }[] = [];
  const updates: { ticketId: string; rec: RecordPatch }[] = [];
  for (const ticketId of rowIdsByTicket.keys()) {
    const t = await loadTicket(ticketId);
    if (!t) { // ticket gone — clear its rows so they don't loop forever
      await prisma.airtableOutbox.updateMany({ where: { id: { in: rowIdsByTicket.get(ticketId)! } }, data: { status: 'done', lastError: 'ticket deleted', processedAt: new Date() } });
      continue;
    }
    const fields = toPushFields(t);
    if (t.airtableId) updates.push({ ticketId, rec: { id: t.airtableId, fields } });
    else creates.push({ ticketId, rec: { fields } });
  }

  let created = 0, updated = 0, failed = 0;

  // Creates — store the returned recId on each ticket, then mark done.
  for (const group of chunk(creates, BATCH)) {
    try {
      const result = await createRecords(TICKETS.baseId, TICKETS.tableId, group.map((g) => g.rec));
      await prisma.$transaction(
        group.map((g, i) => prisma.ticket.update({ where: { id: g.ticketId }, data: { airtableId: result[i].id } })),
      );
      await markDone(group.map((g) => g.ticketId), rowIdsByTicket);
      created += group.length;
    } catch (err) {
      await markFailed(group.map((g) => g.ticketId), rowIdsByTicket, err);
      failed += group.length;
    }
  }

  // Updates.
  for (const group of chunk(updates, BATCH)) {
    try {
      await updateRecords(TICKETS.baseId, TICKETS.tableId, group.map((g) => g.rec));
      await markDone(group.map((g) => g.ticketId), rowIdsByTicket);
      updated += group.length;
    } catch (err) {
      await markFailed(group.map((g) => g.ticketId), rowIdsByTicket, err);
      failed += group.length;
    }
  }

  return { enabled: true, tickets: rowIdsByTicket.size, created, updated, failed };
}
