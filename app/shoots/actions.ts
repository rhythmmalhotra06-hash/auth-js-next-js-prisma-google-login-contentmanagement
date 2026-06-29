'use server';

import { revalidatePath } from 'next/cache';
import { createShoot } from '@/lib/shoots/repository';

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
