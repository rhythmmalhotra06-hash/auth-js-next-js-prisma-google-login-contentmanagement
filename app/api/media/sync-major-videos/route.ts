import { syncMajorVideos } from '@/lib/media/major-videos';

// Node runtime: outbound Airtable reads (Vishen's base) + writes (Media Sources).
export const runtime = 'nodejs';
export const maxDuration = 120;

// Go-live cutoff (YYYY-MM-DD): only Major Videos rows created after this date are mirrored, so
// we never backfill the rows that pre-dated this feature. Override per-environment with
// MAJOR_VIDEOS_SYNC_AFTER (YYYY-MM-DD).
const DEFAULT_CUTOFF = '2026-06-30';

/**
 * Sync Vishen's "Major Videos" table → 📺 Media Sources inbox: every new row that has a
 * Final/Draft URL becomes a "New" source (Submitted Via "Airtable"), deduped on Source
 * Record ID. Adds rows only — it never runs the clip engine.
 *
 * Same auth as /api/media/discover: the Cloud Run service is IAP-gated (Google OIDC token),
 * and this shared-secret header is a second gate. Driven by the hourly GitHub Actions cron.
 */
export async function POST(req: Request) {
  const secret = process.env.DISCOVER_SHARED_SECRET;
  if (secret) {
    const provided = req.headers.get('x-discover-secret');
    if (provided !== secret) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = process.env.MAJOR_VIDEOS_SYNC_AFTER || DEFAULT_CUTOFF;

  const res = await syncMajorVideos(cutoff);
  if (!res.ok) return Response.json({ error: res.error.message }, { status: 502 });

  const { scanned, added, failed } = res.data;
  return Response.json({ ok: failed.length === 0, scanned, added: added.length, failed });
}

// GET for manual/cron flexibility (same logic).
export const GET = POST;
