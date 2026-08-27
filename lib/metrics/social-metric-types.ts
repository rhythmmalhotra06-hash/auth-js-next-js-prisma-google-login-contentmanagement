// Server-free half of the performance loop: the row shapes plus the pure parse/format/
// summarize helpers. Split out of social-perf.ts because the Studio drawer and overview
// are client components — importing the prisma-backed module from them pulls `pg` (and
// its node `tls`/`net` imports) into the browser bundle and fails the build. Same reason
// lib/clipping/clip-types.ts exists.

/** Where a metric row came from. */
export type MetricSource = 'manual' | 'hootsuite:perch';

export interface SocialMetricInput {
  source: MetricSource;
  /** Stable id from the platform/Hootsuite, when the source knows it. Best key. */
  platformPostId?: string | null;
  /** Public permalink. The key that actually joins to our data today. */
  publishedUrl?: string | null;
  /** VishenVideo.id, when the caller already knows it (skips URL resolution). */
  vishenVideoId?: string | null;
  ticketAirtableId?: string | null;
  channel?: string | null;
  impressions?: number | null;
  views?: number | null;
  reach?: number | null;
  engagements?: number | null;
  /** Percent, e.g. 5.1 — not a 0–1 fraction. */
  engagementRate?: number | null;
  clicks?: number | null;
  /** 1 = 24h, 30 = last 30d, null/omitted = lifetime. */
  windowDays?: number | null;
  /** Defaults to now. */
  capturedAt?: string | Date | null;
  enteredBy?: string | null;
  raw?: unknown;
}

/** A stored row, in the shape the read side wants. */
export interface SocialMetricRow {
  publishedUrl: string | null;
  vishenVideoId: string | null;
  channel: string | null;
  impressions: number | null;
  views: number | null;
  /** Unique accounts reached. The only volume metric Hootsuite Perch actually returned on
   *  the first live pull, so the band must be able to fall back to it. */
  reach: number | null;
  engagements: number | null;
  engagementRate: number | null;
  clicks: number | null;
  windowDays: number | null;
  capturedAt: Date;
  source: string;
  enteredBy: string | null;
}

/**
 * Query parameters that IDENTIFY a post rather than track it, per host. Everything else
 * in the query string is discarded.
 *
 * This list is load-bearing: YouTube keeps the video id in `?v=`, so dropping the whole
 * query string would collapse every `youtube.com/watch?v=...` onto the single key
 * `youtube.com/watch` — one dedupe key for the entire channel, and every video matching
 * whichever row was stored first. Facebook permalinks are the same story with
 * `story_fbid`/`id`. Instagram, LinkedIn and TikTok put the id in the path, so they need
 * no entry here.
 */
const IDENTIFYING_PARAMS: Record<string, string[]> = {
  'youtube.com': ['v'],
  'm.youtube.com': ['v'],
  'facebook.com': ['story_fbid', 'id'],
  'web.facebook.com': ['story_fbid', 'id'],
};

/**
 * Canonical form of a permalink so the same post always lands on the same key:
 * lowercase host, no scheme difference, no `www.`, no fragment, no trailing slash, and
 * only the identifying query params above (IG/YT/LinkedIn all append tracking junk
 * freely). Non-URL strings pass through trimmed so a hand-typed value still dedupes
 * against itself.
 *
 * The PATH KEEPS ITS CASE on purpose. Instagram shortcodes and YouTube video ids are
 * case-sensitive — `/p/AbC` and `/p/abc` are different posts — so lowercasing the whole
 * thing would let two real posts collide on one dedupe key. Both sides of every
 * comparison run through this function, so preserving case costs nothing.
 */
export function normalizeUrl(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/+$/, '');
    const keep = IDENTIFYING_PARAMS[host] ?? [];
    const kept = keep
      .map((k) => [k, u.searchParams.get(k)] as const)
      .filter((kv): kv is readonly [string, string] => kv[1] !== null && kv[1] !== '')
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    return `${host}${path}${kept ? `?${kept}` : ''}`;
  } catch {
    return s;
  }
}

/**
 * Parse a human-typed count: "75.2k" → 75200, "1.2M" → 1200000, "12,345" → 12345.
 * Returns null for anything that isn't a number, so a stray note never becomes a 0.
 */
export function parseCount(raw: string | null | undefined): number | null {
  const s = (raw ?? '').trim().replace(/,/g, '');
  if (!s) return null;
  const m = /^(\d+(?:\.\d+)?)\s*([kmb])?$/i.exec(s);
  if (!m) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? '').toLowerCase()] ?? 1;
  return Math.round(parseFloat(m[1]) * mult);
}

/** Parse a percentage: "5.1%" / "5.1" → 5.1. Rejects out-of-range values. */
export function parseRate(raw: string | null | undefined): number | null {
  const s = (raw ?? '').trim().replace(/%$/, '');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 1000) / 1000;
}

export interface MetricBand {
  /** Always 'Total reach' — see reachOf() for why the total can be a mixed figure. */
  primaryLabel: string;
  primaryTotal: number;
  /** What the total is actually made of, for an honest subtitle. */
  primaryMetric: string;
  avgEngagement: number | null;
  /** Rows carrying numbers. */
  withNumbers: number;
  /** How many rows contributed to primaryTotal — lets the UI say "N of M posts"
   *  instead of implying every post is represented. */
  primaryFrom: number;
  sources: string[];
}

/**
 * The one comparable "how far did this go" number for a single post: views when the
 * platform reports views, impressions when it only reports impressions.
 *
 * Yes, this can mix two metrics that aren't identical. The alternative proved worse: a
 * real channel set is heterogeneous (YouTube reports views, Instagram post-Apr-2025
 * reports views, Hootsuite talks impressions), and picking one metric globally made the
 * headline cover 1 of 3 posts while ignoring 165k views — precise and useless. The band
 * names the mix in its subtitle instead of hiding it.
 */
export function reachOf(r: SocialMetricRow): number | null {
  return r.views ?? r.impressions ?? r.reach ?? null;
}

/** Which field reachOf() actually used for this row — so the band can disclose the mix. */
function reachSourceOf(r: SocialMetricRow): 'views' | 'impressions' | 'reach' | null {
  if (r.views != null) return 'views';
  if (r.impressions != null) return 'impressions';
  if (r.reach != null) return 'reach';
  return null;
}

/**
 * Roll a set of metric rows into the Studio band. Totals reachOf() across every row that
 * has one, and reports what the figure is made of so a mixed set is disclosed, not
 * disguised.
 */
export function summarizeBand(rows: SocialMetricRow[]): MetricBand {
  const contributing = rows.filter((r) => reachOf(r) != null);
  // Name every field the total is drawn from, in a stable order. Perch's first live pull
  // returned reach only — with views/impressions the sole options the band read
  // "Total reach 0" over 92 good rows, which is worse than showing nothing.
  const used = (['views', 'impressions', 'reach'] as const)
    .filter((f) => contributing.some((r) => reachSourceOf(r) === f));
  const primaryTotal = contributing.reduce((s, r) => s + (reachOf(r) ?? 0), 0);
  const rated = rows.filter((r) => r.engagementRate != null);
  return {
    primaryLabel: 'Total reach',
    primaryMetric: used.length ? used.join(' + ') : 'views',
    primaryTotal,
    primaryFrom: contributing.length,
    avgEngagement: rated.length
      ? Math.round((rated.reduce((s, r) => s + (r.engagementRate ?? 0), 0) / rated.length) * 100) / 100
      : null,
    withNumbers: rows.length,
    sources: [...new Set(rows.map((r) => r.source))].sort(),
  };
}

/** Compact display form for a count: 1234 → "1.2k", 1200000 → "1.2M". */
export function formatCount(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}k`;
  return String(n);
}
