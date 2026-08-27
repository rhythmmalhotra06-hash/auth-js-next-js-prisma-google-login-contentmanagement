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
import { normalizeUrl, reachOf, type SocialMetricInput, type SocialMetricRow } from '@/lib/metrics/social-metric-types';

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


// ── Account-level performance ────────────────────────────────────────────────
//
// Attribution to a portal record needs a published URL on both sides. Today Perch reports
// on @mindvalley's Instagram while VishenVideo holds LinkedIn/YouTube links, so those rows
// legitimately match nothing (see context/hootsuite-perch-capabilities.md). The numbers are
// still worth showing: "which posts landed" reads fine per account, without any join.

export interface SocialPostRow {
  key: string;
  /** Full clickable URL. Stored `publishedUrl` is normalized (no scheme), so the raw
   *  payload's own link is preferred and the scheme re-added as a fallback. */
  url: string | null;
  caption: string | null;
  account: string | null;
  reach: number | null;
  engagements: number | null;
  engagementRate: number | null;
  /** When the post went live, per the source — not when we captured it. */
  postedAt: string | null;
  source: string;
}

export interface AccountSummary {
  account: string;
  posts: number;
  reach: number;
  avgEngagement: number | null;
}

export interface AccountPerformance {
  accounts: AccountSummary[];
  top: SocialPostRow[];
  posts: number;
  latestCapture: string | null;
  /** Rows tied to a portal record. Zero is expected while the reported account and our
   *  records cover different channels — surfaced so it reads as a known gap, not a bug. */
  attributed: number;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function fromRaw(raw: unknown): { caption: string | null; account: string | null; link: string | null; postedAt: string | null } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const details = (r.details ?? {}) as Record<string, unknown>;
  const content = (details.content ?? {}) as Record<string, unknown>;
  const source = (details.source ?? {}) as Record<string, unknown>;
  return {
    caption: str(content.body) ?? str(content.title) ?? null,
    account: str(source.name),
    link: str(details.source_link),
    postedAt: str(r.timestamp),
  };
}

/**
 * Per-account rollup plus the best-performing posts, ranked by reachOf(). Collapses the
 * per-window rows a post accumulates down to its newest capture, so one post counts once.
 */
export async function getAccountPerformance(opts?: { limit?: number; scanCap?: number }): Promise<AccountPerformance> {
  const limit = opts?.limit ?? 10;
  const empty: AccountPerformance = { accounts: [], top: [], posts: 0, latestCapture: null, attributed: 0 };
  let rows;
  try {
    rows = await prisma.socialMetric.findMany({
      orderBy: { capturedAt: 'desc' },
      take: opts?.scanCap ?? 1000,
      select: {
        platformPostId: true, publishedUrl: true, vishenVideoId: true, impressions: true, views: true,
        reach: true, engagements: true, engagementRate: true, capturedAt: true, source: true, raw: true,
      },
    });
  } catch {
    return empty; // table absent or DB unreachable — the caller shows its empty state
  }
  if (rows.length === 0) return empty;

  // Newest capture per post wins (findMany is already ordered desc).
  const byPost = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const key = r.platformPostId ?? r.publishedUrl;
    if (!key || byPost.has(key)) continue;
    byPost.set(key, r);
  }

  const posts: SocialPostRow[] = [];
  const accounts = new Map<string, { posts: number; reach: number; rateSum: number; rated: number }>();
  let attributed = 0;

  for (const [key, r] of byPost) {
    const meta = fromRaw(r.raw);
    const reach = reachOf({
      publishedUrl: r.publishedUrl, vishenVideoId: r.vishenVideoId, channel: null,
      impressions: r.impressions, views: r.views, reach: r.reach, engagements: r.engagements,
      engagementRate: r.engagementRate === null ? null : Number(r.engagementRate),
      clicks: null, windowDays: null, capturedAt: r.capturedAt, source: r.source, enteredBy: null,
    });
    const rate = r.engagementRate === null ? null : Number(r.engagementRate);
    if (r.vishenVideoId) attributed++;

    posts.push({
      key,
      url: meta.link ?? (r.publishedUrl ? `https://${r.publishedUrl}` : null),
      caption: meta.caption,
      account: meta.account,
      reach,
      engagements: r.engagements,
      engagementRate: rate,
      postedAt: meta.postedAt,
      source: r.source,
    });

    const name = meta.account ?? 'Unattributed account';
    const a = accounts.get(name) ?? { posts: 0, reach: 0, rateSum: 0, rated: 0 };
    a.posts++;
    a.reach += reach ?? 0;
    if (rate !== null) { a.rateSum += rate; a.rated++; }
    accounts.set(name, a);
  }

  return {
    accounts: [...accounts.entries()]
      .map(([account, a]) => ({ account, posts: a.posts, reach: a.reach, avgEngagement: a.rated ? Math.round((a.rateSum / a.rated) * 100) / 100 : null }))
      .sort((x, y) => y.reach - x.reach),
    top: posts
      .filter((p) => p.reach !== null || p.engagementRate !== null)
      .sort((x, y) => (y.reach ?? 0) - (x.reach ?? 0) || (y.engagementRate ?? 0) - (x.engagementRate ?? 0))
      .slice(0, limit),
    posts: byPost.size,
    latestCapture: rows[0]?.capturedAt.toISOString() ?? null,
    attributed,
  };
}
