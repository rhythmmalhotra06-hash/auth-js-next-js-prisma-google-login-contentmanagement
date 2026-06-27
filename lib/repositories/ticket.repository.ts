// Ticket repository — Airtable-direct (Prio Requests table). POC scope: list active
// tickets + set status. Expands as the Airtable-direct migration proceeds.

import { TICKETS } from '@/lib/airtable/field-map';
import { listRecords, updateRecord, type AirtableRecord, type AirtableResult } from '@/lib/airtable/rest';

const F = TICKETS.fields;

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

export const TICKET_STATUS_OPTIONS = [
  'Backlog', 'To Do', 'In Progress', 'Review', 'In Revision', 'Approved', 'Done', "Won't Do", 'Shipping', 'Request on Hold',
];
