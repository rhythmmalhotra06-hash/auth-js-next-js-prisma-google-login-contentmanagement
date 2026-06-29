// Shoots repository — Airtable-direct (📺 Shoots). Pre-production filming requests
// (the "New 🎬 Shoots" form) that feed production tickets. Mirrors lib/media/repository.ts:
// typed rows, AirtableResult returns, field-id mapping via field-map.ts. No Postgres.

import { SHOOTS as S } from '@/lib/airtable/field-map';
import {
  listRecords,
  getRecord,
  createRecord,
  type AirtableRecord,
  type AirtableResult,
} from '@/lib/airtable/rest';
import type { ShootRow } from '@/lib/shoots/constants';

export type { ShootRow } from '@/lib/shoots/constants';
export {
  SHOOT_FORMATS, SHOOT_LOCATIONS, SHOOT_STATUS, SHOOT_STATUS_ORDER, SHOOT_STATUS_TONE,
  shortStatus, isToFilmInStudioTime, STUDIO_TIME_SINCE,
} from '@/lib/shoots/constants';

const SF = S.fields;
const SL = S.links;

type Raw = Record<string, unknown>;

function selectName(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return String(v);
}
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

function linkedIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' && 'id' in x ? String((x as { id: unknown }).id) : null))
    .filter((x): x is string => !!x);
}

// ── Rows ─────────────────────────────────────────────────────────────────────
// ShootRow + the studio-time predicate live in ./constants (client-safe) and are
// re-exported above.

function mapShoot(rec: AirtableRecord<Raw>): ShootRow {
  const f = rec.fields;
  return {
    id: rec.id,
    title: str(f[SF.title]),
    status: selectName(f[SF.status]),
    format: selectName(f[SF.format]),
    filmingDate: str(f[SF.filmingDate]),
    filmingLocation: selectName(f[SF.filmingLocation]),
    brief: str(f[SF.notes]),
    productionSupport: str(f[SF.productionSupport]),
    vishenApproved: f[SF.vishenApproval] === true,
    requestedById: linkedIds(f[SL.requestedBy])[0] ?? null,
    authorIds: linkedIds(f[SL.authors]),
    ticketIds: linkedIds(f[SL.postProductionTicket]),
    ticketCount: linkedIds(f[SL.postProductionTicket]).length,
    createdTime: rec.createdTime,
  };
}

const LIST_FIELDS = [
  SF.title, SF.status, SF.format, SF.filmingDate, SF.filmingLocation, SF.notes,
  SF.productionSupport, SF.vishenApproval, SL.requestedBy, SL.authors,
  SL.postProductionTicket,
];

/** Queue list — newest first. Excludes Cancelled by default. */
export async function listShoots(limit = 200): Promise<AirtableResult<ShootRow[]>> {
  const res = await listRecords<Raw>(S.baseId, S.tableId, {
    fields: LIST_FIELDS,
    filterByFormula: `NOT({${S.statusFieldName}} = '${S.status_.cancelled}')`,
    maxRecords: limit,
  });
  if (!res.ok) return res;
  const rows = res.data.records
    .map(mapShoot)
    .sort((a, b) => (a.createdTime < b.createdTime ? 1 : -1));
  return { ok: true, data: rows };
}

/** Single shoot (full fields). */
export async function getShoot(id: string): Promise<AirtableResult<ShootRow>> {
  const res = await getRecord<Raw>(S.baseId, S.tableId, id);
  if (!res.ok) return res;
  return { ok: true, data: mapShoot(res.data) };
}

export interface CreateShootInput {
  title: string;
  format?: string | null; // Studio | VLOG | Broll | Testimonial | Livestream
  brief?: string | null;
  productionSupport?: string | null;
  filmingLocation?: string | null; // must match a Filming Location option
  filmingDate?: string | null; // ISO date
  vishenApproved?: boolean;
  requestedByRecId?: string | null; // Employee recId ("Requester" link)
  authorRecIds?: string[];
  eventTypeRecIds?: string[];
  assetTypeRecIds?: string[];
}

export async function createShoot(input: CreateShootInput): Promise<AirtableResult<ShootRow>> {
  const fields: Record<string, unknown> = {
    [SF.title]: input.title,
    // Vishen-approved shoots skip the review gate.
    [SF.status]: input.vishenApproved ? S.status_.approved : S.status_.needsReview,
    [SF.vishenApproval]: input.vishenApproved === true,
  };
  if (input.format) fields[SF.format] = input.format;
  if (input.brief) fields[SF.notes] = input.brief;
  if (input.productionSupport) fields[SF.productionSupport] = input.productionSupport;
  if (input.filmingLocation) fields[SF.filmingLocation] = input.filmingLocation;
  if (input.filmingDate) fields[SF.filmingDate] = input.filmingDate;
  if (input.requestedByRecId) fields[SL.requestedBy] = [input.requestedByRecId];
  if (input.authorRecIds?.length) fields[SL.authors] = input.authorRecIds;
  if (input.eventTypeRecIds?.length) fields[SL.eventTypes] = input.eventTypeRecIds;
  if (input.assetTypeRecIds?.length) fields[SL.assetTypes] = input.assetTypeRecIds;

  const res = await createRecord<Raw>(S.baseId, S.tableId, fields);
  if (!res.ok) return res;
  return { ok: true, data: mapShoot(res.data) };
}
