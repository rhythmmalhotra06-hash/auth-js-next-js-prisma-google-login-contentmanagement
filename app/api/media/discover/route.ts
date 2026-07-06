import { recentUploads } from '@/lib/media/youtube';
import { existingSourceUrls, createMediaSource } from '@/lib/media/repository';

// Node runtime: outbound fetch to the YouTube Data API + Airtable writes.
export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Auto-detect Vishen's new YouTube uploads → add them to the 📺 Media Sources inbox
 * (Status "New", Submitted Via "Auto-discover"), deduped on Source URL. Adds rows
 * only — it never runs the clip engine (a human still clicks "Suggest clips").
 *
 * Driven by a Kessel scheduled job. The Cloud Run service is IAP-gated, so the
 * scheduler authenticates with a Google OIDC token; this route adds a shared-secret
 * header as a second gate. Configure: YOUTUBE_API_KEY, VISHEN_YT_CHANNEL_ID,
 * DISCOVER_SHARED_SECRET.
 */
export async function POST(req: Request) {
  const secret = process.env.DISCOVER_SHARED_SECRET;
  if (secret) {
    const provided = req.headers.get('x-discover-secret');
    if (provided !== secret) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const channelId = process.env.VISHEN_YT_CHANNEL_ID;
  if (!channelId) return Response.json({ error: 'VISHEN_YT_CHANNEL_ID is not set.' }, { status: 500 });

  let uploads;
  try {
    uploads = await recentUploads(channelId);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'YouTube fetch failed' }, { status: 502 });
  }

  const seenRes = await existingSourceUrls();
  if (!seenRes.ok) return Response.json({ error: seenRes.error.message }, { status: 502 });
  const seen = seenRes.data;

  // Auto-discover is for long-form only — skip Shorts. All Shorts are ≤180s (the
  // Shorts cap), so a duration threshold reliably excludes them. Unknown/null
  // duration is kept (never silently drop everything on an API hiccup).
  const minSec = Number(process.env.DISCOVER_MIN_DURATION_SECONDS) || 180;

  const added: string[] = [];
  const failed: { url: string; error: string }[] = [];
  let skipped = 0;

  for (const up of uploads) {
    if (seen.has(up.url)) continue;
    if (up.durationSeconds != null && up.durationSeconds <= minSec) {
      skipped++;
      continue;
    }
    const res = await createMediaSource({
      url: up.url,
      title: up.title || null,
      platform: 'YouTube',
      submittedVia: 'Auto-discover',
    });
    if (res.ok) added.push(up.url);
    else failed.push({ url: up.url, error: res.error.message });
  }

  return Response.json({ ok: failed.length === 0, scanned: uploads.length, added: added.length, skipped, failed });
}

// GET for manual/cron flexibility (same logic).
export const GET = POST;
