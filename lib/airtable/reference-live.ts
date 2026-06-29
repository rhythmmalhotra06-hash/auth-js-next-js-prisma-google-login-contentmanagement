// Live reference reads for the intake form. Reads asset/event types (+ employees,
// calendars, authors) straight from Airtable so new taxonomy shows up within the
// cache TTL — no manual sync needed. Options are keyed by Airtable recId (stable
// whether or not the row is mirrored to Postgres yet); createTicket lazily upserts
// the chosen rows (see resolve-reference.ts) so ticket FKs still resolve.

import { listRecords } from './client';
import { listRecords as listRest } from './rest';
import {
  EMPLOYEES, EVENT_TYPES, ASSET_TYPES, OFFICIAL_CALENDARS, AUTHORS, SHOOTS,
} from './field-map';
import { mapEmployee, mapEventType, mapAssetType, mapOfficialCalendar, mapAuthor } from './sync';
import type { Option, AssetTypeOption } from '@/lib/intake/data';

export interface LiveReference {
  employees: Option[];
  eventTypes: Option[];
  assetTypes: AssetTypeOption[];
  officialCalendars: Option[];
  authors: Option[];
  shoots: Option[];
}

// The Shoots & Raw Assets table can be large; cap the picker list (most recent first
// isn't available without a sort field, so cap and let users search within it).
const SHOOTS_MAX = 500;

// Taxonomy (employees/event/asset types/calendars/authors) changes rarely; a 5-min
// cache keeps load times low while still surfacing new options within minutes.
const TTL_MS = 5 * 60_000;
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
    .map((a) => ({ id: a.airtableId, name: a.name, category: a.category, eventTypeIds: a.links.eventTypes,
      isVideo: a.creativeCategory === 'Creative Video Type' }));

  const officialCalendars = (await listRecords(OFFICIAL_CALENDARS.baseId, OFFICIAL_CALENDARS.tableId))
    .map(mapOfficialCalendar)
    .map((c) => ({ id: c.airtableId, name: c.name }));

  const authors = (await listRecords(AUTHORS.baseId, AUTHORS.tableId))
    .map(mapAuthor)
    .map((a) => ({ id: a.airtableId, name: a.name }));

  // Shoots/raw assets — optional intake picker. Capped (table can be large).
  const shootsRes = await listRest(SHOOTS.baseId, SHOOTS.tableId, { fields: [SHOOTS.fields.title], maxRecords: SHOOTS_MAX });
  const shoots: Option[] = shootsRes.ok
    ? shootsRes.data.records.map((r) => ({ id: r.id, name: (typeof r.fields[SHOOTS.fields.title] === 'string' && (r.fields[SHOOTS.fields.title] as string)) || '(untitled shoot)' }))
    : [];

  // Sort to match the existing Postgres-backed ordering (name asc).
  const byName = (a: Option, b: Option) => a.name.localeCompare(b.name);
  employees.sort(byName); eventTypes.sort(byName); assetTypes.sort(byName);
  officialCalendars.sort(byName); authors.sort(byName); shoots.sort(byName);

  return { employees, eventTypes, assetTypes, officialCalendars, authors, shoots };
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
