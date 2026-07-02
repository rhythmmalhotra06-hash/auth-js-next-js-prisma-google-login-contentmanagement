'use server';

import { revalidatePath } from 'next/cache';
import { VISHEN_VIDEOS as V } from '@/lib/airtable/field-map';
import { updateVishenVideo } from '@/lib/media/vishen-videos';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// Vishen's Media writes are the propose-only COMMIT boundary: Approval + Rating only
// ever change on an explicit Vishen tap, written straight back to his Videos base.
function revalidateMedia(): void {
  revalidatePath('/studio/media');
  revalidatePath('/studio');
}

/** Approve a video — Approval → "Approved". */
export async function approveVideo(id: string): Promise<ActionResult> {
  const res = await updateVishenVideo(id, { approval: V.approval_.approved });
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidateMedia();
  return { ok: true };
}

/** Send a video back — Approval → "To Refine". */
export async function sendBackVideo(id: string): Promise<ActionResult> {
  const res = await updateVishenVideo(id, { approval: V.approval_.toRefine });
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidateMedia();
  return { ok: true };
}

/** Set Vishen's 1–5 star rating on a video. */
export async function rateVideo(id: string, rating: number): Promise<ActionResult> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: 'Rating must be 1–5' };
  const res = await updateVishenVideo(id, { rating });
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidateMedia();
  return { ok: true };
}
