// Upsert Prio Requests records → Postgres tickets. The shared backbone for both the
// Phase 1 backfill (active set) and the Phase 3 inbound pull (changed records) — so
// there is exactly one mapping of Airtable Prio → the `tickets` table.
//
// Two-pass, mirroring sync.ts: Pass 1 upserts scalars keyed on airtable_id; Pass 2
// resolves link FKs (event/asset type, assignee, requester, calendar) and the
// author join. Reference sync MUST have run first so the link targets exist.

import { TICKETS } from './field-map';

const T = TICKETS.fields;
const TL = TICKETS.links;

type Rec = { id: string; fields: Record<string, unknown> };

function str(v: unknown): string | null {
  if (typeof v === 'string') return v.length ? v : null;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.length ? str(v[0]) : null;
  if (v == null) return null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return String(v);
}
function numVal(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  if (Array.isArray(v) && v.length) return numVal(v[0]);
  return null;
}
function linkIds(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
function dateVal(v: unknown): Date | null {
  return typeof v === 'string' && v ? new Date(v) : null;
}

/** Scalars written in Pass 1 (everything the detail form + queue need, 1:1 with Prio). */
function ticketScalars(r: Rec) {
  const f = r.fields;
  return {
    title: str(f[T.name]) ?? `Ticket ${r.id}`,
    creativeBrief: str(f[T.creativeBrief]),
    cta: str(f[T.cta]),
    dueDate: dateVal(f[T.dueDate]),
    prioStatus: str(f[T.prioStatus]),
    ticketStatus: str(f[T.ticketStatus]),
    queueRank: numVal(f[T.queueRank]),
    priorityScore: numVal(f[T.score]),
    typeOfRequest: str(f[T.typeOfRequest]),
    teamServiceLevel: str(f[T.teamServiceLevel]),
    sourceLinks: str(f[T.rawFileUrl]),
    downloadLink: str(f[T.downloadLink]),
    notes: str(f[T.notes]),
    projectProgram: str(f[T.projectProgram]),
    assetFolderLink: str(f[T.assetFolderLink]),
    workingFiles: str(f[T.workingFiles]),
    final16x9: str(f[T.final16x9]),
    folder16x9: str(f[T.folder16x9]),
    final9x16: str(f[T.final9x16]),
    folder9x16: str(f[T.folder9x16]),
    final4x5: str(f[T.final4x5]),
    folder4x5: str(f[T.folder4x5]),
  };
}

function ticketLinks(r: Rec) {
  const f = r.fields;
  return {
    eventTypes: linkIds(f[TL.eventTypes]),
    assetTypes: linkIds(f[TL.assetTypes]),
    assignedCreative: linkIds(f[TL.assignedCreative]),
    assignedContractor: linkIds(f[TL.assignedContractor]),
    requestedBy: linkIds(f[TL.requestedBy]),
    officialCalendar: linkIds(f[TL.officialCalendar]),
    speakers: linkIds(f[TL.speakers]),
  };
}

export interface UpsertResult { upserted: number; unresolved: number }

/**
 * Upsert the given Prio records into `tickets`, keyed on airtable_id. Idempotent:
 * re-running with the same records converges (no duplicates). Returns how many rows
 * were written and how many had an assignee link we couldn't resolve to an employee.
 */
export async function upsertTicketsFromRecords(records: Rec[]): Promise<UpsertResult> {
  const { prisma } = await import('../prisma');

  // Reference airtable_id → uuid maps (reference tables are already mirrored). Built
  // BEFORE any write so each ticket needs a single upsert with its FKs resolved inline
  // — no second pass. Only the author join needs the ticket to exist (upsert returns id).
  const idMap = async (model: 'employee' | 'eventType' | 'assetType' | 'officialCalendar' | 'author') => {
    const rows = await (prisma[model] as { findMany: (a: unknown) => Promise<{ id: string; airtableId: string | null }[]> }).findMany({ select: { id: true, airtableId: true } });
    return new Map(rows.filter((x) => x.airtableId).map((x) => [x.airtableId as string, x.id]));
  };
  const [empMap, evtMap, atMap, ocMap, auMap] = await Promise.all([
    idMap('employee'), idMap('eventType'), idMap('assetType'), idMap('officialCalendar'), idMap('author'),
  ]);
  const first = (ids: string[], m: Map<string, string>) => ids.map((x) => m.get(x)).find((x): x is string => !!x) ?? null;

  let unresolved = 0;

  // Process in parallel chunks so 10k rows don't run 10k sequential round-trips
  // (which blows the request timeout). CHUNK stays within the pg pool.
  const CHUNK = 10;
  const upsertOne = async (r: Rec) => {
    const s = ticketScalars(r);
    const links = ticketLinks(r);
    const assigneeId = first(links.assignedCreative, empMap) ?? first(links.assignedContractor, empMap);
    if (links.assignedCreative.length && !assigneeId) unresolved++;
    const fks = {
      eventTypeId: first(links.eventTypes, evtMap),
      assetTypeId: first(links.assetTypes, atMap),
      assigneeId,
      requesterId: first(links.requestedBy, empMap),
      officialCalendarId: first(links.officialCalendar, ocMap),
    };
    const t = await prisma.ticket.upsert({
      where: { airtableId: r.id },
      create: { airtableId: r.id, source: 'airtable', ...s, ...fks },
      update: { ...s, ...fks, syncedAt: new Date() },
      select: { id: true },
    });
    const authorIds = links.speakers.map((x) => auMap.get(x)).filter((x): x is string => !!x);
    if (authorIds.length) {
      await prisma.ticketAuthor.deleteMany({ where: { ticketId: t.id } });
      await prisma.ticketAuthor.createMany({ data: authorIds.map((authorId) => ({ ticketId: t.id, authorId })), skipDuplicates: true });
    }
  };

  for (let i = 0; i < records.length; i += CHUNK) {
    await Promise.all(records.slice(i, i + CHUNK).map(upsertOne));
  }

  return { upserted: records.length, unresolved };
}
