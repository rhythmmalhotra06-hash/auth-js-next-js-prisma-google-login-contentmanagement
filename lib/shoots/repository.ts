// Shoots repository — Airtable-direct (📺 Shoots). Pre-production filming requests
// (the "New 🎬 Shoots" form) that feed production tickets. Mirrors lib/media/repository.ts:
// typed rows, AirtableResult returns, field-id mapping via field-map.ts. No Postgres.

import { SHOOTS as S } from '@/lib/airtable/field-map';
import {
  listAll,
  getRecord,
  createRecord,
  updateRecord,
  type AirtableRecord,
  type AirtableResult,
} from '@/lib/airtable/rest';
import type { ShootRow, CreateShootInput, ShootPatch } from '@/lib/shoots/constants';
import { shootsArePostgres } from '@/lib/shoots/backend';

export type { CreateShootInput, ShootPatch } from '@/lib/shoots/constants';

export type { ShootRow } from '@/lib/shoots/constants';
export {
  SHOOT_FORMATS, SHOOT_LOCATIONS, SHOOT_PLATFORMS, SHOOT_STATUS, SHOOT_STATUS_ORDER,
  SHOOT_STATUS_TONE, SHOOT_RANK_MAX, shortStatus,
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
const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null);

// multipleSelects → array of plain option names.
function selectNames(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(selectName).filter((x): x is string => !!x);
}

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
    priorityRanking: num(f[SF.priorityRanking]),
    rawFiles: str(f[SF.rawFiles]),
    platforms: selectNames(f[SF.platforms]),
    newPrioTicket: f[SF.newPrioTicket] === true,
    requestedById: linkedIds(f[SL.requestedBy])[0] ?? null,
    authorIds: linkedIds(f[SL.authors]),
    eventTypeIds: linkedIds(f[SL.eventTypes]),
    assetLibraryIds: linkedIds(f[SL.assetLibrary]),
    ticketIds: linkedIds(f[SL.postProductionTicket]),
    ticketCount: linkedIds(f[SL.postProductionTicket]).length,
    createdTime: rec.createdTime,
  };
}

const LIST_FIELDS = [
  SF.title, SF.status, SF.format, SF.filmingDate, SF.filmingLocation, SF.notes,
  SF.productionSupport, SF.vishenApproval, SF.priorityRanking, SF.rawFiles, SF.platforms,
  SF.newPrioTicket, SL.requestedBy, SL.authors, SL.eventTypes, SL.assetLibrary,
  SL.postProductionTicket,
];

/**
 * Queue list — newest first. Excludes Cancelled by default. Paginates across all
 * pages: the cancelled filter bounds this well under the 10k guardrail (~190 rows),
 * and a single page is capped at 100 by Airtable — without paging, recent shoots
 * beyond the first 100 (in default view order) silently dropped before the sort.
 */
export async function listShoots(limit = 200): Promise<AirtableResult<ShootRow[]>> {
  if (shootsArePostgres()) return (await import('@/lib/shoots/data.postgres')).listShoots(limit);
  const res = await listAll<Raw>(S.baseId, S.tableId, {
    fields: LIST_FIELDS,
    filterByFormula: `NOT({${S.statusFieldName}} = '${S.status_.cancelled}')`,
    maxRecords: limit,
  });
  if (!res.ok) return res;
  const rows = res.data
    .map(mapShoot)
    .sort((a, b) => (a.createdTime < b.createdTime ? 1 : -1));
  return { ok: true, data: rows };
}

/** Single shoot (full fields). */
export async function getShoot(id: string): Promise<AirtableResult<ShootRow>> {
  if (shootsArePostgres()) return (await import('@/lib/shoots/data.postgres')).getShoot(id);
  const res = await getRecord<Raw>(S.baseId, S.tableId, id);
  if (!res.ok) return res;
  return { ok: true, data: mapShoot(res.data) };
}

export async function createShoot(input: CreateShootInput): Promise<AirtableResult<ShootRow>> {
  if (shootsArePostgres()) return (await import('@/lib/shoots/write.postgres')).createShoot(input);
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

// Typed patch → Airtable field-id payload (the Airtable write path).
function patchToAirtableFields(patch: ShootPatch): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (patch.status !== undefined) fields[SF.status] = patch.status;
  if (patch.format !== undefined) fields[SF.format] = patch.format;
  if (patch.filmingDate !== undefined) fields[SF.filmingDate] = patch.filmingDate || null;
  if (patch.filmingLocation !== undefined) fields[SF.filmingLocation] = patch.filmingLocation;
  if (patch.brief !== undefined) fields[SF.notes] = patch.brief;
  if (patch.productionSupport !== undefined) fields[SF.productionSupport] = patch.productionSupport;
  if (patch.rawFiles !== undefined) fields[SF.rawFiles] = patch.rawFiles;
  if (patch.vishenApproved !== undefined) fields[SF.vishenApproval] = patch.vishenApproved;
  if (patch.platforms !== undefined) fields[SF.platforms] = patch.platforms;
  if (patch.eventTypeIds !== undefined) fields[SL.eventTypes] = patch.eventTypeIds;
  if (patch.priorityRanking !== undefined) fields[SF.priorityRanking] = patch.priorityRanking;
  if (patch.ticketIds !== undefined) fields[SL.postProductionTicket] = patch.ticketIds;
  if (patch.newPrioTicket !== undefined) fields[SF.newPrioTicket] = patch.newPrioTicket;
  return fields;
}

/** Patch a shoot with a typed ShootPatch. Orchestration (which fields to set) lives in the caller. */
export async function updateShoot(id: string, patch: ShootPatch): Promise<AirtableResult<ShootRow>> {
  if (shootsArePostgres()) return (await import('@/lib/shoots/write.postgres')).updateShoot(id, patch);
  const res = await updateRecord<Raw>(S.baseId, S.tableId, id, patchToAirtableFields(patch));
  if (!res.ok) return res;
  return { ok: true, data: mapShoot(res.data) };
}
