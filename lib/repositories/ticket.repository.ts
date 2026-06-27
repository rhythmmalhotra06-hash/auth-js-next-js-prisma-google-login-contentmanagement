// Ticket repository — Airtable-direct (Prio Requests table). POC scope: list active
// tickets + set status. Expands as the Airtable-direct migration proceeds.

import { TICKETS } from '@/lib/airtable/field-map';
import { listRecords, createRecord, updateRecord, type AirtableRecord, type AirtableResult } from '@/lib/airtable/rest';

const F = TICKETS.fields;
const L = TICKETS.links;

export interface TicketRow {
  id: string;
  title: string;
  ticketStatus: string | null;
  prioStatus: string | null;
  dueDate: string | null;
  score: number | null;
}

type RawTicket = Record<string, unknown>;

function selectName(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return String(v);
}

function mapTicket(rec: AirtableRecord<RawTicket>): TicketRow {
  const f = rec.fields;
  return {
    id: rec.id,
    title: selectName(f[F.name]) ?? '(untitled)',
    ticketStatus: selectName(f[F.ticketStatus]),
    prioStatus: selectName(f[F.prioStatus]),
    dueDate: typeof f[F.dueDate] === 'string' ? (f[F.dueDate] as string) : null,
    score: typeof f[F.score] === 'number' ? (f[F.score] as number) : null,
  };
}

/** Active tickets (excludes Done / Won't Do), newest-scored first. Capped for the POC. */
export async function listActiveTickets(limit = 50): Promise<AirtableResult<TicketRow[]>> {
  const res = await listRecords<RawTicket>(TICKETS.baseId, TICKETS.tableId, {
    fields: [F.name, F.ticketStatus, F.prioStatus, F.dueDate, F.score],
    filterByFormula: `NOT(OR({Ticket Status} = 'Done', {Ticket Status} = "Won't Do"))`,
    maxRecords: limit,
  });
  if (!res.ok) return res;
  const rows = res.data.records.map(mapTicket).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return { ok: true, data: rows };
}

/** Update a ticket's Ticket Status (the internal/editor axis). */
export async function setTicketStatus(recordId: string, status: string): Promise<AirtableResult<TicketRow>> {
  const res = await updateRecord<RawTicket>(TICKETS.baseId, TICKETS.tableId, recordId, { [F.ticketStatus]: status });
  if (!res.ok) return res;
  return { ok: true, data: mapTicket(res.data) };
}

export interface CreateTicketFields {
  title: string;
  creativeBrief: string;
  cta?: string | null;
  dueDate: string; // YYYY-MM-DD
  typeOfRequest: string;
  teamServiceLevel: string;
  notes?: string | null;
  sourceLinks?: string | null;
  eventTypeRecId: string;
  assetTypeRecId: string;
  requesterRecId: string;
  officialCalendarRecId?: string | null;
  authorRecIds?: string[];
  shootRecIds?: string[];
}

/** Create a ticket directly in the Prio Requests table (link fields = reference recIds). */
export async function createTicket(input: CreateTicketFields): Promise<AirtableResult<{ id: string }>> {
  const fields: Record<string, unknown> = {
    [F.projectProgram]: input.title,
    [F.creativeBrief]: input.creativeBrief,
    [F.dueDate]: input.dueDate,
    [F.created]: new Date().toISOString(), // capture request-created timestamp
    [F.typeOfRequest]: input.typeOfRequest,
    [F.teamServiceLevel]: input.teamServiceLevel,
    [F.prioStatus]: 'New Request',
    [F.ticketStatus]: 'Backlog',
    [L.eventTypes]: [input.eventTypeRecId],
    [L.assetTypes]: [input.assetTypeRecId],
    [L.requestedBy]: [input.requesterRecId],
  };
  if (input.cta) fields[F.cta] = input.cta;
  // "Raw File/URL Links" is a URL-typed field; only write a real URL there, otherwise
  // fold the free text into notes so a non-URL value can't make Airtable reject the create.
  let notes = input.notes?.trim() || '';
  if (input.sourceLinks?.trim()) {
    if (/^https?:\/\//i.test(input.sourceLinks.trim())) fields[F.rawFileUrl] = input.sourceLinks.trim();
    else notes = notes ? `${notes}\n\nSource/links: ${input.sourceLinks.trim()}` : `Source/links: ${input.sourceLinks.trim()}`;
  }
  if (notes) fields[F.notes] = notes;
  if (input.officialCalendarRecId) fields[L.officialCalendar] = [input.officialCalendarRecId];
  if (input.authorRecIds?.length) fields[L.speakers] = input.authorRecIds;
  if (input.shootRecIds?.length) fields[L.shoots] = input.shootRecIds;

  const res = await createRecord(TICKETS.baseId, TICKETS.tableId, fields);
  if (!res.ok) return res;
  return { ok: true, data: { id: res.data.id } };
}

/** Patch arbitrary writable fields on a ticket (status, prio status, links, asset URLs). */
export async function updateTicketFields(id: string, fields: Record<string, unknown>): Promise<AirtableResult<AirtableRecord>> {
  return updateRecord(TICKETS.baseId, TICKETS.tableId, id, fields);
}

export const TICKET_FIELD = F;
export const TICKET_LINK = L;

export const TICKET_STATUS_OPTIONS = [
  'Backlog', 'To Do', 'In Progress', 'Review', 'In Revision', 'Approved', 'Done', "Won't Do", 'Shipping', 'Request on Hold',
];
