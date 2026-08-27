// Performance loop — per-post social metrics. This is the SINK: one door that manual
// drawer entry, a Claude/Perch connector pull, and (later) an automated adapter all
// write through, so nothing downstream cares where a number came from.
//
// Why URL-keyed rather than Asset-keyed: the only identifier that exists on both sides
// of this join today is the published permalink (VishenVideo.publishedLink). `model
// Performance` is asset-FK'd and unused; see plans/i-got-the-mcp-temporal-summit.md.
//
// Why every metric is nullable: sources disagree. Hootsuite Perch reports impressions +
// engagement, Meta deprecated IG `impressions` in Apr 2025 (views is the survivor), and
// the team logs whatever Instagram Insights shows them. We store what we're given and
// let summarize() pick the best available label instead of forcing one vocabulary.

import { prisma } from '@/lib/prisma';
import { normalizeUrl, type SocialMetricInput, type SocialMetricRow } from '@/lib/metrics/social-metric-types';

// Re-exported so server callers have one import site; client components must import
// from social-metric-types directly (this module reaches for prisma).
export * from '@/lib/metrics/social-metric-types';

export interface IngestReport {
  upserted: number;
  /** Rows we could tie to a known video. */
  matched: number;
  /** Rows stored but tied to nothing — a wrong permalink is visible, not silent. */
  unmatched: number;
  /** Rows rejected outright before any write (no usable key, or no metric at all). */
  skipped: number;
  /** Rows that failed AT the write — a DB problem, not a caller problem. Kept
   *  separate so the route can answer 400 (your rows) vs 500 (our database). */
  writeErrors: number;
  errors: string[];
}

const day = (d: Date): string => d.toISOString().slice(0, 10);

/**
 * One row per source + post + window + captured day. Re-running today's pull updates
 * today's row instead of appending a near-duplicate, while yesterday's row survives so
 * a time series is still possible later.
 */
function dedupeKeyFor(row: { source: string; platformPostId: string | null; publishedUrl: string | null; vishenVideoId: string | null; windowDays: number | null; capturedAt: Date }): string {
  const key = row.platformPostId ?? row.publishedUrl ?? row.vishenVideoId ?? 'unkeyed';
  return `${row.source}:${key}:${row.windowDays ?? 'life'}:${day(row.capturedAt)}`;
}

const int = (v: number | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null;

function hasAnyMetric(r: SocialMetricInput): boolean {
  return [r.impressions, r.views, r.reach, r.engagements, r.engagementRate, r.clicks]
    .some((v) => typeof v === 'number' && Number.isFinite(v));
}

/**
 * Resolve published URLs → VishenVideo ids in one query, so a batch costs one read
 * rather than one per row. Compares on the *normalized* URL, since Airtable holds
 * whatever the team pasted (tracking params, trailing slashes, http, www).
 */
async function resolveVideosByUrl(urls: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (urls.length === 0) return out;
  try {
    const rows = await prisma.vishenVideo.findMany({
      where: { publishedLink: { not: null } },
      select: { id: true, publishedLink: true },
    });
    const wanted = new Set(urls);
    for (const r of rows) {
      const n = normalizeUrl(r.publishedLink);
      if (n && wanted.has(n) && !out.has(n)) out.set(n, r.id);
    }
  } catch {
    // VISHEN_VIDEOS_BACKEND may still be 'airtable' (table empty / unreachable). Rows
    // then land unmatched, which the report makes visible — never a silent drop.
  }
  return out;
}

/**
 * Store a batch of metric rows. Idempotent per (source, post, window, day).
 *
 * Rows that resolve to no known video are still stored — an unmatched count in the
 * report is how a wrong permalink surfaces, instead of the number vanishing.
 */
export async function ingestSocialMetrics(rows: SocialMetricInput[]): Promise<IngestReport> {
  const report: IngestReport = { upserted: 0, matched: 0, unmatched: 0, skipped: 0, writeErrors: 0, errors: [] };

  const prepared = rows.flatMap((r) => {
    const publishedUrl = normalizeUrl(r.publishedUrl);
    const platformPostId = (r.platformPostId ?? '').trim() || null;
    const vishenVideoId = (r.vishenVideoId ?? '').trim() || null;
    if (!publishedUrl && !platformPostId && !vishenVideoId) {
      report.skipped++;
      report.errors.push('row has no publishedUrl / platformPostId / vishenVideoId');
      return [];
    }
    if (!hasAnyMetric(r)) {
      report.skipped++;
      report.errors.push(`row ${publishedUrl ?? platformPostId} carries no metric values`);
      return [];
    }
    const capturedAt = r.capturedAt ? new Date(r.capturedAt) : new Date();
    if (Number.isNaN(capturedAt.getTime())) {
      report.skipped++;
      report.errors.push(`row ${publishedUrl ?? platformPostId} has an invalid capturedAt`);
      return [];
    }
    return [{
      source: r.source,
      platformPostId,
      publishedUrl,
      vishenVideoId,
      ticketAirtableId: (r.ticketAirtableId ?? '').trim() || null,
      channel: r.channel ?? null,
      impressions: int(r.impressions),
      views: int(r.views),
      reach: int(r.reach),
      engagements: int(r.engagements),
      engagementRate: typeof r.engagementRate === 'number' && Number.isFinite(r.engagementRate) ? r.engagementRate : null,
      clicks: int(r.clicks),
      windowDays: int(r.windowDays),
      capturedAt,
      enteredBy: (r.enteredBy ?? '').trim() || null,
      raw: (r.raw ?? null) as never,
    }];
  });

  const needsResolving = [...new Set(prepared.filter((p) => !p.vishenVideoId && p.publishedUrl).map((p) => p.publishedUrl!))];
  const byUrl = await resolveVideosByUrl(needsResolving);

  for (const p of prepared) {
    const vishenVideoId = p.vishenVideoId ?? (p.publishedUrl ? byUrl.get(p.publishedUrl) ?? null : null);
    const data = { ...p, vishenVideoId };
    const dedupeKey = dedupeKeyFor(data);
    try {
      await prisma.socialMetric.upsert({
        where: { dedupeKey },
        create: { ...data, dedupeKey },
        update: data,
      });
      report.upserted++;
      if (vishenVideoId) report.matched++;
      else report.unmatched++;
    } catch (err) {
      report.writeErrors++;
      report.errors.push(`${dedupeKey}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return report;
}

/**
 * Latest metric row per video, keyed by VishenVideo.id. Prefers the row a caller can
 * trust most: newest capture wins, and a video-linked row beats a URL-only one.
 *
 * Takes the videos rather than ids so it can match either way — the Postgres backend
 * exposes a uuid `id` while the Airtable one exposes a recId, so URL is the reliable
 * bridge across both.
 */
export async function getLatestMetrics(
  videos: { id: string; publishedLink: string | null }[],
): Promise<Record<string, SocialMetricRow>> {
  const linked = videos.filter((v) => v.publishedLink);
  if (linked.length === 0) return {};

  const urlToId = new Map<string, string>();
  for (const v of linked) {
    const n = normalizeUrl(v.publishedLink);
    if (n && !urlToId.has(n)) urlToId.set(n, v.id);
  }

  let rows: SocialMetricRow[] = [];
  try {
    rows = await prisma.socialMetric.findMany({
      where: {
        OR: [
          { vishenVideoId: { in: linked.map((v) => v.id) } },
          { publishedUrl: { in: [...urlToId.keys()] } },
        ],
      },
      orderBy: { capturedAt: 'asc' }, // ascending so the last write per key wins below
      select: {
        publishedUrl: true, vishenVideoId: true, channel: true, impressions: true, views: true,
        reach: true, engagements: true, engagementRate: true, clicks: true, windowDays: true,
        capturedAt: true, source: true, enteredBy: true,
      },
    }).then((rs) => rs.map((r) => ({ ...r, engagementRate: r.engagementRate === null ? null : Number(r.engagementRate) })));
  } catch {
    return {}; // no metrics table / DB unreachable — surfaces show the "needs numbers" state
  }

  const out: Record<string, SocialMetricRow> = {};
  for (const r of rows) {
    const id = r.vishenVideoId ?? (r.publishedUrl ? urlToId.get(r.publishedUrl) : null);
    if (id) out[id] = r;
  }
  return out;
}

