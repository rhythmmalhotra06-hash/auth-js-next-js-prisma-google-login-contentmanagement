// Shoot writes — Postgres is the system of record (SHOOTS_BACKEND=postgres). Each write
// mutates the PG row and enqueues an AirtableOutbox row (entity 'shoot') in the same
// transaction; the drainer mirrors current state back to the 📺 Shoots table (which is
// where the "New Prio Ticket" automation and the team's edits live). Returns the updated
// ShootRow via the PG read so callers get the same shape as the Airtable impl.

import { prisma } from '@/lib/prisma';
import type { AirtableResult } from '@/lib/airtable/rest';
import { SHOOT_STATUS, type ShootRow, type CreateShootInput, type ShootPatch } from '@/lib/shoots/constants';
import { getShoot } from '@/lib/shoots/data.postgres';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createShoot(input: CreateShootInput): Promise<AirtableResult<ShootRow>> {
  // Vishen-approved shoots skip the review gate (mirrors the Airtable impl).
  const status = input.vishenApproved ? SHOOT_STATUS.approved : SHOOT_STATUS.needsReview;
  const created = await prisma.shoot.create({
    data: {
      title: input.title,
      status,
      vishenApproved: input.vishenApproved === true,
      format: input.format ?? null,
      brief: input.brief ?? null,
      productionSupport: input.productionSupport ?? null,
      filmingLocation: input.filmingLocation ?? null,
      filmingDate: input.filmingDate ?? null,
      requestedById: input.requestedByRecId ?? null,
      authorIds: input.authorRecIds ?? [],
      eventTypeIds: input.eventTypeRecIds ?? [],
      assetTypeIds: input.assetTypeRecIds ?? [],
    },
  });
  await prisma.airtableOutbox.create({ data: { entity: 'shoot', entityId: created.id, op: 'upsert' } });
  return getShoot(created.id);
}

/** Patch a shoot (by PG uuid or Airtable recId) in Postgres + enqueue an Airtable push. */
export async function updateShoot(idOrRec: string, patch: ShootPatch): Promise<AirtableResult<ShootRow>> {
  const where = UUID_RE.test(idOrRec) ? { id: idOrRec } : { airtableId: idOrRec };
  const current = await prisma.shoot.findFirst({ where, select: { id: true } });
  if (!current) return { ok: false, error: { type: 'NOT_FOUND', message: 'Shoot not found' } };

  const data: Record<string, unknown> = {};
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.format !== undefined) data.format = patch.format;
  if (patch.filmingDate !== undefined) data.filmingDate = patch.filmingDate || null;
  if (patch.filmingLocation !== undefined) data.filmingLocation = patch.filmingLocation;
  if (patch.brief !== undefined) data.brief = patch.brief;
  if (patch.productionSupport !== undefined) data.productionSupport = patch.productionSupport;
  if (patch.rawFiles !== undefined) data.rawFiles = patch.rawFiles;
  if (patch.vishenApproved !== undefined) data.vishenApproved = patch.vishenApproved;
  if (patch.platforms !== undefined) data.platforms = patch.platforms;
  if (patch.eventTypeIds !== undefined) data.eventTypeIds = patch.eventTypeIds;
  if (patch.priorityRanking !== undefined) data.priorityRanking = patch.priorityRanking;
  if (patch.ticketIds !== undefined) data.ticketIds = patch.ticketIds;
  if (patch.newPrioTicket !== undefined) data.newPrioTicket = patch.newPrioTicket;

  await prisma.$transaction([
    prisma.shoot.update({ where: { id: current.id }, data }),
    prisma.airtableOutbox.create({ data: { entity: 'shoot', entityId: current.id, op: 'upsert' } }),
  ]);
  return getShoot(current.id);
}
