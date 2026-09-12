// Braze → `email_metrics`. The scheduled half of the email performance loop.
//
// Mirrors lib/hootsuite/perch.ts deliberately: a pull function, a dedupe key that makes a re-run
// an update rather than a duplicate, and a report that says what it could NOT do as loudly as
// what it could.
//
// ── THE ONE JUDGEMENT CALL IN HERE ────────────────────────────────────────────────────────────
//
// The Braze Ops hub classifies campaigns to eight newsletter tags and DROPS everything else.
// That is right for its dashboard and wrong for us: the comms calendar plans launch sequences
// (the Expert to Authority invite emails), product drops and one-offs, and those are exactly the
// ones that would vanish. So an unclassified campaign is kept, with `audience: null`, and its
// name is reported in `unclassified` so the tag map can grow from what the base actually
// contains rather than from a guess made here.

import { prisma } from '@/lib/prisma';
import { timed } from '@/lib/perf/timed';
import {
  listCampaigns,
  getCampaignDetails,
  getCampaignDataSeries,
  brazeConfigured,
  type BrazeCampaignSummary,
  type BrazeDataSeriesPoint,
  type BrazeVariantStats,
} from './client';

/** How many campaigns are in flight at once. The hub runs 8 on the same key — leave it room. */
const CONCURRENCY = 4;

export interface EmailTotals {
  sent: number | null;
  delivered: number | null;
  uniqueOpens: number | null;
  machineOpens: number | null;
  uniqueClicks: number | null;
  unsubscribes: number | null;
  reportedSpam: number | null;
  conversions: number | null;
  revenue: number | null;
}

export interface PullReport {
  campaigns: number;
  emailCampaigns: number;
  upserted: number;
  /** Campaign names whose audience could not be read from tags or name — grow the map from these. */
  unclassified: string[];
  errors: string[];
}

// ── Audience classification ───────────────────────────────────────────────────────────────────

/**
 * Braze tag → the audience name the comms calendar uses.
 *
 * Taken from the Braze Ops hub, which derives the same buckets from the same tags. Kept as data
 * rather than a chain of ifs so that adding a list is a one-line change when the pull reports an
 * unclassified name.
 */
const TAG_AUDIENCE: Record<string, string> = {
  "Vishen's Newsletter": "Vishen's List",
  'Email/List/Daily': 'Daily',
  'Email/List/Highlights': 'Highlights',
  'Email/List/Weekly': 'Weekly',
  Weekly: 'Weekly',
  'Email/List/Sublist': 'Sublist',
  Events: 'Events',
  'MV Coach': 'Coach',
  'Email/Campaign - Members': 'Members',
  Mastery: 'Mastery',
};

/** Last resort: the list is usually spelled out in the campaign name. */
const NAME_AUDIENCE: [RegExp, string][] = [
  [/\bvishen'?s? (list|newsletter)\b/i, "Vishen's List"],
  [/\bhighlights\b/i, 'Highlights'],
  [/\bdaily\b/i, 'Daily'],
  [/\bweekly\b/i, 'Weekly'],
  [/\bmembers?\b/i, 'Members'],
  [/\bcoach\b/i, 'Coach'],
  [/\bevents?\b/i, 'Events'],
  [/\bmastery\b/i, 'Mastery'],
];

/** Which list a campaign went to. Null is a real answer — the caller reports it, never guesses. */
export function audienceOf(name: string, tags: string[] = []): string | null {
  for (const t of tags) {
    const hit = TAG_AUDIENCE[t];
    if (hit) return hit;
  }
  for (const [re, audience] of NAME_AUDIENCE) {
    if (re.test(name)) return audience;
  }
  return null;
}

// ── Summing a data series ─────────────────────────────────────────────────────────────────────

const add = (a: number | null, b: number | undefined): number | null =>
  typeof b === 'number' && Number.isFinite(b) ? (a ?? 0) + b : a;

/**
 * Total a campaign's daily buckets, optionally only the first `windowDays` from `firstSentAt`.
 *
 * TWO RULES, both of which produce wrong numbers if dropped:
 *
 *  1. **Control variants carry no send.** A holdout variant is in the same bucket as the real
 *     one; counting it inflates nothing (it has no sends) but its presence in the array invites
 *     a naive sum over `Object.values`. It is excluded by name so the intent is explicit.
 *  2. **`machine_open` is inside `unique_opens`, not beside it.** Braze reports Apple MPP opens
 *     as a subset. Keeping the subset lets the UI say what share of an open rate is a machine;
 *     SUBTRACTING it here would silently redefine open rate against every other Mindvalley
 *     surface, so it is stored and not netted off.
 */
export function sumDataSeries(
  points: BrazeDataSeriesPoint[],
  opts: { firstSentAt?: Date | null; windowDays?: number | null } = {},
): EmailTotals {
  const totals: EmailTotals = {
    sent: null, delivered: null, uniqueOpens: null, machineOpens: null,
    uniqueClicks: null, unsubscribes: null, reportedSpam: null, conversions: null, revenue: null,
  };

  const from = opts.firstSentAt ? new Date(opts.firstSentAt) : null;
  const windowDays = opts.windowDays ?? null;
  // The window runs from the START of the send day, so a 1am send and a 11pm send both get the
  // same two calendar days. Braze's buckets are calendar days in the workspace's timezone.
  const until = from && windowDays ? new Date(new Date(from.toISOString().slice(0, 10)).getTime() + windowDays * 86400_000) : null;

  for (const point of points) {
    if (until || from) {
      const t = new Date(point.time);
      if (Number.isNaN(t.getTime())) continue;
      if (from && t < new Date(from.toISOString().slice(0, 10))) continue;
      if (until && t >= until) continue;
    }
    for (const variants of Object.values(point.messages ?? {})) {
      for (const v of variants as BrazeVariantStats[]) {
        if ((v.variation_name ?? '').toLowerCase() === 'control') continue;
        totals.sent = add(totals.sent, v.sent);
        totals.delivered = add(totals.delivered, v.delivered);
        totals.uniqueOpens = add(totals.uniqueOpens, v.unique_opens);
        totals.machineOpens = add(totals.machineOpens, v.machine_open);
        totals.uniqueClicks = add(totals.uniqueClicks, v.unique_clicks);
        totals.unsubscribes = add(totals.unsubscribes, v.unsubscribes);
        totals.reportedSpam = add(totals.reportedSpam, v.reported_spam);
        totals.conversions = add(totals.conversions, v.conversions_by_send_time ?? v.conversions);
        totals.revenue = add(totals.revenue, v.revenue);
      }
    }
  }
  return totals;
}

/** The email subject, taken from the first non-control variant that has one. */
export function subjectOf(messages: Record<string, { channel?: string; subject?: string; variation_name?: string }> = {}): string | null {
  for (const m of Object.values(messages)) {
    if (m.channel && m.channel !== 'email') continue;
    const s = m.subject?.trim();
    if (s) return s;
  }
  return null;
}

/** True when any of the campaign's messages is an email. Push-only campaigns are not our business. */
export function isEmailCampaign(channels: string[] = [], messages: Record<string, { channel?: string }> = {}): boolean {
  if (channels.some((c) => c.toLowerCase().includes('email'))) return true;
  return Object.values(messages).some((m) => m.channel === 'email');
}

// ── The pull ──────────────────────────────────────────────────────────────────────────────────

const day = (d: Date): string => d.toISOString().slice(0, 10);

function dedupeKeyFor(campaignId: string, windowDays: number | null, capturedAt: Date): string {
  return `braze:${campaignId}:${windowDays ?? 'todate'}:${day(capturedAt)}`;
}

const hasAny = (t: EmailTotals): boolean =>
  Object.values(t).some((v) => typeof v === 'number' && v > 0);

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

/**
 * Pull every email campaign edited in the last `sinceDays` into `email_metrics`.
 *
 * Two rows per campaign: the `windowDays = 2` figure (the send day plus the next — the honest
 * "24h", see client.ts) and the to-date figure. Both are upserted on today's dedupe key, so a
 * re-run refreshes today and yesterday's capture survives for a time series later.
 */
export async function pullBrazeEmailMetrics({ sinceDays = 14 }: { sinceDays?: number } = {}): Promise<PullReport> {
  const report: PullReport = { campaigns: 0, emailCampaigns: 0, upserted: 0, unclassified: [], errors: [] };
  if (!brazeConfigured()) {
    report.errors.push('BRAZE_API_KEY is not set — nothing pulled.');
    return report;
  }

  const sinceIso = new Date(Date.now() - sinceDays * 86400_000).toISOString();
  const list = await timed('braze.list', () => listCampaigns(sinceIso));
  if (!list.ok) {
    report.errors.push(`campaigns/list: ${list.error.message}`);
    return report;
  }
  report.campaigns = list.data.length;

  const capturedAt = new Date();
  const cutoff = new Date(Date.now() - sinceDays * 86400_000);

  await timed('braze.campaigns', () =>
    mapWithConcurrency(list.data, CONCURRENCY, async (c: BrazeCampaignSummary) => {
      const details = await getCampaignDetails(c.id);
      if (!details.ok) {
        report.errors.push(`${c.name}: details — ${details.error.message}`);
        return;
      }
      const d = details.data;
      if (!isEmailCampaign(d.channels, d.messages)) return;

      // `last_edit.time` bounded the LIST; the send date is what we actually care about, and a
      // campaign edited yesterday may have sent months ago.
      const firstSentAt = d.first_sent ? new Date(d.first_sent) : null;
      if (!firstSentAt || Number.isNaN(firstSentAt.getTime()) || firstSentAt < cutoff) return;

      report.emailCampaigns++;
      const name = d.name ?? c.name;
      const tags = d.tags ?? c.tags ?? [];
      const audience = audienceOf(name, tags);
      if (!audience) report.unclassified.push(name);

      const series = await getCampaignDataSeries(c.id, Math.min(sinceDays + 2, 100));
      if (!series.ok) {
        report.errors.push(`${name}: data_series — ${series.error.message}`);
        return;
      }
      const points = series.data.data ?? [];

      for (const windowDays of [2, null] as (number | null)[]) {
        const totals = sumDataSeries(points, { firstSentAt, windowDays });
        // A campaign that sent but whose buckets are all zero is real (it just went out); one
        // with nothing at all is noise and would render as a row promising numbers it lacks.
        if (!hasAny(totals)) continue;

        const dedupeKey = dedupeKeyFor(c.id, windowDays, capturedAt);
        const data = {
          brazeCampaignId: c.id,
          campaignName: name,
          subject: subjectOf(d.messages),
          audience,
          firstSentAt,
          sent: totals.sent,
          delivered: totals.delivered,
          uniqueOpens: totals.uniqueOpens,
          machineOpens: totals.machineOpens,
          uniqueClicks: totals.uniqueClicks,
          unsubscribes: totals.unsubscribes,
          reportedSpam: totals.reportedSpam,
          conversions: totals.conversions,
          revenue: totals.revenue,
          windowDays,
          capturedAt,
          source: 'braze',
          raw: { tags, channels: d.channels ?? [] },
        };
        try {
          await prisma.emailMetric.upsert({ where: { dedupeKey }, create: { ...data, dedupeKey }, update: data });
          report.upserted++;
        } catch (err) {
          report.errors.push(`${dedupeKey}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }),
  );

  report.unclassified = [...new Set(report.unclassified)];
  return report;
}
