// Upsert Prio Requests records → Postgres tickets. The shared backbone for both the
// Phase 1 backfill (active set) and the Phase 3 inbound pull (changed records) — so
// there is exactly one mapping of Airtable Prio → the `tickets` table.
//
// Two-pass, mirroring sync.ts: Pass 1 upserts scalars keyed on airtable_id; Pass 2
// resolves link FKs (event/asset type, assignee, requester, calendar) and the
// author join. Reference sync MUST have run first so the link targets exist.

import { TICKETS } from './field-map';
import { asDateCertainty } from '@/lib/tickets/scoring';

const T = TICKETS.fields;
const TL = TICKETS.links;
const CERTAINTY = TICKETS.certainty_;

// Airtable label ("Fixed launch") → the app's stored key ("fixed"). Unknown or blank
// labels stay null, which the scorer reads as 'target'.
function certaintyVal(v: unknown): string | null {
  const label = typeof v === 'string' ? v.trim() : null;
  if (!label) return null;
  const hit = (Object.keys(CERTAINTY) as (keyof typeof CERTAINTY)[]).find((k) => CERTAINTY[k] === label);
  return hit ?? asDateCertainty(label);
}

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
    dateCertainty: certaintyVal(f[T.dateCertainty]),
    prioStatus: str(f[T.prioStatus]),
    ticketStatus: str(f[T.ticketStatus]),
    queueRank: numVal(f[T.queueRank]),
    priorityScore: numVal(f[T.score]),
    typeOfRequest: str(f[T.typeOfRequest]),
    teamServiceLevel: str(f[T.teamServiceLevel]),
    sourceLinks: str(f[T.rawFileUrl]),
    notes: str(f[T.notes]),
    projectProgram: str(f[T.projectProgram]),
    // Deliberately absent: folder16x9/9x16/4x5 and downloadLink. Those Airtable fields were
    // deleted (2026-08-28), and reading a missing field yields undefined -> null, which the
    // upsert then wrote over the real Postgres value. Omitting them leaves the columns alone.
    assetFolderLink: str(f[T.assetFolderLink]),
    workingFiles: str(f[T.workingFiles]),
    final16x9: str(f[T.final16x9]),
    final9x16: str(f[T.final9x16]),
    final4x5: str(f[T.final4x5]),
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

export interface UpsertResult { upserted: number; unresolved: number; assigneePreserved: number }

/**
 * Attribution is append-only from the pull's point of view: a pull may SET an assignee but
 * never CLEAR one. 👬 Employees is synced from HR, so an offboarded person's row is deleted
 * and every "Assigned Creative" link pointing at it blanks — indistinguishable from a
 * deliberate un-assign, and far more common. Preserving is the safe side of that ambiguity;
 * un-assigning is done in the app (`write.postgres.ts`), which clears the column directly.
 *
 * Returns the `assigneeId`/`assigneeName` to merge into the UPDATE payload — `{}` when the
 * incoming record resolves to nobody, so Prisma leaves the existing values untouched.
 */
function assigneeUpdate(assigneeId: string | null, assigneeName: string | null) {
  return assigneeId ? { assigneeId, assigneeName } : {};
}

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
  const [empMap, evtMap, atMap, ocMap, auMap, empNames] = await Promise.all([
    idMap('employee'), idMap('eventType'), idMap('assetType'), idMap('officialCalendar'), idMap('author'),
    employeeNameMap(),
  ]);
  const first = (ids: string[], m: Map<string, string>) => ids.map((x) => m.get(x)).find((x): x is string => !!x) ?? null;

  // Who we already have credited, so we can report how often the pull tried to blank an
  // assignee (a deleted HR row) instead of silently swallowing it. One query per batch.
  const existingAssignee = new Map(
    (await prisma.ticket.findMany({
      where: { airtableId: { in: records.map((r) => r.id) } },
      select: { airtableId: true, assigneeId: true },
    })).map((t) => [t.airtableId as string, t.assigneeId]),
  );

  let unresolved = 0;
  let assigneePreserved = 0;

  // Process in parallel chunks so 10k rows don't run 10k sequential round-trips
  // (which blows the request timeout). CHUNK stays within the pg pool.
  const CHUNK = 10;
  const upsertOne = async (r: Rec) => {
    const s = ticketScalars(r);
    const links = ticketLinks(r);
    const assigneeId = first(links.assignedCreative, empMap) ?? first(links.assignedContractor, empMap);
    if (links.assignedCreative.length && !assigneeId) unresolved++;
    if (!assigneeId && existingAssignee.get(r.id)) assigneePreserved++;
    const assigneeName = assigneeId ? empNames.get(assigneeId) ?? null : null;
    const fks = {
      eventTypeId: first(links.eventTypes, evtMap),
      assetTypeId: first(links.assetTypes, atMap),
      requesterId: first(links.requestedBy, empMap),
      officialCalendarId: first(links.officialCalendar, ocMap),
    };
    const t = await prisma.ticket.upsert({
      where: { airtableId: r.id },
      create: { airtableId: r.id, source: 'airtable', ...s, ...fks, assigneeId, assigneeName },
      update: { ...s, ...fks, ...assigneeUpdate(assigneeId, assigneeName), syncedAt: new Date() },
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

  return { upserted: records.length, unresolved, assigneePreserved };
}

/** uuid → employee name, for the `assignee_name` attribution snapshot. */
async function employeeNameMap(): Promise<Map<string, string>> {
  const { prisma } = await import('../prisma');
  const rows = await prisma.employee.findMany({ select: { id: true, name: true } });
  return new Map(rows.map((e) => [e.id, e.name]));
}

// Reference airtable_id → uuid maps, built ONCE and reused across backfill pages so a
// streaming backfill doesn't re-fetch them per page.
export interface TicketRefMaps {
  empMap: Map<string, string>;
  evtMap: Map<string, string>;
  atMap: Map<string, string>;
  ocMap: Map<string, string>;
  auMap: Map<string, string>;
  empNames: Map<string, string>; // employee uuid → name, for the assignee_name snapshot
}

export async function buildTicketRefMaps(): Promise<TicketRefMaps> {
  const { prisma } = await import('../prisma');
  const idMap = async (model: 'employee' | 'eventType' | 'assetType' | 'officialCalendar' | 'author') => {
    const rows = await (prisma[model] as { findMany: (a: unknown) => Promise<{ id: string; airtableId: string | null }[]> }).findMany({ select: { id: true, airtableId: true } });
    return new Map(rows.filter((x) => x.airtableId).map((x) => [x.airtableId as string, x.id]));
  };
  const [empMap, evtMap, atMap, ocMap, auMap, empNames] = await Promise.all([
    idMap('employee'), idMap('eventType'), idMap('assetType'), idMap('officialCalendar'), idMap('author'),
    employeeNameMap(),
  ]);
  return { empMap, evtMap, atMap, ocMap, auMap, empNames };
}

/**
 * BULK insert ONE batch of records (a backfill page) with the given ref maps. A few
 * multi-row INSERTs, not one round-trip per ticket — essential cross-region (app
 * us-central1 ↔ DB asia-southeast1). The backfill calls this per Airtable page so memory
 * stays bounded (streaming) — loading all ~10k at once OOM'd the container (503).
 * Insert-only (skipDuplicates): PG is empty at cutover; ongoing edits come via the pull.
 */
export async function insertTicketRecords(records: Rec[], maps: TicketRefMaps): Promise<UpsertResult> {
  const { prisma } = await import('../prisma');
  const { empMap, evtMap, atMap, ocMap, auMap, empNames } = maps;
  const first = (ids: string[], m: Map<string, string>) => ids.map((x) => m.get(x)).find((x): x is string => !!x) ?? null;

  let unresolved = 0;
  const rows = records.map((r) => {
    const links = ticketLinks(r);
    const assigneeId = first(links.assignedCreative, empMap) ?? first(links.assignedContractor, empMap);
    if (links.assignedCreative.length && !assigneeId) unresolved++;
    return {
      airtableId: r.id,
      source: 'airtable',
      ...ticketScalars(r),
      eventTypeId: first(links.eventTypes, evtMap),
      assetTypeId: first(links.assetTypes, atMap),
      assigneeId,
      assigneeName: assigneeId ? empNames.get(assigneeId) ?? null : null,
      requesterId: first(links.requestedBy, empMap),
      officialCalendarId: first(links.officialCalendar, ocMap),
    };
  });

  // Chunk to stay well under Postgres's 65k bind-param limit (≈22 cols × 500 = 11k).
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await prisma.ticket.createMany({ data: rows.slice(i, i + CHUNK), skipDuplicates: true });
  }

  // Author joins need the new ticket uuids — one lookup, then one bulk insert (this batch only).
  const created = await prisma.ticket.findMany({
    where: { airtableId: { in: records.map((r) => r.id) } },
    select: { id: true, airtableId: true },
  });
  const tkMap = new Map(created.map((t) => [t.airtableId as string, t.id]));
  const authorPairs: { ticketId: string; authorId: string }[] = [];
  for (const r of records) {
    const tkId = tkMap.get(r.id);
    if (!tkId) continue;
    for (const rid of ticketLinks(r).speakers) {
      const aid = auMap.get(rid);
      if (aid) authorPairs.push({ ticketId: tkId, authorId: aid });
    }
  }
  for (let i = 0; i < authorPairs.length; i += CHUNK) {
    await prisma.ticketAuthor.createMany({ data: authorPairs.slice(i, i + CHUNK), skipDuplicates: true });
  }

  // Insert-only, so nothing existing can be blanked — no assignee to preserve.
  return { upserted: rows.length, unresolved, assigneePreserved: 0 };
}
