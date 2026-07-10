// Shoots reads — POSTGRES-backed (system of record when SHOOTS_BACKEND=postgres).
// Returns the exact ShootRow shape the Airtable repo returns, so callers are untouched.
// Exposes the shoot's PG uuid as `id` (like tickets); link fields stay Airtable recIds so
// the UI's recId-based lookups (requester name via intake reference, ticket matching) keep
// working. getShoot accepts a uuid OR a recId (freshly-pushed shoots may be addressed either way).

import { prisma } from '@/lib/prisma';
import type { AirtableResult } from '@/lib/airtable/rest';
import type { ShootRow } from '@/lib/shoots/constants';
import { SHOOT_STATUS } from '@/lib/shoots/constants';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ShootRecord = {
  id: string;
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
  assetLibraryIds: string[];
  ticketIds: string[];
  createdTime: string | null;
};

function toShootRow(s: ShootRecord): ShootRow {
  return {
    id: s.id,
    title: s.title,
    status: s.status,
    format: s.format,
    filmingDate: s.filmingDate,
    filmingLocation: s.filmingLocation,
    brief: s.brief,
    productionSupport: s.productionSupport,
    vishenApproved: s.vishenApproved,
    priorityRanking: s.priorityRanking,
    rawFiles: s.rawFiles,
    platforms: s.platforms,
    newPrioTicket: s.newPrioTicket,
    requestedById: s.requestedById,
    authorIds: s.authorIds,
    eventTypeIds: s.eventTypeIds,
    assetLibraryIds: s.assetLibraryIds,
    ticketIds: s.ticketIds,
    ticketCount: s.ticketIds.length,
    createdTime: s.createdTime ?? '',
  };
}

const SELECT = {
  id: true, title: true, status: true, format: true, filmingDate: true, filmingLocation: true,
  brief: true, productionSupport: true, vishenApproved: true, priorityRanking: true, rawFiles: true,
  platforms: true, newPrioTicket: true, requestedById: true, authorIds: true, eventTypeIds: true,
  assetLibraryIds: true, ticketIds: true, createdTime: true,
} as const;

/** Queue list — newest first, excludes Cancelled (matches the Airtable repo). */
export async function listShoots(limit = 200): Promise<AirtableResult<ShootRow[]>> {
  const rows = await prisma.shoot.findMany({
    where: { NOT: { status: SHOOT_STATUS.cancelled } },
    orderBy: [{ createdTime: 'desc' }],
    take: limit,
    select: SELECT,
  });
  return { ok: true, data: rows.map(toShootRow) };
}

/** Single shoot by PG uuid or Airtable recId. */
export async function getShoot(idOrRec: string): Promise<AirtableResult<ShootRow>> {
  const where = UUID_RE.test(idOrRec) ? { id: idOrRec } : { airtableId: idOrRec };
  const s = await prisma.shoot.findFirst({ where, select: SELECT });
  if (!s) return { ok: false, error: { type: 'NOT_FOUND', message: 'Shoot not found' } };
  return { ok: true, data: toShootRow(s) };
}
