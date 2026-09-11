// The Mindvalley lane's actual posts — titles, channels, images, the creative ticket, and results.
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────────────────────────
//
// The calendar used to render a synthetic `Social +1` chip per day, on the reasoning that the
// meeting reads those rows as volume and resolving every linked title would cost round-trips.
// That was wrong, and the feedback was blunt about it: a count carries no information, so a week
// with six real posts read as an empty calendar. Decision AB1 reverses it — the lane shows the
// work, and a count is what you fall back to, not what you lead with.
//
// ── WHERE EACH FIELD COMES FROM, AND WHY ──────────────────────────────────────────────────────
//
// Measured across all 8,564 📣 Social records on 10 Sep, because the population rate decides what
// this can honestly promise:
//
//   Title 100% · Channels 89% · any image 62%   -> Airtable. Reliable, so these are the spine.
//   Creative Request 1% (15% since July)        -> Airtable. Thin but improving; shown when present.
//   ► Editor 10% (1% since July)                -> Airtable. Mostly a named gap.
//   Final Published Link 3% · Engagement 1%     -> effectively empty, and getting WORSE not better.
//
// So results cannot come from Airtable (AB2). They come from `social_metrics` — Perch, 1,642 rows
// over 329 posts, refreshed nightly — joined on the published CAPTION rather than the URL, because
// the URL is the 3% field.
//
// ── THE MATCH RATE, MEASURED IN THE DIRECTION THAT MATTERS ────────────────────────────────────
//
// An early test sampled Perch captions and found 39 of 40 had an Airtable row, and it would be
// easy to quote that as the match rate. It answers the wrong question. This feature asks the
// reverse — given an Airtable post, are there results? — and that number is lower:
//
//   Airtable Social rows live 27 Aug–10 Sep (the Perch window):  110
//   with a Perch caption match:                                   63  (57%)
//
// 57% is worth having: more than half the posts get real numbers where the Airtable fields would
// have given 1%. But it is NOT most of them, so a missing result must read as "not matched",
// never as zero. The misses are mostly rows whose caption field holds a slug or a briefing note
// ("photo carousel tbc 10 sept") rather than the copy that was published — w/c 31 Aug is an
// entire week like that, matching only 1 of 6. Nothing before 27 Aug can match at all.

import { listAll, type AirtableRecord } from '@/lib/airtable/rest';
import { SOCIAL } from '@/lib/airtable/field-map';
import { prisma } from '@/lib/prisma';
import { swr } from '@/lib/cache/swr';
import { timed } from '@/lib/perf/timed';

export interface SocialPost {
  id: string;
  title: string;
  /** 'FB: MV', 'IG: VL', 'LI: MV'… — what makes a per-platform view possible. */
  channels: string[];
  /** Coarse platform for grouping: Facebook | Instagram | LinkedIn | X | Email | Other. */
  platforms: string[];
  status: string | null;
  liveDate: string | null;
  imageUrl: string | null;
  publishedUrl: string | null;
  /** From the linked Creative Request, when the post has one (15% of recent rows). */
  editor: string | null;
  ticketId: string | null;
  ticketStatus: string | null;
  assetLink: string | null;
  /** Delivered numbers from Perch. Null means no match, NOT zero. */
  results: {
    reach: number | null;
    engagements: number | null;
    posts: number;
    /**
     * True when several Perch posts matched this one row — regional accounts repost translated
     * copy, so the same Airtable record legitimately has a German and an English post behind it.
     * Summing is defensible as total reach; presenting it as one post's number is not.
     */
    multiAccount: boolean;
  } | null;
}

const str = (v: unknown): string | null => {
  if (typeof v === 'string') return v.trim() || null;
  if (Array.isArray(v)) return v.length ? str(v[0]) : null;
  return null;
};
const strs = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : String((x as { name?: string })?.name ?? ''))).filter(Boolean) : [];

/** First attachment url, if any. */
function firstImage(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (Array.isArray(v) && v.length) {
      const a = v[0] as { url?: string; thumbnails?: { large?: { url?: string } } };
      const u = a?.thumbnails?.large?.url ?? a?.url;
      if (u) return u;
    }
  }
  return null;
}

/** `FB: MV` → `Facebook`. The channel list is per-account; the meeting thinks per-platform. */
export function platformOf(channel: string): string {
  const c = channel.trim().toUpperCase();
  if (c.startsWith('FB')) return 'Facebook';
  if (c.startsWith('IG')) return 'Instagram';
  if (c.startsWith('LI')) return 'LinkedIn';
  if (c.startsWith('X:')) return 'X';
  if (c.startsWith('EMAIL')) return 'Email';
  return 'Other';
}

/**
 * Normalise a caption for matching.
 *
 * Aggressive on purpose: emoji, punctuation and hashtags differ between what was drafted in
 * Airtable and what the platform returned, while the words do not.
 */
const norm = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** How much of a caption has to agree. Long enough that two different posts cannot collide. */
const MATCH_LEN = 45;

interface PerchRow { caption: string; reach: bigint | null; eng: bigint | null }

interface PerchHit { reach: number; eng: number; posts: number }

/**
 * The caption index: exact-prefix lookup plus the ordered key list the fallback scans.
 *
 * The fallback used to be `[...perch.entries()].find(...)` — materialising the whole map into an
 * array for every post that missed the exact prefix, up to three times per post. Precomputing
 * the keys once makes that a plain array scan.
 */
interface PerchIndex { byPrefix: Map<string, PerchHit>; keys: string[] }

/**
 * Delivered numbers per post, keyed by a normalised caption prefix.
 *
 * One query for the whole window rather than one per post. Latest capture per post — there are
 * ~5 capture rows each, and summing across them inflates every figure by about 5×.
 *
 * Memoised for five minutes: Perch is captured nightly, so recomputing this scan on every page
 * load (it was) can never show anything new between two loads in the same meeting.
 */
function perchByCaption(): Promise<PerchIndex> {
  return swr('perch:captions', () => timed('perch.captions', async () => {
    const rows = await prisma.$queryRaw<PerchRow[]>`
      with latest as (
        select distinct on (platform_post_id)
          platform_post_id,
          raw->'details'->'content'->>'body' as caption,
          reach, engagements
        from social_metrics
        where platform_post_id is not null
          and raw->'details'->'content'->>'body' is not null
        order by platform_post_id, captured_at desc
      )
      select caption, sum(reach)::bigint as reach, sum(engagements)::bigint as eng
      from latest group by caption
    `;

    const byPrefix = new Map<string, PerchHit>();
    for (const r of rows) {
      const key = norm(r.caption).slice(0, MATCH_LEN);
      if (key.length < 25) continue;
      const cur = byPrefix.get(key) ?? { reach: 0, eng: 0, posts: 0 };
      byPrefix.set(key, {
        reach: cur.reach + Number(r.reach ?? 0),
        eng: cur.eng + Number(r.eng ?? 0),
        posts: cur.posts + 1,
      });
    }
    return { byPrefix, keys: [...byPrefix.keys()] };
  }), { fresh: 5 * 60_000, stale: 15 * 60_000 });
}

const EMPTY_INDEX: PerchIndex = { byPrefix: new Map(), keys: [] };

/** Map one Airtable record, attaching Perch results when a caption matches. */
function toPost(r: AirtableRecord, perch: PerchIndex): SocialPost {
  const f = r.fields as Record<string, unknown>;
  const P = SOCIAL.published;
  const channels = strs(f[P.channels]);

  // Try the drafted caption first, then the title, then the brief — the same order that matched
  // 39 of 40 sampled Perch captions.
  let results: SocialPost['results'] = null;
  for (const raw of [f[SOCIAL.fields.captions], f[SOCIAL.fields.title], f[SOCIAL.fields.notes]]) {
    const v = typeof raw === 'string' ? norm(raw) : '';
    if (v.length < 25) continue;
    let hit = perch.byPrefix.get(v.slice(0, MATCH_LEN));
    if (!hit) {
      const k = perch.keys.find((key) => v.includes(key));
      if (k) hit = perch.byPrefix.get(k);
    }
    if (hit) {
      results = {
        reach: hit.reach || null,
        engagements: hit.eng || null,
        posts: hit.posts,
        multiAccount: hit.posts > 1,
      };
      break;
    }
  }

  return {
    id: r.id,
    title: str(f[SOCIAL.fields.title]) ?? '(untitled)',
    channels,
    platforms: [...new Set(channels.map(platformOf))],
    status: str(f[SOCIAL.fields.status]),
    liveDate: str(f[P.liveDate])?.slice(0, 10) ?? null,
    imageUrl: firstImage(f[P.reference], f[P.assetsReferences]),
    publishedUrl: str(f[P.finalPublishedLink]) ?? str(f[P.instagramPublishedLink]),
    editor: str(f[P.editor]) ?? str(f[P.assignedCreative]),
    ticketId: str(f[SOCIAL.fields.creativeTicketId]),
    ticketStatus: str(f[P.ticketStatusLookup]),
    assetLink: str(f[P.assetLinkLookup]),
    results,
  };
}

/** Airtable rejects very long formulas, so ids are requested in batches. */
const ID_BATCH = 40;

/**
 * Resolve a set of 📣 Social record ids to real posts.
 *
 * Fetched BY ID rather than by scanning the table. The table is ~8,564 rows, which `listAll`
 * pages at 100 a time — 86 sequential requests against a 5 req/sec budget, so about seventeen
 * seconds on a page load that has to feel instant in a meeting. A week links a few dozen posts,
 * so one or two filtered requests cover it, and with the per-base limiter they run concurrently.
 */
export async function getSocialPosts(ids: string[]): Promise<Map<string, SocialPost>> {
  const wanted = [...new Set(ids)];
  if (!wanted.length) return new Map();

  const batches: string[][] = [];
  for (let i = 0; i < wanted.length; i += ID_BATCH) batches.push(wanted.slice(i, i + ID_BATCH));

  const [perch, ...results] = await Promise.all([
    perchByCaption().catch(() => EMPTY_INDEX),
    ...batches.map((b) =>
      listAll(SOCIAL.baseId, SOCIAL.tableId, {
        filterByFormula: `OR(${b.map((id) => `RECORD_ID()='${id}'`).join(',')})`,
      }),
    ),
  ]);

  const out = new Map<string, SocialPost>();
  for (const res of results) {
    if (!res.ok) continue;
    for (const r of res.data) out.set(r.id, toPost(r, perch));
  }
  return out;
}
