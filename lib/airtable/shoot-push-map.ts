// PG shoot → Airtable 📺 Shoots field payload (inverse of shoot-upsert). Full-state push:
// the drainer writes every mapped field each cycle so Airtable reflects current PG state.
// Links are written as recId arrays (empty array clears). `created` (createdTime) is
// read-only and intentionally omitted.

import { SHOOTS } from './field-map';

const F = SHOOTS.fields;
const L = SHOOTS.links;

export interface ShootForPush {
  title: string | null;
  status: string | null;
  format: string | null;
  filmingDate: string | null;
  filmingLocation: string | null;
  brief: string | null;
  productionSupport: string | null;
  vishenApproved: boolean;
  priorityRanking: number | null;
  rawFiles: string | null;
  platforms: string[];
  newPrioTicket: boolean;
  requestedById: string | null;
  authorIds: string[];
  eventTypeIds: string[];
  assetTypeIds: string[];
  assetLibraryIds: string[];
  ticketIds: string[];
}

export function shootToAirtableFields(s: ShootForPush): Record<string, unknown> {
  return {
    [F.title]: s.title,
    [F.status]: s.status,
    [F.format]: s.format,
    [F.filmingDate]: s.filmingDate,
    [F.filmingLocation]: s.filmingLocation,
    [F.notes]: s.brief,
    [F.productionSupport]: s.productionSupport,
    [F.vishenApproval]: s.vishenApproved,
    [F.priorityRanking]: s.priorityRanking,
    [F.rawFiles]: s.rawFiles,
    [F.platforms]: s.platforms,
    [F.newPrioTicket]: s.newPrioTicket,
    [L.requestedBy]: s.requestedById ? [s.requestedById] : [],
    [L.authors]: s.authorIds,
    [L.eventTypes]: s.eventTypeIds,
    [L.assetTypes]: s.assetTypeIds,
    [L.assetLibrary]: s.assetLibraryIds,
    [L.postProductionTicket]: s.ticketIds,
  };
}
