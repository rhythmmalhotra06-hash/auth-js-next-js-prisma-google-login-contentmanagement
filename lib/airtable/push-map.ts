// Ticket → Airtable field payload (the inverse of the TICKETS read map).
//
// EXCLUDED on purpose:
//   • name  (fld59SWr…) and score (fldjY4Vf…) are FORMULA fields — writing them
//     400s the whole batch.
//   • queueRank maps to "Priority ranking (Manual)", a RATING field (capped ~1–5);
//     our positional ranks (1…N) overflow it. Queue order is app-owned workflow
//     state and intentionally stays in Postgres (see CLAUDE.md).
//
// Link fields are written as arrays of the linked reference rows' Airtable recIds.

import { TICKETS } from './field-map';

/** Ticket + its reference rows' Airtable recIds, as loaded by the drainer. */
export interface TicketForPush {
  creativeBrief: string | null;
  cta: string | null;
  dueDate: Date | null;
  publishedAt?: Date | null;
  prioStatus: string | null;
  ticketStatus: string | null;
  typeOfRequest: string | null;
  teamServiceLevel: string | null;
  notes: string | null;
  sourceLinks: string | null;
  eventTypeAirtableId: string | null;
  assetTypeAirtableId: string | null;
  assigneeAirtableId: string | null;
  requesterAirtableId: string | null;
  officialCalendarAirtableId: string | null;
  authorAirtableIds: string[];
}

const isoDate = (d: Date | null | undefined): string | null =>
  d ? d.toISOString().slice(0, 10) : null;

export function ticketToAirtableFields(t: TicketForPush): Record<string, unknown> {
  const f = TICKETS.fields;
  const l = TICKETS.links;

  // Non-destructive: only send fields that have a meaningful value, so a push never
  // blanks out something the team set on the Airtable side. (True field-level merge /
  // conflict resolution is Phase 3.)
  const fields: Record<string, unknown> = {};
  const set = (key: string, v: string | null | undefined) => {
    if (v != null && v !== '') fields[key] = v;
  };

  set(f.creativeBrief, t.creativeBrief);
  set(f.cta, t.cta);
  set(f.notes, t.notes);
  set(f.rawFileUrl, t.sourceLinks);
  if (t.dueDate) fields[f.dueDate] = isoDate(t.dueDate);
  if (t.publishedAt) fields[f.publishedAt] = isoDate(t.publishedAt);

  // singleSelect fields — values are reconciled (2026-06-25) to match existing
  // Airtable options.
  set(f.prioStatus, t.prioStatus);
  set(f.ticketStatus, t.ticketStatus);
  set(f.typeOfRequest, t.typeOfRequest);
  set(f.teamServiceLevel, t.teamServiceLevel);

  // Link fields: arrays of reference recIds. Only set when we have the recId, so
  // an un-mirrored reference never blanks an existing Airtable link.
  if (t.eventTypeAirtableId) fields[l.eventTypes] = [t.eventTypeAirtableId];
  if (t.assetTypeAirtableId) fields[l.assetTypes] = [t.assetTypeAirtableId];
  if (t.assigneeAirtableId) fields[l.assignedCreative] = [t.assigneeAirtableId];
  if (t.requesterAirtableId) fields[l.requestedBy] = [t.requesterAirtableId];
  if (t.officialCalendarAirtableId) fields[l.officialCalendar] = [t.officialCalendarAirtableId];
  if (t.authorAirtableIds.length) fields[l.speakers] = t.authorAirtableIds;

  return fields;
}
