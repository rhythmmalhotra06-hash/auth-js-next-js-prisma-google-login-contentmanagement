// Live reference reads for the intake form. Reads asset/event types (+ employees,
// calendars, authors) straight from Airtable so new taxonomy shows up within the
// cache TTL — no manual sync needed. Options are keyed by Airtable recId (stable
// whether or not the row is mirrored to Postgres yet); createTicket lazily upserts
// the chosen rows (see resolve-reference.ts) so ticket FKs still resolve.

import { listRecords } from './client';
import {
  EMPLOYEES, EVENT_TYPES, ASSET_TYPES, OFFICIAL_CALENDARS, AUTHORS,
} from './field-map';
import { mapEmployee, mapEventType, mapAssetType, mapOfficialCalendar, mapAuthor } from './sync';
import type { Option, AssetTypeOption } from '@/lib/intake/data';

export interface LiveReference {
  employees: Option[];
  eventTypes: Option[];
  assetTypes: AssetTypeOption[];
  officialCalendars: Option[];
  authors: Option[];
}

const TTL_MS = 60_000;
let cache: { at: number; data: LiveReference } | null = null;
let inflight: Promise<LiveReference> | null = null;

async function fetchLive(): Promise<LiveReference> {
  // Sequential — all tables share the creative_services base; concurrent calls
  // would blow the per-base rate limit (client.listRecords already paces itself).
  const employees = (await listRecords(EMPLOYEES.baseId, EMPLOYEES.tableId))
    .map(mapEmployee).filter((e) => e.active)
    .map((e) => ({ id: e.airtableId, name: e.name }));

  const eventTypes = (await listRecords(EVENT_TYPES.baseId, EVENT_TYPES.tableId))
    .map(mapEventType).filter((e) => e.active)
    .map((e) => ({ id: e.airtableId, name: e.name }));

  const assetTypes = (await listRecords(ASSET_TYPES.baseId, ASSET_TYPES.tableId))
    .map(mapAssetType).filter((a) => a.active)
    .map((a) => ({ id: a.airtableId, name: a.name, category: a.category, eventTypeIds: a.links.eventTypes }));

  const officialCalendars = (await listRecords(OFFICIAL_CALENDARS.baseId, OFFICIAL_CALENDARS.tableId))
    .map(mapOfficialCalendar)
    .map((c) => ({ id: c.airtableId, name: c.name }));

  const authors = (await listRecords(AUTHORS.baseId, AUTHORS.tableId))
    .map(mapAuthor)
    .map((a) => ({ id: a.airtableId, name: a.name }));

  // Sort to match the existing Postgres-backed ordering (name asc).
  const byName = (a: Option, b: Option) => a.name.localeCompare(b.name);
  employees.sort(byName); eventTypes.sort(byName); assetTypes.sort(byName);
  officialCalendars.sort(byName); authors.sort(byName);

  return { employees, eventTypes, assetTypes, officialCalendars, authors };
}

/** Live reference lists, cached ~60s. Throws if Airtable is unreachable (caller falls back to Postgres). */
export async function getLiveIntakeReference(): Promise<LiveReference> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (inflight) return inflight; // de-dupe concurrent refreshes
  inflight = fetchLive()
    .then((data) => {
      cache = { at: Date.now(), data };
      return data;
    })
    .finally(() => { inflight = null; });
  return inflight;
}
