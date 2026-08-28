// Airtable-direct ticket writes — the adapter used when TICKETS_BACKEND=airtable.
// Presents the same updateTicket / createTicketRow surface as write.postgres.ts, but
// maps the typed patch onto the existing Airtable repository (writes straight to the
// Prio Requests table; ids are Airtable recIds). See lib/tickets/backend.ts.

import {
  updateTicketFields,
  createTicket as createTicketAirtable,
  TICKET_FIELD as F,
  TICKET_LINK as L,
} from '@/lib/repositories/ticket.repository';
import type { TicketPatch, WriteResult, CreateTicketRowInput } from './write.postgres';
import { TICKETS } from '@/lib/airtable/field-map';

const CERTAINTY = TICKETS.certainty_;

/** App key ("fixed") → Airtable select label ("Fixed launch"). Unknown/blank → null. */
function certaintyLabel(v: string | null | undefined): string | null {
  if (!v) return null;
  return CERTAINTY[v as keyof typeof CERTAINTY] ?? null;
}

// folder16x9/9x16/4x5 and downloadLink are absent: deleted in Airtable (2026-08-28). They stay
// as app-local Postgres columns; see lib/airtable/field-map.ts.
const DELIVERY: [keyof TicketPatch, string][] = [
  ['assetFolderLink', F.assetFolderLink],
  ['workingFiles', F.workingFiles],
  ['final16x9', F.final16x9],
  ['final9x16', F.final9x16],
  ['final4x5', F.final4x5],
];

// `_opts` is accepted for signature parity with the Postgres impl (note/actor feed a
// TicketEvent there); Airtable's built-in revision history covers audit here.
export async function updateTicket(recId: string, patch: TicketPatch, _opts: { note?: string; actorId?: string | null } = {}): Promise<WriteResult> {
  const fields: Record<string, unknown> = {};
  if (patch.ticketStatus !== undefined) fields[F.ticketStatus] = patch.ticketStatus;
  if (patch.prioStatus !== undefined) fields[F.prioStatus] = patch.prioStatus;
  if (patch.notes !== undefined) fields[F.notes] = patch.notes;
  if (patch.queueRank !== undefined) fields[F.queueRank] = patch.queueRank;
  // Stored lowercase app-side, human label in Airtable. An unrecognised value writes
  // null (clears the cell) rather than 400ing the request on an unknown select option.
  if (patch.dateCertainty !== undefined) fields[F.dateCertainty] = certaintyLabel(patch.dateCertainty);
  if (patch.assetReadyNotified !== undefined) fields[F.assetReadyNotified] = patch.assetReadyNotified;
  if (patch.assigneeRecId !== undefined) fields[L.assignedCreative] = patch.assigneeRecId ? [patch.assigneeRecId] : [];
  for (const [k, fid] of DELIVERY) {
    const v = patch[k];
    if (v !== undefined) fields[fid] = v;
  }
  const res = await updateTicketFields(recId, fields);
  if (!res.ok) return { ok: false, error: res.error.message };
  return { ok: true, id: recId };
}

export async function createTicketRow(input: CreateTicketRowInput): Promise<WriteResult> {
  const res = await createTicketAirtable({
    title: input.title,
    creativeBrief: input.creativeBrief,
    cta: input.cta ?? null,
    dueDate: input.dueDate,
    dateCertainty: certaintyLabel(input.dateCertainty),
    typeOfRequest: input.typeOfRequest,
    teamServiceLevel: input.teamServiceLevel,
    notes: input.notes ?? null,
    sourceLinks: input.sourceLinks ?? null,
    eventTypeRecId: input.eventTypeRecId,
    assetTypeRecId: input.assetTypeRecId,
    requesterRecId: input.requesterRecId,
    officialCalendarRecId: input.officialCalendarRecId ?? null,
    authorRecIds: input.authorRecIds,
    shootRecIds: input.shootRecIds,
    assignedCreativeRecId: input.assignedCreativeRecId ?? null,
    ticketStatus: input.ticketStatus,
  });
  if (!res.ok) return { ok: false, error: res.error.message };
  return { ok: true, id: res.data.id };
}
