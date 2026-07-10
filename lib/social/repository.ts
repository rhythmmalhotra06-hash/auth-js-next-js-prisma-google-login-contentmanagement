// Social clip-suggestions repository — Airtable-direct against the 📣 Social table
// in the Content & Comms base. Mirrors lib/media/repository.ts (typed rows,
// AirtableResult returns, field-id mapping) but for the Marketing surface.
//
// Propose-only on generation: createSocialSuggestions writes "1: Proposal" rows.
// Tickets are created in the Creative Services Prio queue via the app's createTicket
// path (see app/social/actions.ts) — NOT in this base (the local 🎯 Prio table is a
// read-only synced mirror). We store the created ticket's recId in creativeTicketId
// and read its live status from the Creative Services base.

import { SOCIAL as S, TICKETS as T, COMMS_OFFICIAL_CAL as CAL } from '@/lib/airtable/field-map';
import {
  listAll,
  getRecord,
  createRecords,
  updateRecord,
  type AirtableRecord,
  type AirtableResult,
} from '@/lib/airtable/rest';
import type { ReelsClip } from '@/lib/clipping/schema';
import { socialIsPostgres } from '@/lib/social/backend';
import { TICKETS_BACKEND } from '@/lib/tickets/backend';

const SF = S.fields;

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
// First linked record id from an Airtable link field (returns ["recXXX", …]).
const firstLinkId = (v: unknown): string | null =>
  Array.isArray(v) && typeof v[0] === 'string' && v[0] ? v[0] : null;
function selectName(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return String(v);
}

// ── Official Calendar entries (Content & Comms base) ─────────────────────────

export interface CommsCalendarEntry {
  id: string;
  name: string;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
}

/**
 * Calendar entries Glen can tag a clip batch to (📅 Official Cal in the Content & Comms
 * base). Newest start date first; undated last. Powers the /social/new calendar picker.
 */
export async function listCommsCalendarEntries(): Promise<AirtableResult<CommsCalendarEntry[]>> {
  if (socialIsPostgres()) return (await import('@/lib/social/data.postgres')).listCommsCalendarEntries();
  const res = await listAll<Raw>(CAL.baseId, CAL.tableId, {
    fields: [CAL.fields.name, CAL.fields.status, CAL.fields.startDate, CAL.fields.endDate],
  });
  if (!res.ok) return res;
  const rows = res.data
    .map((rec) => {
      const f = rec.fields;
      return {
        id: rec.id,
        name: str(f[CAL.fields.name]) ?? '(untitled)',
        status: selectName(f[CAL.fields.status]),
        startDate: str(f[CAL.fields.startDate]),
        endDate: str(f[CAL.fields.endDate]),
      };
    })
    .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));
  return { ok: true, data: rows };
}

// ── Social suggestions ───────────────────────────────────────────────────────

export interface SocialSuggestion {
  id: string;
  title: string | null;
  notes: string | null;
  captions: string | null;
  status: string | null;
  clipSourceUrl: string | null;
  sourceTitle: string | null; // "author — topic" label; groups clips from the same talk
  viralityScore: number | null;
  timecode: string | null;
  creativeTicketId: string | null; // recId of the ticket in the Creative Services Prio queue
  ticketRaised: boolean;
  createdTime: string;
}

function mapSuggestion(rec: AirtableRecord<Raw>): SocialSuggestion {
  const f = rec.fields;
  const ticketId = str(f[SF.creativeTicketId]);
  return {
    id: rec.id,
    title: str(f[SF.title]),
    notes: str(f[SF.notes]),
    captions: str(f[SF.captions]),
    status: selectName(f[SF.status]),
    clipSourceUrl: str(f[SF.clipSourceUrl]),
    sourceTitle: str(f[SF.sourceTitle]),
    viralityScore: num(f[SF.virality]),
    timecode: str(f[SF.timecode]),
    creativeTicketId: ticketId,
    ticketRaised: !!ticketId,
    createdTime: rec.createdTime,
  };
}

const LIST_FIELDS = [
  SF.title, SF.notes, SF.captions, SF.status, SF.clipSourceUrl, SF.sourceTitle, SF.virality, SF.timecode, SF.creativeTicketId,
];

/**
 * Engine-generated proposals — rows with a non-empty Clip Source URL (our origin
 * marker), newest first. Excludes rejected rows by default (retained for the
 * feedback loop but off the active board).
 */
export async function listSocialSuggestions(opts: { includeRejected?: boolean } = {}): Promise<AirtableResult<SocialSuggestion[]>> {
  if (socialIsPostgres()) return (await import('@/lib/social/data.postgres')).listSocialSuggestions(opts);
  const formula = opts.includeRejected
    ? `NOT({Clip Source URL} = '')`
    : `AND(NOT({Clip Source URL} = ''), {Status} != '${S.status_.reject}')`;
  const res = await listAll<Raw>(S.baseId, S.tableId, { filterByFormula: formula, fields: LIST_FIELDS });
  if (!res.ok) return res;
  const rows = res.data.map(mapSuggestion).sort((a, b) => (a.createdTime < b.createdTime ? 1 : -1));
  return { ok: true, data: rows };
}

export async function getSocialSuggestion(id: string): Promise<AirtableResult<SocialSuggestion>> {
  if (socialIsPostgres()) return (await import('@/lib/social/data.postgres')).getSocialSuggestion(id);
  const res = await getRecord<Raw>(S.baseId, S.tableId, id);
  if (!res.ok) return res;
  return { ok: true, data: mapSuggestion(res.data) };
}

/**
 * Write one Proposal row per clip the engine returned. Status = "1: Proposal";
 * Clip Source URL stamps the origin. No ticket, no asset type yet.
 */
export async function createSocialSuggestions(
  sourceUrl: string,
  sourceTitle: string,
  clips: ReelsClip[],
  opts: { calendarId?: string | null } = {},
): Promise<AirtableResult<{ count: number; ids: string[] }>> {
  if (socialIsPostgres()) return (await import('@/lib/social/write.postgres')).createSocialSuggestions(sourceUrl, sourceTitle, clips, opts);
  const records = clips.map((c) => {
    const timecode = [c.timestampStart, c.timestampEnd].filter(Boolean).join('–');
    const fields: Record<string, unknown> = {
      [SF.title]: c.hookLine,
      [SF.notes]: c.rationale ?? '',
      [SF.captions]: c.caption,
      [SF.status]: S.status_.proposal,
      [SF.clipSourceUrl]: sourceUrl,
      [SF.sourceTitle]: sourceTitle || null,
      [SF.virality]: c.viralityScore,
      [SF.timecode]: timecode,
    };
    // Link the batch to Glen's chosen calendar entry; the "Name of project (from
    // 📅 Official Cal)" lookup on the row then auto-fills with the calendar name.
    if (opts.calendarId) fields[S.links.officialCal] = [opts.calendarId];
    return { fields };
  });
  const res = await createRecords<Raw>(S.baseId, S.tableId, records);
  if (!res.ok) return res;
  return { ok: true, data: { count: res.data.length, ids: res.data.map((r) => r.id) } };
}

/** Approve / reject a suggestion (status only). Reject is retained (not deleted). */
export async function setSocialStatus(id: string, status: 'approved' | 'reject'): Promise<AirtableResult<SocialSuggestion>> {
  if (socialIsPostgres()) return (await import('@/lib/social/write.postgres')).setSocialStatus(id, status);
  const res = await updateRecord<Raw>(S.baseId, S.tableId, id, { [SF.status]: S.status_[status] });
  if (!res.ok) return res;
  return { ok: true, data: mapSuggestion(res.data) };
}

/** Stamp a suggestion as raised: store the Creative Services ticket recId + flip Status. */
export async function markSocialTicketRaised(id: string, ticketId: string): Promise<AirtableResult<SocialSuggestion>> {
  if (socialIsPostgres()) return (await import('@/lib/social/write.postgres')).markSocialTicketRaised(id, ticketId);
  const res = await updateRecord<Raw>(S.baseId, S.tableId, id, {
    [SF.creativeTicketId]: ticketId,
    [SF.status]: S.status_.ticketRaised,
  });
  if (!res.ok) return res;
  return { ok: true, data: mapSuggestion(res.data) };
}

// ── Cross-base ticket status mirror ──────────────────────────────────────────

export interface TicketState {
  prioStatus: string | null;
  ticketStatus: string | null;
  officialCalendarId: string | null; // recId of the linked 📆 Official Calendar, if any
}

/**
 * Read live status for raised clips' tickets from the Creative Services Prio table.
 * One batched query keyed by record id. Returns a map: ticketRecId → state.
 */
export async function getSocialTicketStates(ticketIds: string[]): Promise<Record<string, TicketState>> {
  const ids = [...new Set(ticketIds.filter(Boolean))];
  if (!ids.length) return {};

  // `creativeTicketId` holds whatever createTicket returned — an Airtable recId when
  // TICKETS_BACKEND=airtable, or a PG uuid when =postgres. Read from the matching source so the
  // status resolves in both modes (an Airtable RECORD_ID() query can't match a uuid).
  if (TICKETS_BACKEND === 'postgres') {
    const { prisma } = await import('@/lib/prisma');
    const rows = await prisma.ticket.findMany({
      where: { id: { in: ids } },
      select: { id: true, prioStatus: true, ticketStatus: true, officialCalendar: { select: { airtableId: true } } },
    });
    const pgOut: Record<string, TicketState> = {};
    for (const t of rows) pgOut[t.id] = { prioStatus: t.prioStatus, ticketStatus: t.ticketStatus, officialCalendarId: t.officialCalendar?.airtableId ?? null };
    return pgOut;
  }

  const out: Record<string, TicketState> = {};
  // Batch ≤50 ids per query (the RECORD_ID() OR formula gets unwieldy, and a single
  // page caps at 100 — chunking keeps every raised clip's state resolvable past 100).
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const formula = `OR(${chunk.map((id) => `RECORD_ID() = '${id}'`).join(',')})`;
    const res = await listAll<Raw>(T.baseId, T.tableId, {
      filterByFormula: formula,
      fields: [T.fields.prioStatus, T.fields.ticketStatus, T.links.officialCalendar],
    });
    if (!res.ok) continue;
    for (const rec of res.data) {
      out[rec.id] = {
        prioStatus: selectName(rec.fields[T.fields.prioStatus]),
        ticketStatus: selectName(rec.fields[T.fields.ticketStatus]),
        officialCalendarId: firstLinkId(rec.fields[T.links.officialCalendar]),
      };
    }
  }
  return out;
}
