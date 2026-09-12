// "Was this good?" — the question the asset page could not answer.
//
// ── WHY THIS IS ARITHMETIC AND NOT A MODEL ────────────────────────────────────────────────────
//
// The page showed three numbers and left the reader to decide whether 1.36M views was remarkable
// or ordinary. Nobody in the room holds that distribution in their head, so the numbers landed as
// decoration. What was missing is not narration — it is a DENOMINATOR.
//
// Glen's condition on the whole pack is that the AI never narrates a number: "if efficiency is a
// recommendation and that's not true, it might derail everything". So nothing here is written by
// a model. Every line is a rank and a median over posts we captured, and the sentence around it
// is a fixed template. A person can check it against the table and it will agree.
//
// ── THE PEER SET, AND WHY IT IS THE PLATFORM ──────────────────────────────────────────────────
//
// Instagram, Facebook and TikTok do not report the same metrics or the same magnitudes — Facebook
// returns no reach and no view count at all, Instagram returns both. A cross-platform median would
// be an Instagram figure wearing a total's clothes (the same trap as Y7 on the week pack), so the
// comparison is always WITHIN a platform and says which one it used.
//
// The window is whatever Perch has captured — about a fortnight, ~374 posts. That is stated rather
// than implied: "of 195 Instagram posts captured since 27 Aug" is a claim a reader can audit, and
// "above average" is not.

import { prisma } from '@/lib/prisma';
import { swr } from '@/lib/cache/swr';
import { timed } from '@/lib/perf/timed';

/** One platform's distribution, each array ascending, one entry per post. */
export interface PlatformBenchmark {
  platform: string;
  /** Posts captured on this platform. The denominator every line quotes. */
  posts: number;
  views: number[];
  reach: number[];
  /** Engagements as a percentage of reach. Only posts reporting both. */
  engRatePct: number[];
  /** The earliest capture in the window, so the page can say how far back it reaches. */
  since: string | null;
}

interface Row {
  platform: string;
  views: number | null;
  reach: number | null;
  engagements: number | null;
  since: Date | null;
}

/**
 * Per-post figures for every captured post, grouped by platform.
 *
 * Latest capture per post — there are ~5 capture rows each and averaging across them would drag
 * every median toward whatever the cron happened to catch, as well as inflating any sum (Y6).
 *
 * Views read through the same coalesce as the caption index: the `views` column is filled on 30
 * of 2,343 rows, and Instagram's count has always been one key deeper in the stored payload.
 */
export function getBenchmarks(): Promise<Map<string, PlatformBenchmark>> {
  return swr('perch:benchmarks', () => timed('perch.benchmarks', async () => {
    const rows = await prisma.$queryRaw<Row[]>`
      select
        case
          when raw->'details'->'metrics' ? 'instagram_metrics'      then 'Instagram'
          when raw->'details'->'metrics' ? 'facebook_metrics'       then 'Facebook'
          when raw->'details'->'metrics' ? 'tiktokbusiness_metrics' then 'TikTok'
          else 'Other'
        end as platform,
        coalesce(
          views,
          nullif(raw->'details'->'metrics'->'instagram_metrics'->>'post_views', '')::int,
          nullif(raw->'details'->'metrics'->'tiktokbusiness_metrics'->>'video_views', '')::int
        ) as views,
        reach,
        engagements,
        since
      from (
        select distinct on (platform_post_id)
          platform_post_id, raw, views, reach, engagements,
          min(captured_at) over () as since
        from social_metrics
        where platform_post_id is not null
        order by platform_post_id, captured_at desc
      ) latest
    `;

    const out = new Map<string, PlatformBenchmark>();
    for (const r of rows) {
      const b = out.get(r.platform) ?? {
        platform: r.platform, posts: 0, views: [], reach: [], engRatePct: [], since: null,
      };
      b.posts += 1;
      if (r.views != null && r.views > 0) b.views.push(r.views);
      if (r.reach != null && r.reach > 0) b.reach.push(r.reach);
      if (r.engagements != null && r.reach != null && r.reach > 0) {
        b.engRatePct.push((r.engagements / r.reach) * 100);
      }
      if (r.since && !b.since) b.since = r.since.toISOString().slice(0, 10);
      out.set(r.platform, b);
    }
    for (const b of out.values()) {
      b.views.sort((a, c) => a - c);
      b.reach.sort((a, c) => a - c);
      b.engRatePct.sort((a, c) => a - c);
    }
    return out;
  }), { fresh: 5 * 60_000, stale: 30 * 60_000 });
}

function median(sorted: number[]): number | null {
  if (!sorted.length) return null;
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

/**
 * Where this value sits from the top — 1 is the best.
 *
 * Counts how many captured posts BEAT it and adds one, rather than counting how many it beats and
 * subtracting. The two agree only when the value is itself in the list; a multi-account average is
 * not, and the subtracting form called a post that one other post beat "the highest of 249".
 */
function rankFromTop(sorted: number[], value: number): number {
  let above = 0;
  for (const v of sorted) if (v > value) above += 1;
  return above + 1;
}

export interface Comparison {
  metric: 'views' | 'reach' | 'engagement rate';
  /** Already formatted, because a rate and a count do not format the same way. */
  value: string;
  median: string;
  /** 1 means the best post on this platform in the window. */
  rank: number;
  of: number;
  /** How many times the median, when that is a fair thing to say. */
  multiple: number | null;
}

export interface AssetComparison {
  platform: string;
  posts: number;
  since: string | null;
  lines: Comparison[];
  /**
   * True when the Airtable row matched several Perch posts — regional accounts repost translated
   * copy. The totals are then across accounts, so they are compared as a PER-POST average and the
   * page says so. Ranking a sum of four posts against single posts would flatter it fourfold.
   */
  perPost: boolean;
}

const int = (n: number): string => Math.round(n).toLocaleString('en-US');
const pct = (n: number): string => `${n.toFixed(1)}%`;

/**
 * Place one post's figures inside its platform's distribution.
 *
 * Returns null rather than an empty shell when there is nothing honest to say — an unmatched post,
 * an unknown platform, or a platform with too few captured posts for a median to mean anything.
 * Four posts do not have a middle worth quoting.
 */
export function compareAsset(
  results: { views: number | null; reach: number | null; engagements: number | null; posts: number },
  platforms: string[],
  benchmarks: Map<string, PlatformBenchmark>,
): AssetComparison | null {
  // A post on two platforms is compared against the one we have most captures for, named on the
  // page — not against both, which would invite reading two ranks as one.
  const b = platforms
    .map((p) => benchmarks.get(p))
    .filter((x): x is PlatformBenchmark => !!x)
    .sort((x, y) => y.posts - x.posts)[0];
  if (!b || b.posts < 10) return null;

  const n = Math.max(1, results.posts);
  const perPost = n > 1;
  const views = results.views != null ? results.views / n : null;
  const reach = results.reach != null ? results.reach / n : null;
  const engRate =
    results.engagements != null && results.reach != null && results.reach > 0
      ? (results.engagements / results.reach) * 100
      : null;

  const lines: Comparison[] = [];
  const add = (
    metric: Comparison['metric'],
    value: number | null,
    sorted: number[],
    fmt: (n: number) => string,
    withMultiple: boolean,
  ) => {
    if (value == null) return;
    const med = median(sorted);
    if (med == null || sorted.length < 10) return;
    lines.push({
      metric,
      value: fmt(value),
      median: fmt(med),
      rank: rankFromTop(sorted, value),
      of: sorted.length,
      // A multiple of a rate is a confusing thing to read ("1.4× the median rate"), so only counts
      // carry one, and only when the median is not so small that the ratio is noise.
      multiple: withMultiple && med >= 100 ? value / med : null,
    });
  };

  add('views', views, b.views, int, true);
  add('reach', reach, b.reach, int, true);
  add('engagement rate', engRate, b.engRatePct, pct, false);

  return lines.length ? { platform: b.platform, posts: b.posts, since: b.since, lines, perPost } : null;
}
