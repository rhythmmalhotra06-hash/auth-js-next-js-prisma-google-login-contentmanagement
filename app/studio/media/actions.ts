'use server';

import { revalidatePath } from 'next/cache';
import { VISHEN_VIDEOS as V } from '@/lib/airtable/field-map';
import { updateVishenVideo } from '@/lib/media/vishen-videos';
import { getAdminAccess } from '@/lib/admin/access';
import { ingestSocialMetrics, parseCount, parseRate } from '@/lib/metrics/social-perf';

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

/** Log the free-text 24h performance for a video (team-entered; Postiz/Hootsuite auto-fill later). */
export async function saveViews24h(id: string, text: string): Promise<ActionResult> {
  const res = await updateVishenVideo(id, { views24h: text.slice(0, 5000) });
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidateMedia();
  return { ok: true };
}

/**
 * Log structured 24h numbers for a published video — the manual half of the
 * performance loop. Writes BOTH:
 *   1. a `social_metrics` row (source 'manual'), so the Studio band and any later
 *      Perch pull share one shape, and
 *   2. the existing free-text "24h Data" field in Airtable, so the team's own views
 *      don't go dark while the app is the nicer way in.
 *
 * Requires a session — server actions are reachable independently of the page guard.
 */
export async function saveVideoMetrics(
  id: string,
  input: {
    publishedLink: string | null;
    channel: string | null;
    views?: string;
    impressions?: string;
    engagement?: string;
    /** The team's existing free-text "24h Data" note, so we never overwrite it. */
    existingText?: string | null;
  },
): Promise<ActionResult> {
  const { email } = await getAdminAccess();
  if (!email) return { ok: false, error: 'You need to be signed in to do this.' };

  const views = parseCount(input.views);
  const impressions = parseCount(input.impressions);
  const engagementRate = parseRate(input.engagement);
  if (views == null && impressions == null && engagementRate == null) {
    return { ok: false, error: 'Enter a view/impression count or an engagement rate.' };
  }

  const report = await ingestSocialMetrics([{
    source: 'manual',
    publishedUrl: input.publishedLink,
    vishenVideoId: id,
    channel: input.channel,
    views,
    impressions,
    engagementRate,
    windowDays: 1, // the drawer asks for 24h numbers
    enteredBy: email,
  }]);
  if (report.upserted === 0) {
    return { ok: false, error: report.errors[0] ?? 'Could not save those numbers.' };
  }

  // Mirror into Airtable's free-text "24h Data" ONLY when the team hasn't written
  // anything there. That field is theirs (Vishen specified free text on purpose), and
  // the app overwrites only what it owns — same decision-lock rule as clip statuses.
  if (!(input.existingText ?? '').trim()) {
    const parts = [
      impressions != null ? `${impressions.toLocaleString('en-US')} impressions` : null,
      views != null ? `${views.toLocaleString('en-US')} views` : null,
      engagementRate != null ? `${engagementRate}% eng` : null,
    ].filter(Boolean);
    const res = await updateVishenVideo(id, { views24h: `${parts.join(' · ')} — logged ${new Date().toISOString().slice(0, 10)}` });
    if (!res.ok) {
      revalidateMedia();
      // The metric row is already stored; a failed mirror is worth reporting but must
      // not read as "nothing saved".
      return { ok: false, error: `Saved here, but Airtable did not update: ${res.error.message}` };
    }
  }
  revalidateMedia();
  return { ok: true };
}
