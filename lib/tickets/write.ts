// Ticket writes — Postgres is the system of record. Every write runs in a
// $transaction that (a) mutates the PG row, (b) appends a TicketEvent on a status
// change (audit trail), and (c) enqueues an AirtableOutbox row so the background
// drainer mirrors current state back to Airtable (the team's editing surface).
//
// Reference links arrive as Airtable recIds (the ids the intake form + pickers use);
// we resolve them to PG uuids via each row's airtableId. If a brand-new reference
// isn't mirrored yet, we run a reference sync once and retry (safety net).

import { prisma } from '@/lib/prisma';
import { syncReference } from '@/lib/airtable/sync';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RefModel = 'eventType' | 'assetType' | 'employee' | 'officialCalendar' | 'author' | 'shoot';

async function uuidByAirtableId(model: RefModel, recId: string | null | undefined): Promise<string | null> {
  if (!recId) return null;
  const row = await (prisma[model] as { findUnique: (a: unknown) => Promise<{ id: string } | null> }).findUnique({
    where: { airtableId: recId }, select: { id: true },
  });
  return row?.id ?? null;
}

export type WriteResult = { ok: true; id: string } | { ok: false; error: string };

/** Delivery-link columns that map 1:1 to Prio fields (editable on the detail form). */
const DELIVERY_KEYS = ['assetFolderLink', 'workingFiles', 'final16x9', 'folder16x9', 'final9x16', 'folder9x16', 'final4x5', 'folder4x5'] as const;
type DeliveryKey = (typeof DELIVERY_KEYS)[number];

export interface TicketPatch {
  ticketStatus?: string;
  prioStatus?: string;
  assigneeRecId?: string | null; // Airtable Employees recId; null clears
  notes?: string;
  queueRank?: number;
  assetReadyNotified?: boolean;
  // delivery links
  assetFolderLink?: string;
  workingFiles?: string;
  final16x9?: string;
  folder16x9?: string;
  final9x16?: string;
  folder9x16?: string;
  final4x5?: string;
  folder4x5?: string;
}

/**
 * Patch a ticket (by PG uuid or Airtable recId) in Postgres, appending a status
 * TicketEvent when the ticket_status changes and enqueuing an Airtable push.
 */
export async function updateTicket(idOrRec: string, patch: TicketPatch, opts: { note?: string; actorId?: string | null } = {}): Promise<WriteResult> {
  const where = UUID_RE.test(idOrRec) ? { id: idOrRec } : { airtableId: idOrRec };
  const current = await prisma.ticket.findFirst({ where, select: { id: true, ticketStatus: true } });
  if (!current) return { ok: false, error: 'Ticket not found' };

  const data: Record<string, unknown> = {};
  if (patch.ticketStatus !== undefined) data.ticketStatus = patch.ticketStatus;
  if (patch.prioStatus !== undefined) data.prioStatus = patch.prioStatus;
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.queueRank !== undefined) data.queueRank = patch.queueRank;
  if (patch.assetReadyNotified !== undefined) data.assetReadyNotified = patch.assetReadyNotified;
  for (const k of DELIVERY_KEYS) {
    if (patch[k as DeliveryKey] !== undefined) data[k] = patch[k as DeliveryKey];
  }
  if (patch.assigneeRecId !== undefined) {
    data.assigneeId = await uuidByAirtableId('employee', patch.assigneeRecId);
  }

  const statusChanged = patch.ticketStatus !== undefined && patch.ticketStatus !== current.ticketStatus;

  await prisma.$transaction([
    prisma.ticket.update({ where: { id: current.id }, data }),
    ...(statusChanged
      ? [prisma.ticketEvent.create({ data: { ticketId: current.id, fromState: current.ticketStatus, toState: patch.ticketStatus as string, note: opts.note ?? null, actorId: opts.actorId ?? null } })]
      : []),
    prisma.airtableOutbox.create({ data: { ticketId: current.id, op: 'upsert' } }),
  ]);
  return { ok: true, id: current.id };
}

export interface CreateTicketRowInput {
  title: string;
  creativeBrief: string;
  cta?: string | null;
  dueDate: string; // YYYY-MM-DD
  typeOfRequest: string;
  teamServiceLevel: string;
  notes?: string | null;
  sourceLinks?: string | null;
  downloadLink?: string | null;
  eventTypeRecId: string;
  assetTypeRecId: string;
  requesterRecId: string;
  officialCalendarRecId?: string | null;
  authorRecIds?: string[];
  shootRecIds?: string[];
  assignedCreativeRecId?: string | null;
  ticketStatus?: string;
}

/** Create a ticket in Postgres (resolving reference recIds→uuids), seed its first
 *  event, and enqueue an Airtable push. Returns the new PG uuid. */
export async function createTicketRow(input: CreateTicketRowInput): Promise<WriteResult> {
  const resolve = async () => ({
    eventTypeId: await uuidByAirtableId('eventType', input.eventTypeRecId),
    assetTypeId: await uuidByAirtableId('assetType', input.assetTypeRecId),
    requesterId: await uuidByAirtableId('employee', input.requesterRecId),
    officialCalendarId: input.officialCalendarRecId ? await uuidByAirtableId('officialCalendar', input.officialCalendarRecId) : null,
    assigneeId: input.assignedCreativeRecId ? await uuidByAirtableId('employee', input.assignedCreativeRecId) : null,
  });
  let refs = await resolve();
  if (!refs.eventTypeId || !refs.assetTypeId || !refs.requesterId) {
    // A reference chosen at intake isn't mirrored yet — sync once, then retry.
    await syncReference({});
    refs = await resolve();
  }
  if (!refs.eventTypeId || !refs.assetTypeId || !refs.requesterId) {
    return { ok: false, error: 'Reference data not synced for this request; try again shortly' };
  }

  const authorIds = (await Promise.all((input.authorRecIds ?? []).map((r) => uuidByAirtableId('author', r)))).filter((x): x is string => !!x);
  const shootIds = (await Promise.all((input.shootRecIds ?? []).map((r) => uuidByAirtableId('shoot', r)))).filter((x): x is string => !!x);

  // Mirror the old Airtable-direct guard: only a real URL goes to source_links; other
  // free text folds into notes so it can't break anything downstream.
  let notes = input.notes?.trim() || '';
  let sourceLinks: string | null = null;
  const sl = input.sourceLinks?.trim();
  if (sl) {
    if (/^https?:\/\//i.test(sl)) sourceLinks = sl;
    else notes = notes ? `${notes}\n\nSource/links: ${sl}` : `Source/links: ${sl}`;
  }
  const downloadLink = input.downloadLink && /^https?:\/\//i.test(input.downloadLink) ? input.downloadLink : null;
  const ticketStatus = input.ticketStatus ?? 'Backlog';

  const created = await prisma.ticket.create({
    data: {
      title: input.title,
      projectProgram: input.title,
      creativeBrief: input.creativeBrief,
      cta: input.cta ?? null,
      dueDate: new Date(input.dueDate),
      typeOfRequest: input.typeOfRequest,
      teamServiceLevel: input.teamServiceLevel,
      prioStatus: 'New Request',
      ticketStatus,
      notes: notes || null,
      sourceLinks,
      downloadLink,
      source: 'app',
      eventTypeId: refs.eventTypeId,
      assetTypeId: refs.assetTypeId,
      requesterId: refs.requesterId,
      officialCalendarId: refs.officialCalendarId,
      assigneeId: refs.assigneeId,
      authors: authorIds.length ? { create: authorIds.map((authorId) => ({ authorId })) } : undefined,
      shoots: shootIds.length ? { create: shootIds.map((shootId) => ({ shootId })) } : undefined,
    },
  });

  await prisma.$transaction([
    prisma.ticketEvent.create({ data: { ticketId: created.id, toState: ticketStatus, note: 'created', actorId: refs.requesterId } }),
    prisma.airtableOutbox.create({ data: { ticketId: created.id, op: 'upsert' } }),
  ]);

  return { ok: true, id: created.id };
}
