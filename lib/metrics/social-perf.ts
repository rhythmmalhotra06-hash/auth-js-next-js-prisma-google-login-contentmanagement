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
import { normalizeUrl, reachOf, isPostPermalink, type PostKind, type SocialMetricInput, type SocialMetricRow } from '@/lib/metrics/social-metric-types';

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

/** Stable key for "the same post", regardless of which window or day a row came from. */
function linkKey(platformPostId: string | null, publishedUrl: string | null): string {
  return platformPostId ?? publishedUrl ?? '';
}

/**
 * Carry forward any attribution a human (or an earlier match) already established for
 * these posts.
 *
 * Without this, attaching a post to a ticket lasts until the next nightly pull: rows are
 * keyed by captured DAY, so tomorrow writes a fresh row with an empty link and the manual
 * work silently evaporates. Inheriting means each attachment is made once and sticks — and
 * it's what turns manual attaching into a matcher that improves over time.
 */
async function inheritLinks(
  prepared: Array<{ platformPostId: string | null; publishedUrl: string | null }>,
): Promise<Map<string, { vishenVideoId: string | null; ticketAirtableId: string | null }>> {
  const out = new Map<string, { vishenVideoId: string | null; ticketAirtableId: string | null }>();
  const ids = prepared.map((p) => p.platformPostId).filter((x): x is string => !!x);
  const urls = prepared.map((p) => p.publishedUrl).filter((x): x is string => !!x);
  if (ids.length === 0 && urls.length === 0) return out;
  try {
    const rows = await prisma.socialMetric.findMany({
      where: {
        AND: [
          { OR: [{ platformPostId: { in: ids } }, { publishedUrl: { in: urls } }] },
          { OR: [{ vishenVideoId: { not: null } }, { ticketAirtableId: { not: null } }] },
        ],
      },
      orderBy: { capturedAt: 'desc' },
      select: { platformPostId: true, publishedUrl: true, vishenVideoId: true, ticketAirtableId: true },
    });
    for (const r of rows) {
      // Newest first, so the first hit per key wins and a later re-attach beats an older one.
      for (const key of [linkKey(r.platformPostId, r.publishedUrl), r.publishedUrl ?? '']) {
        if (key && !out.has(key)) out.set(key, { vishenVideoId: r.vishenVideoId, ticketAirtableId: r.ticketAirtableId });
      }
    }
  } catch {
    // No history to inherit is not an error — the batch just lands unattributed.
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
  const inherited = await inheritLinks(prepared);

  for (const p of prepared) {
    const prior = inherited.get(linkKey(p.platformPostId, p.publishedUrl));
    const vishenVideoId = p.vishenVideoId ?? (p.publishedUrl ? byUrl.get(p.publishedUrl) ?? null : null) ?? prior?.vishenVideoId ?? null;
    const ticketAirtableId = p.ticketAirtableId ?? prior?.ticketAirtableId ?? null;
    const data = { ...p, vishenVideoId, ticketAirtableId };
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
  platformPostId: string | null;
  /** Ticket this post has been attached to, if a human linked it. */
  ticketAirtableId: string | null;
  /** Reach as a multiple of this account's median post. The comparison is the insight —
   *  a raw number tells you nothing about whether it did well. Null when there's no
   *  baseline yet or the post reports no reach. */
  vsMedian: number | null;
  /** Percentile rank of this post's reach within its account, 0–100.
   *
   *  Carried alongside vsMedian because reach here is wildly skewed (p50 2.7k, p75 20k,
   *  max 172k — two content classes in one account), which makes a multiple read as
   *  "62× typical" and look broken even when it's arithmetically right. A percentile is
   *  robust to that: "top 3%" means the same thing whatever the distribution. */
  percentile: number | null;
  /** 'story' when the entry has no shareable permalink — Instagram Stories come back with
   *  a CDN media file instead. Baselines are computed WITHIN a kind, because a story
   *  reaching 1k and a reel reaching 150k are not the same event. */
  kind: PostKind;
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

/** One account's board: its totals plus its own best posts. Every connected account gets
 *  one, so adding a profile in Hootsuite adds a board here with no code change. */
export interface AccountBoard {
  account: string;
  posts: number;
  reach: number;
  avgEngagement: number | null;
  top: SocialPostRow[];
  /** The baseline every post is judged against. */
  medianReach: number | null;
  /** Reach per ISO week, oldest first — the sparkline series. */
  weekly: { week: string; reach: number; posts: number }[];
  /** Last 7 days vs the 7 before, as a percentage change. Null when either side is empty,
   *  because "+∞%" from a zero base is noise, not news. */
  trendPct: number | null;
  /** Real posts below half their own kind's median — the ones worth asking about. */
  underperformers: SocialPostRow[];
  /** How the account's rows split by kind, so a reader knows what's in the baseline. */
  kinds: { post: number; story: number };
}

export interface AccountPerformance {
  boards: AccountBoard[];
  posts: number;
  reach: number;
  avgEngagement: number | null;
  latestCapture: string | null;
  /** Rows tied to a portal record. Zero is expected while the reported account and our
   *  records cover different channels — surfaced so it reads as a known gap, not a bug. */
  attributed: number;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Monday-anchored ISO date for the week a timestamp falls in. */
function weekKey(iso: string): string {
  const d = new Date(iso);
  const day = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function fromRaw(raw: unknown): { caption: string | null; account: string | null; link: string | null; postedAt: string | null } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const details = (r.details ?? {}) as Record<string, unknown>;
  const content = (details.content ?? {}) as Record<string, unknown>;
  const source = (details.source ?? {}) as Record<string, unknown>;
  // Only surface a link we'd be willing to show a human: Perch returns a CDN media file
  // as `source_link` for stories, and a 600-character cdninstagram URL is not a post link.
  const rawLink = str(details.source_link);
  return {
    caption: str(content.body) ?? str(content.title) ?? null,
    account: str(source.name),
    link: isPostPermalink(rawLink) ? rawLink : null,
    postedAt: str(r.timestamp),
  };
}

/**
 * Per-account rollup plus the best-performing posts, ranked by reachOf(). Collapses the
 * per-window rows a post accumulates down to its newest capture, so one post counts once.
 */
export async function getAccountPerformance(opts?: { limit?: number; scanCap?: number }): Promise<AccountPerformance> {
  const limit = opts?.limit ?? 10;
  const empty: AccountPerformance = { boards: [], posts: 0, reach: 0, avgEngagement: null, latestCapture: null, attributed: 0 };
  let rows;
  try {
    rows = await prisma.socialMetric.findMany({
      orderBy: { capturedAt: 'desc' },
      take: opts?.scanCap ?? 1000,
      select: {
        platformPostId: true, publishedUrl: true, vishenVideoId: true, ticketAirtableId: true,
        impressions: true, views: true, reach: true, engagements: true, engagementRate: true,
        capturedAt: true, source: true, raw: true,
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

  const perAccount = new Map<string, SocialPostRow[]>();
  let attributed = 0;

  for (const [key, r] of byPost) {
    const meta = fromRaw(r.raw);
    const rate = r.engagementRate === null ? null : Number(r.engagementRate);
    const reach = reachOf({
      publishedUrl: r.publishedUrl, vishenVideoId: r.vishenVideoId, channel: null,
      impressions: r.impressions, views: r.views, reach: r.reach, engagements: r.engagements,
      engagementRate: rate, clicks: null, windowDays: null, capturedAt: r.capturedAt,
      source: r.source, enteredBy: null,
    });
    if (r.vishenVideoId) attributed++;

    const account = meta.account ?? 'Unattributed account';
    const url = meta.link ?? (isPostPermalink(r.publishedUrl ? `https://${r.publishedUrl}` : null) ? `https://${r.publishedUrl}` : null);
    const row: SocialPostRow = {
      key,
      kind: url ? 'post' : 'story',
      platformPostId: r.platformPostId,
      ticketAirtableId: r.ticketAirtableId,
      vsMedian: null, // filled once the account's baseline is known
      percentile: null,
      url,
      caption: meta.caption,
      account: meta.account,
      reach,
      engagements: r.engagements,
      engagementRate: rate,
      postedAt: meta.postedAt,
      source: r.source,
    };
    (perAccount.get(account) ?? perAccount.set(account, []).get(account)!).push(row);
  }

  const now = Date.now();
  const WEEK = 7 * 86400_000;

  const boards: AccountBoard[] = [...perAccount.entries()]
    .map(([account, rows]) => {
      const rated = rows.filter((x) => x.engagementRate !== null);
      const reaches = rows.map((x) => x.reach).filter((n): n is number => n != null);
      // Headline baseline covers posts only when there are any: stories dominate by count
      // (53 of 92 on the first pull) and drag the "typical post" down to story numbers.
      const postReaches = rows.filter((x) => x.kind === 'post').map((x) => x.reach).filter((n): n is number => n != null);
      const medianReach = median(postReaches.length ? postReaches : reaches);

      // Every post gets its multiple of the baseline AND its percentile. The point of the
      // page is comparison — "158k" means nothing alone. Both are kept because the
      // multiple is intuitive when the spread is tight and misleading when it isn't.
      // Compare like with like: each kind gets its own baseline and its own percentile.
      const byKind = new Map<PostKind, number[]>();
      for (const x of rows) {
        if (x.reach == null) continue;
        (byKind.get(x.kind) ?? byKind.set(x.kind, []).get(x.kind)!).push(x.reach);
      }
      for (const arr of byKind.values()) arr.sort((a, b) => a - b);

      for (const x of rows) {
        const peers = byKind.get(x.kind) ?? [];
        const kindMedian = median(peers);
        x.vsMedian = kindMedian && kindMedian > 0 && x.reach != null
          ? Math.round((x.reach / kindMedian) * 10) / 10
          : null;
        x.percentile = x.reach != null && peers.length > 1
          ? Math.round((peers.filter((n) => n <= x.reach!).length / peers.length) * 100)
          : null;
      }

      const buckets = new Map<string, { reach: number; posts: number }>();
      for (const x of rows) {
        if (!x.postedAt) continue;
        const k = weekKey(x.postedAt);
        const b = buckets.get(k) ?? { reach: 0, posts: 0 };
        b.reach += x.reach ?? 0;
        b.posts++;
        buckets.set(k, b);
      }
      const weekly = [...buckets.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : 1))
        .slice(-8) // ~2 months reads as a direction without becoming a chart
        .map(([week, b]) => ({ week, reach: b.reach, posts: b.posts }));

      const at = (x: SocialPostRow) => (x.postedAt ? new Date(x.postedAt).getTime() : null);
      const sumBetween = (from: number, to: number) =>
        rows.reduce((n, x) => { const t = at(x); return t !== null && t >= from && t < to ? n + (x.reach ?? 0) : n; }, 0);
      const recent = sumBetween(now - WEEK, now + 1); // +1ms so a post from this instant counts
      const prior = sumBetween(now - 2 * WEEK, now - WEEK);

      const ranked = rows
        .filter((x) => x.reach !== null || x.engagementRate !== null)
        .sort((x, y) => (y.reach ?? 0) - (x.reach ?? 0) || (y.engagementRate ?? 0) - (x.engagementRate ?? 0));

      return {
        account,
        posts: rows.length,
        reach: rows.reduce((n, x) => n + (x.reach ?? 0), 0),
        avgEngagement: rated.length
          ? Math.round((rated.reduce((n, x) => n + (x.engagementRate ?? 0), 0) / rated.length) * 100) / 100
          : null,
        medianReach,
        kinds: {
          post: rows.filter((x) => x.kind === 'post').length,
          story: rows.filter((x) => x.kind === 'story').length,
        },
        weekly,
        // Guard the zero base: a jump from nothing isn't +infinity%, it's no signal.
        trendPct: prior > 0 && recent > 0 ? Math.round(((recent - prior) / prior) * 100) : null,
        top: ranked.slice(0, limit),
        // Prefer captioned posts: "(no caption)" three times over is not an actionable
        // list, and 53 of 92 posts here carry no caption text at all.
        // Judged against their OWN kind's baseline (vsMedian already is), and restricted to
        // real posts: a story under-reaching a story is not news, and its CDN link isn't
        // something anyone can open meaningfully.
        underperformers: ranked
          .filter((x) => x.kind === 'post' && x.vsMedian !== null && x.vsMedian < 0.5)
          .slice(-3)
          .reverse(),
      };
    })
    .sort((a, b) => b.reach - a.reach);

  const allRated = [...perAccount.values()].flat().filter((x) => x.engagementRate !== null);
  return {
    boards,
    posts: byPost.size,
    reach: boards.reduce((n, b) => n + b.reach, 0),
    avgEngagement: allRated.length
      ? Math.round((allRated.reduce((n, x) => n + (x.engagementRate ?? 0), 0) / allRated.length) * 100) / 100
      : null,
    latestCapture: rows[0]?.capturedAt.toISOString() ?? null,
    attributed,
  };
}
