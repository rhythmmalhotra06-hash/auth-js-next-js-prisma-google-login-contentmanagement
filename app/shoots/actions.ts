'use server';

import { revalidatePath } from 'next/cache';
import { createShoot, getShoot, updateShoot } from '@/lib/shoots/repository';
import {
  SHOOT_FORMATS, SHOOT_LOCATIONS, SHOOT_PLATFORMS, SHOOT_STATUS_ORDER, SHOOT_RANK_MAX,
  type ShootPatch,
} from '@/lib/shoots/constants';

export interface CreateShootInput {
  title: string;
  requestedById: string; // Airtable Employee recId ("Your name")
  format?: string; // Studio | VLOG | Broll | Testimonial | Livestream
  eventTypeId?: string;
  assetTypeId?: string;
  authorIds?: string[];
  shortDescription?: string;
  brief?: string;
  productionSupport?: string;
  filmingLocation?: string;
  filmingDate?: string; // ISO date
  vishenApproved?: boolean;
}

export interface CreateShootResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function createShootAction(input: CreateShootInput): Promise<CreateShootResult> {
  const title = input.title?.trim();
  if (!title) return { ok: false, error: 'Title is required' };
  if (!input.requestedById?.trim()) return { ok: false, error: 'Your name is required' };
  if (input.filmingDate && Number.isNaN(new Date(input.filmingDate).getTime())) {
    return { ok: false, error: 'Invalid filming date' };
  }

  // Short description folds into the brief so nothing the requester typed is lost.
  const brief = [input.shortDescription?.trim(), input.brief?.trim()].filter(Boolean).join('\n\n') || null;

  const res = await createShoot({
    title,
    requestedByRecId: input.requestedById,
    format: input.format || null,
    brief,
    productionSupport: input.productionSupport?.trim() || null,
    filmingLocation: input.filmingLocation || null,
    filmingDate: input.filmingDate ? input.filmingDate.slice(0, 10) : null,
    vishenApproved: input.vishenApproved === true,
    authorRecIds: input.authorIds ?? [],
    eventTypeRecIds: input.eventTypeId ? [input.eventTypeId] : [],
    assetTypeRecIds: input.assetTypeId ? [input.assetTypeId] : [],
  });

  if (!res.ok) return { ok: false, error: res.error.message };
  revalidatePath('/shoots');
  return { ok: true, id: res.data.id };
}

// ── Detail-page edits ────────────────────────────────────────────────────────
// The shoot detail (/shoots/[id]) is a full editor. These actions patch the live
// 📺 Shoots record; each revalidates the queue + the detail route.

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function revalidateShoot(id: string) {
  revalidatePath('/shoots');
  revalidatePath(`/shoots/${id}`);
}

export interface UpdateShootPatch {
  brief?: string | null;
  format?: string | null;
  filmingStatus?: string | null;
  filmingDate?: string | null; // ISO date; '' clears
  filmingLocation?: string | null;
  productionSupport?: string | null;
  rawFiles?: string | null;
  platforms?: string[];
  eventTypeIds?: string[];
}

/** Save the editable text/select fields in one patch (validates enums + date). */
export async function updateShootAction(id: string, patch: UpdateShootPatch): Promise<ActionResult> {
  const next: ShootPatch = {};

  if (patch.brief !== undefined) next.brief = patch.brief?.trim() || null;
  if (patch.productionSupport !== undefined) next.productionSupport = patch.productionSupport?.trim() || null;
  if (patch.rawFiles !== undefined) next.rawFiles = patch.rawFiles?.trim() || null;

  if (patch.format !== undefined) {
    if (patch.format && !(SHOOT_FORMATS as readonly string[]).includes(patch.format)) return { ok: false, error: 'Invalid format' };
    next.format = patch.format || null;
  }
  if (patch.filmingLocation !== undefined) {
    if (patch.filmingLocation && !(SHOOT_LOCATIONS as readonly string[]).includes(patch.filmingLocation)) return { ok: false, error: 'Invalid location' };
    next.filmingLocation = patch.filmingLocation || null;
  }
  if (patch.filmingStatus !== undefined) {
    if (patch.filmingStatus && !SHOOT_STATUS_ORDER.includes(patch.filmingStatus)) return { ok: false, error: 'Invalid filming status' };
    next.status = patch.filmingStatus || null;
  }
  if (patch.platforms !== undefined) {
    if (patch.platforms.some((p) => !(SHOOT_PLATFORMS as readonly string[]).includes(p))) return { ok: false, error: 'Invalid platform' };
    next.platforms = patch.platforms;
  }
  if (patch.filmingDate !== undefined) {
    if (patch.filmingDate && Number.isNaN(new Date(patch.filmingDate).getTime())) return { ok: false, error: 'Invalid filming date' };
    next.filmingDate = patch.filmingDate ? patch.filmingDate.slice(0, 10) : null;
  }
  if (patch.eventTypeIds !== undefined) next.eventTypeIds = patch.eventTypeIds;

  if (Object.keys(next).length === 0) return { ok: true };

  const res = await updateShoot(id, next);
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidateShoot(id);
  return { ok: true };
}

/** Set the manual priority stars (0–10 → "Priority Ranking (Manual)"). 0 clears. */
export async function setShootRank(id: string, rank: number): Promise<ActionResult> {
  if (!Number.isInteger(rank) || rank < 0 || rank > SHOOT_RANK_MAX) {
    return { ok: false, error: `Rank must be 0–${SHOOT_RANK_MAX}` };
  }
  const res = await updateShoot(id, { priorityRanking: rank || null });
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidateShoot(id);
  return { ok: true };
}

/** Link an existing Prio Request ticket to the shoot (appends, no duplicates). */
export async function linkShootTicket(id: string, ticketId: string): Promise<ActionResult> {
  if (!ticketId?.trim()) return { ok: false, error: 'Pick a ticket to link' };
  const detail = await getShoot(id);
  if (!detail.ok) return { ok: false, error: detail.error.message };
  const nextIds = detail.data.ticketIds.includes(ticketId)
    ? detail.data.ticketIds
    : [...detail.data.ticketIds, ticketId];
  const res = await updateShoot(id, { ticketIds: nextIds });
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidateShoot(id);
  return { ok: true };
}

/**
 * Raise a new Prio ticket by ticking the "New Prio Ticket" checkbox — the live
 * Airtable automation creates the ticket (the drainer writes the checkbox back to
 * Airtable when SHOOTS_BACKEND=postgres, so the automation still fires). Gated
 * (server-side mirror of the UI): only allowed once the shoot has both an Asset
 * Library entry and an Event Type.
 */
export async function raiseNewPrioTicket(id: string): Promise<ActionResult> {
  const detail = await getShoot(id);
  if (!detail.ok) return { ok: false, error: detail.error.message };
  if (!detail.data.assetLibraryIds.length || !detail.data.eventTypeIds.length) {
    return { ok: false, error: 'Link an Asset Library entry and an Event Type first' };
  }
  const res = await updateShoot(id, { newPrioTicket: true });
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidateShoot(id);
  return { ok: true };
}
