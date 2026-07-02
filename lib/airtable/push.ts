// Outbound drainer: Postgres tickets → Airtable (the team's editing surface).
//
// Ticket writes enqueue an AirtableOutbox row (by ticketId) in-transaction; this
// drainer pulls pending rows, loads CURRENT ticket state (so rapid successive edits
// collapse to one push), and creates/updates the Prio Requests record. It stamps
// ticket.airtableId (new records) + ticket.airtablePushedAt (echo-suppression window
// for the Phase 3 pull). Gated by AIRTABLE_PUSH_ENABLED; paced + 429-backed-off by
// rest.ts. Trigger via POST /api/sync/push (Kessel internal cron).

import { prisma } from '@/lib/prisma';
import { TICKETS } from './field-map';
import { createRecord, updateRecord } from './rest';
import { ticketToAirtableFields, type TicketForPush } from './push-map';

export interface DrainReport { enabled: boolean; scanned: number; pushed: number; failed: number; errors: string[] }

const pushEnabled = (): boolean => process.env.AIRTABLE_PUSH_ENABLED === 'true';

// Relations the push payload needs — each reference row's airtableId (recId).
const PUSH_INCLUDE = {
  assignee: { select: { airtableId: true } },
  requester: { select: { airtableId: true } },
  eventType: { select: { airtableId: true } },
  assetType: { select: { airtableId: true } },
  officialCalendar: { select: { airtableId: true } },
  authors: { select: { author: { select: { airtableId: true } } } },
  shoots: { select: { shoot: { select: { airtableId: true } } } },
} as const;

type PushRow = {
  id: string;
  airtableId: string | null;
  title: string | null;
  queueRank: number | null;
  projectProgram: string | null;
  creativeBrief: string | null;
  cta: string | null;
  dueDate: Date | null;
  prioStatus: string | null;
  ticketStatus: string | null;
  typeOfRequest: string | null;
  teamServiceLevel: string | null;
  notes: string | null;
  sourceLinks: string | null;
  downloadLink: string | null;
  assetFolderLink: string | null;
  workingFiles: string | null;
  final16x9: string | null;
  folder16x9: string | null;
  final9x16: string | null;
  folder9x16: string | null;
  final4x5: string | null;
  folder4x5: string | null;
  assignee: { airtableId: string | null } | null;
  requester: { airtableId: string | null } | null;
  eventType: { airtableId: string | null } | null;
  assetType: { airtableId: string | null } | null;
  officialCalendar: { airtableId: string | null } | null;
  authors: { author: { airtableId: string | null } | null }[];
  shoots: { shoot: { airtableId: string | null } | null }[];
};

function toPush(t: PushRow): TicketForPush {
  return {
    title: t.title,
    projectProgram: t.projectProgram,
    creativeBrief: t.creativeBrief,
    cta: t.cta,
    dueDate: t.dueDate,
    prioStatus: t.prioStatus,
    ticketStatus: t.ticketStatus,
    typeOfRequest: t.typeOfRequest,
    teamServiceLevel: t.teamServiceLevel,
    notes: t.notes,
    sourceLinks: t.sourceLinks,
    downloadLink: t.downloadLink,
    assetFolderLink: t.assetFolderLink,
    workingFiles: t.workingFiles,
    final16x9: t.final16x9,
    folder16x9: t.folder16x9,
    final9x16: t.final9x16,
    folder9x16: t.folder9x16,
    final4x5: t.final4x5,
    folder4x5: t.folder4x5,
    eventTypeAirtableId: t.eventType?.airtableId ?? null,
    assetTypeAirtableId: t.assetType?.airtableId ?? null,
    assigneeAirtableId: t.assignee?.airtableId ?? null,
    requesterAirtableId: t.requester?.airtableId ?? null,
    officialCalendarAirtableId: t.officialCalendar?.airtableId ?? null,
    authorAirtableIds: t.authors.map((a) => a.author?.airtableId).filter((x): x is string => !!x),
    shootAirtableIds: t.shoots.map((s) => s.shoot?.airtableId).filter((x): x is string => !!x),
    queueRank: t.queueRank,
  };
}

export async function drainOutbox(limit = 100): Promise<DrainReport> {
  if (!pushEnabled()) return { enabled: false, scanned: 0, pushed: 0, failed: 0, errors: [] };

  const rows = await prisma.airtableOutbox.findMany({
    where: { status: 'pending' },
    orderBy: { enqueuedAt: 'asc' },
    take: limit,
  });

  // Collapse rapid successive edits: one push per ticket for its current state.
  const rowsByTicket = new Map<string, string[]>();
  for (const r of rows) {
    const arr = rowsByTicket.get(r.ticketId) ?? [];
    arr.push(r.id);
    rowsByTicket.set(r.ticketId, arr);
  }

  let pushed = 0, failed = 0;
  const errors: string[] = [];

  for (const [ticketId, rowIds] of rowsByTicket) {
    const t = (await prisma.ticket.findUnique({ where: { id: ticketId }, include: PUSH_INCLUDE })) as unknown as PushRow | null;
    if (!t) {
      // Orphaned enqueue (ticket deleted) — clear the rows so they don't wedge the queue.
      await prisma.airtableOutbox.updateMany({ where: { id: { in: rowIds } }, data: { status: 'done', processedAt: new Date() } });
      continue;
    }

    const fields = ticketToAirtableFields(toPush(t));
    const res = t.airtableId
      ? await updateRecord(TICKETS.baseId, TICKETS.tableId, t.airtableId, fields)
      : await createRecord(TICKETS.baseId, TICKETS.tableId, fields);

    if (res.ok) {
      const recId = t.airtableId ?? res.data.id;
      await prisma.$transaction([
        prisma.ticket.update({ where: { id: ticketId }, data: { airtableId: recId, airtablePushedAt: new Date() } }),
        prisma.airtableOutbox.updateMany({ where: { id: { in: rowIds } }, data: { status: 'done', processedAt: new Date() } }),
      ]);
      pushed++;
    } else {
      await prisma.airtableOutbox.updateMany({
        where: { id: { in: rowIds } },
        data: { status: 'error', attempts: { increment: 1 }, lastError: res.error.message },
      });
      errors.push(`${ticketId}: ${res.error.message}`);
      failed++;
    }
  }

  return { enabled: true, scanned: rows.length, pushed, failed, errors };
}
