// Reads over the publication graph: snapshots, cohorts, readouts.
//
// This is the half of the intelligence that needs no model. Everything here is arithmetic
// over rows — which is deliberate: the numbers must be reproducible by anyone with SQL, and
// a language model that narrates a number it did not compute is the failure mode this team
// has already been burned by.

import { prisma } from '@/lib/prisma';

/** Metrics we can compare. Retention is the one an editor actually controls. */
export type MetricKey = 'views' | 'reach' | 'engagementRate' | 'saves' | 'shares' | 'comments' | 'likes' | 'avgWatchSeconds';

export const METRIC_LABEL: Record<MetricKey, string> = {
  views: 'Views', reach: 'Reach', engagementRate: 'Engagement rate', saves: 'Saves',
  shares: 'Shares', comments: 'Comments', likes: 'Likes', avgWatchSeconds: 'Avg watch (s)',
};

/**
 * Which metric a publication is judged on, from its content pillar [D4, D36].
 *
 * The point of this map is that one number cannot be right for every post. A gated-CTA reel
 * that asks for a comment and gets them has done its job even with below-median views, and
 * measuring it on views would tell its editor to stop doing the thing that worked.
 */
export function goalMetric(goal: string | null | undefined, caption?: string | null): MetricKey {
  if (caption && /comment\s*["'“]/i.test(caption)) return 'comments';
  const g = (goal ?? '').toLowerCase();
  if (g.includes('educate')) return 'saves';
  if (g.includes('inspire') || g.includes('entertain')) return 'shares';
  if (g.includes('launch') || g.includes('announce')) return 'reach';
  return 'views';
}

export interface Snapshot {
  capturedAt: Date;
  /** True hours between publish and capture. Always displayed — never assumed. */
  ageHours: number;
  values: Partial<Record<MetricKey, number>>;
}

/**
 * The nightly Perch pull runs at 03:30 UTC, so a post published the previous evening is first
 * seen about nine hours later — not the 18–36h a "day one" reading would suggest. Rather than
 * discard the captures we actually have, the window is widened and the true age is shown
 * beside every number. A reading is only ever labelled by what it is.
 */
const DAY1_WINDOW_H = { min: 6, max: 48 };
const DAY7_WINDOW_H = { min: 144, max: 204 };

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function snapshotFrom(rows: Array<{ capturedAt: Date; [k: string]: unknown }>, publishedAt: Date, window: { min: number; max: number }): Snapshot | null {
  const inWindow = rows
    .map((r) => ({ r, ageHours: (r.capturedAt.getTime() - publishedAt.getTime()) / 3_600_000 }))
    .filter(({ ageHours }) => ageHours >= window.min && ageHours <= window.max)
    .sort((a, b) => a.ageHours - b.ageHours);
  const hit = inWindow[0];
  if (!hit) return null;
  const values: Partial<Record<MetricKey, number>> = {};
  for (const k of Object.keys(METRIC_LABEL) as MetricKey[]) {
    const v = toNum(hit.r[k]);
    if (v !== null) values[k] = v;
  }
  return { capturedAt: hit.r.capturedAt, ageHours: Math.round(hit.ageHours), values };
}

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export interface CohortReading {
  metric: MetricKey;
  value: number | null;
  cohortMedian: number | null;
  /** 1 = best in cohort. Null when there is no cohort to rank against. */
  rank: number | null;
  n: number;
}

export interface Readout {
  window: 'day1' | 'day7';
  snapshot: Snapshot;
  /** How the cohort was drawn, in words, so the comparison can be argued with. */
  cohortLabel: string;
  n: number;
  /** Below this the readout shows numbers but states no verdict [D105]. */
  belowFloor: boolean;
  readings: CohortReading[];
}

export const COHORT_FLOOR = 3;      // no median at all below this [D105]
export const PROPOSAL_FLOOR = 8;    // no learning proposed below this [D12]
const COHORT_WINDOW_DAYS = 90;      // rolling, from this post's own publish date [D105]

interface PubWithMetrics {
  id: string;
  accountRef: string;
  postType: string | null;
  publishedAt: Date | null;
  goal: string | null;
  metrics: Array<{ capturedAt: Date } & Record<string, unknown>>;
}

/**
 * Peers: same account, same post type, published within the 90 days before this post — and
 * never the post itself [D105].
 *
 * Same account because audiences differ by an order of magnitude; same post type because a
 * reel and a carousel are not the same act; excluding self because a median you are inside
 * flatters you. Instagram Stories are left out entirely: they expire, so their numbers are
 * not comparable with anything that persists.
 *
 * All accounts in the Perch grant are organic — paid creative lives in a separate Ads library
 * and never reaches this table — so the organic-only rule holds by construction. If a boosted
 * flag ever appears in the payload, it belongs in this predicate.
 */
async function cohortFor(pub: PubWithMetrics): Promise<PubWithMetrics[]> {
  if (!pub.publishedAt || !pub.postType) return [];
  if (/STORY/i.test(pub.postType)) return [];
  const from = new Date(pub.publishedAt.getTime() - COHORT_WINDOW_DAYS * 86_400_000);
  return prisma.publication.findMany({
    where: {
      accountRef: pub.accountRef,
      postType: pub.postType,
      publishedAt: { gte: from, lte: pub.publishedAt },
      id: { not: pub.id },
      removedFromPlatformAt: null,
    },
    select: {
      id: true, accountRef: true, postType: true, publishedAt: true, goal: true,
      metrics: {
        select: {
          capturedAt: true, views: true, reach: true, engagementRate: true, saves: true,
          shares: true, comments: true, likes: true, avgWatchSeconds: true,
        },
      },
    },
  }) as unknown as Promise<PubWithMetrics[]>;
}

/** Both readouts for one publication, with its cohort. */
export async function readoutsFor(publicationId: string): Promise<{ publication: PubWithMetrics; readouts: Readout[] } | null> {
  const pub = (await prisma.publication.findUnique({
    where: { id: publicationId },
    select: {
      id: true, accountRef: true, postType: true, publishedAt: true, goal: true,
      metrics: {
        select: {
          capturedAt: true, views: true, reach: true, engagementRate: true, saves: true,
          shares: true, comments: true, likes: true, avgWatchSeconds: true,
        },
      },
    },
  })) as unknown as PubWithMetrics | null;
  if (!pub || !pub.publishedAt) return null;

  const peers = await cohortFor(pub);
  const readouts: Readout[] = [];

  for (const [window, w] of [['day1', DAY1_WINDOW_H], ['day7', DAY7_WINDOW_H]] as const) {
    const snap = snapshotFrom(pub.metrics, pub.publishedAt, w);
    if (!snap) continue;

    const peerSnaps = peers
      .map((p) => (p.publishedAt ? snapshotFrom(p.metrics, p.publishedAt, w) : null))
      .filter((s): s is Snapshot => s !== null);

    const n = peerSnaps.length;
    const readings: CohortReading[] = (Object.keys(METRIC_LABEL) as MetricKey[]).map((metric) => {
      const value = snap.values[metric] ?? null;
      const peerValues = peerSnaps.map((s) => s.values[metric]).filter((v): v is number => v !== undefined);
      const cohortMedian = peerValues.length >= COHORT_FLOOR ? median(peerValues) : null;
      const rank = value !== null && peerValues.length >= COHORT_FLOOR
        ? peerValues.filter((v) => v > value).length + 1
        : null;
      return { metric, value, cohortMedian, rank, n: peerValues.length };
    }).filter((r) => r.value !== null || r.cohortMedian !== null);

    readouts.push({
      window,
      snapshot: snap,
      cohortLabel: `${pub.accountRef} · ${pub.postType ?? 'post'} · published within 90 days before this one`,
      n,
      belowFloor: n < COHORT_FLOOR,
      readings,
    });
  }

  return { publication: pub, readouts };
}

/** Publications for a ticket, newest first. */
export async function publicationsForTicket(ticketAirtableId: string) {
  return prisma.publication.findMany({
    where: { ticketAirtableId },
    orderBy: { publishedAt: 'desc' },
  });
}

export interface CoverageReport {
  publications: number;
  linked: number;
  confirmed: number;
  proposed: number;
  orphans: number;
  /** Linked within 24h of publishing — the 60-day target [D115]. */
  linkedWithin24h: number;
  linkedWithKnownTime: number;
  metricsTotal: number;
  metricsWithPublication: number;
  metricsWithViews: number;
  metricsWithWatch: number;
  lastCaptureAt: Date | null;
}

/** The numbers the 60-day promise is judged on. Cheap enough to compute per request. */
export async function coverage(): Promise<CoverageReport> {
  const [publications, linked, confirmed, proposed, metricsTotal, metricsWithPublication, metricsWithViews, metricsWithWatch, last, timed] =
    await Promise.all([
      prisma.publication.count(),
      prisma.publication.count({ where: { OR: [{ ticketAirtableId: { not: null } }, { vishenVideoId: { not: null } }] } }),
      prisma.publication.count({ where: { confirmed: true } }),
      prisma.publication.count({ where: { confirmed: false, linkTier: { not: null } } }),
      prisma.socialMetric.count(),
      prisma.socialMetric.count({ where: { publicationId: { not: null } } }),
      prisma.socialMetric.count({ where: { views: { not: null } } }),
      prisma.socialMetric.count({ where: { avgWatchSeconds: { not: null } } }),
      prisma.socialMetric.findFirst({ orderBy: { capturedAt: 'desc' }, select: { capturedAt: true } }),
      prisma.publication.findMany({
        where: { linkedAt: { not: null }, publishedAt: { not: null } },
        select: { linkedAt: true, publishedAt: true },
      }),
    ]);

  const linkedWithin24h = timed.filter(
    (p) => p.linkedAt!.getTime() - p.publishedAt!.getTime() <= 24 * 3_600_000,
  ).length;

  return {
    publications, linked, confirmed, proposed,
    orphans: publications - linked,
    linkedWithin24h,
    linkedWithKnownTime: timed.length,
    metricsTotal, metricsWithPublication, metricsWithViews, metricsWithWatch,
    lastCaptureAt: last?.capturedAt ?? null,
  };
}

/**
 * Staleness, in the only terms that mean anything here: missed nightly pulls [D108].
 * The number stays visible whatever this says — it is labelled, never hidden.
 */
export function freshness(lastCaptureAt: Date | null): { state: 'fresh' | 'stale' | 'not-current'; hours: number | null; label: string } {
  if (!lastCaptureAt) return { state: 'not-current', hours: null, label: 'never captured' };
  const hours = Math.round((Date.now() - lastCaptureAt.getTime()) / 3_600_000);
  if (hours > 60) return { state: 'not-current', hours, label: `not current — ${hours}h since the last capture (two missed pulls)` };
  if (hours > 36) return { state: 'stale', hours, label: `${hours}h since the last capture (one missed pull)` };
  return { state: 'fresh', hours, label: `captured ${hours}h ago` };
}
