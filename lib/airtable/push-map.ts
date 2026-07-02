// Ticket → Airtable field payload (the inverse of the TICKETS read map).
//
// EXCLUDED on purpose:
//   • name  (fld59SWr…) and score (fldjY4Vf…) are FORMULA fields — writing them
//     400s the whole batch.
//
// queueRank IS pushed: in this app it's Vishen's 1–5 manual priority RATING (not a
// positional 1…N order), so it fits the "Priority ranking (Manual)" rating field and
// is genuinely two-way (set in the portal → mirrored to Airtable). Guarded to 1–5.
//
// Link fields are written as arrays of the linked reference rows' Airtable recIds.

import { TICKETS } from './field-map';

/** Ticket + its reference rows' Airtable recIds, as loaded by the drainer. */
export interface TicketForPush {
  title: string | null;
  projectProgram: string | null;
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
  downloadLink: string | null;
  assetFolderLink: string | null;
  workingFiles: string | null;
  final16x9: string | null;
  folder16x9: string | null;
  final9x16: string | null;
  folder9x16: string | null;
  final4x5: string | null;
  folder4x5: string | null;
  eventTypeAirtableId: string | null;
  assetTypeAirtableId: string | null;
  assigneeAirtableId: string | null;
  requesterAirtableId: string | null;
  officialCalendarAirtableId: string | null;
  authorAirtableIds: string[];
  shootAirtableIds: string[];
  queueRank: number | null;
}

const isoDate = (d: Date | null | undefined): string | null =>
  d ? d.toISOString().slice(0, 10) : null;

const isUrl = (v: string | null | undefined): boolean => !!v && /^https?:\/\//i.test(v);

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
  // URL-typed Airtable fields reject non-URL strings (400s the batch) — guard them.
  const setUrl = (key: string, v: string | null | undefined) => {
    if (isUrl(v)) fields[key] = v;
  };

  set(f.projectProgram, t.projectProgram ?? t.title);
  set(f.creativeBrief, t.creativeBrief);
  set(f.cta, t.cta);
  set(f.notes, t.notes);
  setUrl(f.rawFileUrl, t.sourceLinks);
  setUrl(f.downloadLink, t.downloadLink);
  if (t.dueDate) fields[f.dueDate] = isoDate(t.dueDate);
  if (t.publishedAt) fields[f.publishedAt] = isoDate(t.publishedAt);

  // Delivery links — final_* are singleLineText (any string); folder_* are url-typed.
  set(f.assetFolderLink, t.assetFolderLink);
  set(f.workingFiles, t.workingFiles);
  set(f.final16x9, t.final16x9);
  set(f.final9x16, t.final9x16);
  set(f.final4x5, t.final4x5);
  setUrl(f.folder16x9, t.folder16x9);
  setUrl(f.folder9x16, t.folder9x16);
  setUrl(f.folder4x5, t.folder4x5);

  // singleSelect fields — values are reconciled (2026-06-25) to match existing options.
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
  if (t.shootAirtableIds.length) fields[l.shoots] = t.shootAirtableIds;

  // 1–5 manual priority rating (fits the Airtable rating field). Guarded so an
  // out-of-range value can never 400 the batch.
  if (t.queueRank != null && t.queueRank >= 1 && t.queueRank <= 5) fields[f.queueRank] = t.queueRank;

  return fields;
}
