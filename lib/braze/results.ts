// Reading `email_metrics` back for a week — the join, done at read time.
//
// The pull stores what Braze said; this decides which planned email each campaign belongs to and
// what the surfaces are allowed to claim about it.
//
// ── TWO RULES ────────────────────────────────────────────────────────────────────────────────
//
//  1. **A miss is "not matched", never zero.** Same rule the social results follow. An email
//     with no matching campaign has no numbers; it did not reach nobody.
//  2. **Nothing is summed across audiences except sends and opens.** Adding two lists' open
//     RATES is meaningless; the rollup recomputes rates from the summed counts instead, and the
//     per-list rows stay available underneath because that is how the team reads them.

import { prisma } from '@/lib/prisma';
import { timed } from '@/lib/perf/timed';
import { matchEmail, MATCH_CONFIDENT, type MatchCandidate, type MatchTarget } from './match';

/** Opens keep arriving for days; below this the figure is still counting and must say so. */
const MATURITY_HOURS = 48;

export interface AudienceResult {
  audience: string | null;
  campaignName: string;
  brazeCampaignId: string;
  sent: number | null;
  delivered: number | null;
  uniqueOpens: number | null;
  machineOpens: number | null;
  uniqueClicks: number | null;
  unsubscribes: number | null;
  revenue: number | null;
  /** Recomputed here rather than stored — a rate is a view of two counts, not a fact of its own. */
  openRate: number | null;
  ctr: number | null;
  ctor: number | null;
  unsubRate: number | null;
  /** 1.00 exact subject · 0.90 subject prefix · 0.60 name overlap. Below 0.9 the UI says "probably". */
  matchScore: number;
  confident: boolean;
  firstSentAt: string | null;
  capturedAt: string;
  /** True while the numbers are still moving — under 48h from the send. */
  maturing: boolean;
}

export interface EmailResults {
  emailId: string;
  perAudience: AudienceResult[];
  /** Counts summed, rates recomputed. Null throughout when nothing matched. */
  total: {
    sent: number;
    delivered: number | null;
    uniqueOpens: number | null;
    uniqueClicks: number | null;
    unsubscribes: number | null;
    revenue: number | null;
    openRate: number | null;
    ctor: number | null;
  } | null;
  maturing: boolean;
  /** Audiences the email was planned for that no campaign matched — the honest gap. */
  unmatchedAudiences: string[];
}

const rate = (num: number | null, den: number | null): number | null =>
  typeof num === 'number' && typeof den === 'number' && den > 0 ? (num / den) * 100 : null;

const n = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : null;
};

/**
 * The latest capture per Braze campaign in a date range.
 *
 * `distinct on` for the same reason the Perch readers use it: the nightly pull writes a row per
 * campaign per day, and summing across captures would multiply every figure by however many
 * nights have passed.
 */
interface MetricRow {
  braze_campaign_id: string;
  campaign_name: string;
  subject: string | null;
  audience: string | null;
  first_sent_at: Date | null;
  sent: number | null;
  delivered: number | null;
  unique_opens: number | null;
  machine_opens: number | null;
  unique_clicks: number | null;
  unsubscribes: number | null;
  revenue: string | number | null;
  captured_at: Date;
}

async function latestCaptures(fromYmd: string, toYmd: string, windowDays: number | null): Promise<MetricRow[]> {
  const window = windowDays === null ? null : windowDays;
  return prisma.$queryRaw<MetricRow[]>`
    select distinct on (braze_campaign_id)
      braze_campaign_id, campaign_name, subject, audience, first_sent_at,
      sent, delivered, unique_opens, machine_opens, unique_clicks, unsubscribes, revenue, captured_at
    from email_metrics
    where first_sent_at >= ${fromYmd}::date
      and first_sent_at < (${toYmd}::date + interval '2 days')
      and (${window}::int is null and window_days is null or window_days = ${window}::int)
    order by braze_campaign_id, captured_at desc
  `;
}

/**
 * Results for a set of planned emails, keyed by their Airtable recId.
 *
 * Best-effort: if the table is empty or unreachable the surfaces show "no Braze campaign
 * matched", which is the same thing they showed before this feature existed.
 */
export async function getEmailResults(
  emails: MatchTarget[],
  range: { from: string; to: string },
  opts: { windowDays?: number | null } = {},
): Promise<Map<string, EmailResults>> {
  const out = new Map<string, EmailResults>();
  if (!emails.length) return out;

  let rows: MetricRow[] = [];
  try {
    rows = await timed('email.results', () => latestCaptures(range.from, range.to, opts.windowDays ?? null));
  } catch {
    return out;
  }
  if (!rows.length) return out;

  const candidates: MatchCandidate[] = rows.map((r) => ({
    brazeCampaignId: r.braze_campaign_id,
    campaignName: r.campaign_name,
    subject: r.subject,
    audience: r.audience,
    firstSentAt: r.first_sent_at,
  }));
  const byId = new Map(rows.map((r) => [r.braze_campaign_id, r]));
  const now = Date.now();

  // One campaign belongs to at most one email: the strongest claim wins, so a shared subject
  // prefix across a sequence cannot attach the same send to two different days.
  const claimed = new Map<string, { emailId: string; score: number }>();
  for (const email of emails) {
    for (const m of matchEmail(email, candidates)) {
      const prior = claimed.get(m.candidate.brazeCampaignId);
      if (!prior || m.score > prior.score) claimed.set(m.candidate.brazeCampaignId, { emailId: email.id, score: m.score });
    }
  }

  for (const email of emails) {
    const target = email;
    const matches = matchEmail(target, candidates).filter(
      (m) => claimed.get(m.candidate.brazeCampaignId)?.emailId === email.id,
    );
    if (!matches.length) continue;

    const perAudience: AudienceResult[] = [];
    for (const m of matches) {
      const r = byId.get(m.candidate.brazeCampaignId);
      if (!r) continue;
      const sent = n(r.sent);
      const delivered = n(r.delivered);
      const opens = n(r.unique_opens);
      const clicks = n(r.unique_clicks);
      const unsubs = n(r.unsubscribes);
      const denominator = delivered ?? sent;
      perAudience.push({
        audience: r.audience,
        campaignName: r.campaign_name,
        brazeCampaignId: r.braze_campaign_id,
        sent,
        delivered,
        uniqueOpens: opens,
        machineOpens: n(r.machine_opens),
        uniqueClicks: clicks,
        unsubscribes: unsubs,
        revenue: n(r.revenue),
        openRate: rate(opens, denominator),
        ctr: rate(clicks, denominator),
        // CTOR is clicks over OPENS — the one rate whose denominator is not the send.
        ctor: rate(clicks, opens),
        unsubRate: rate(unsubs, denominator),
        matchScore: m.score,
        confident: m.score >= MATCH_CONFIDENT,
        firstSentAt: r.first_sent_at?.toISOString() ?? null,
        capturedAt: r.captured_at.toISOString(),
        maturing: !!r.first_sent_at && now - r.first_sent_at.getTime() < MATURITY_HOURS * 3600_000,
      });
    }
    if (!perAudience.length) continue;

    const sum = (pick: (a: AudienceResult) => number | null): number | null => {
      const vals = perAudience.map(pick).filter((v): v is number => typeof v === 'number');
      return vals.length ? vals.reduce((x, y) => x + y, 0) : null;
    };
    const sent = sum((a) => a.sent) ?? 0;
    const delivered = sum((a) => a.delivered);
    const opens = sum((a) => a.uniqueOpens);
    const clicks = sum((a) => a.uniqueClicks);
    const matchedAudiences = new Set(perAudience.map((a) => a.audience).filter((a): a is string => !!a));

    out.set(email.id, {
      emailId: email.id,
      perAudience,
      total: {
        sent,
        delivered,
        uniqueOpens: opens,
        uniqueClicks: clicks,
        unsubscribes: sum((a) => a.unsubscribes),
        revenue: sum((a) => a.revenue),
        // Rates from the SUMMED counts, never an average of rates — the lists differ in size by
        // an order of magnitude and a mean of their rates would be dominated by the smallest.
        openRate: rate(opens, delivered ?? sent),
        ctor: rate(clicks, opens),
      },
      maturing: perAudience.some((a) => a.maturing),
      unmatchedAudiences: email.audiences.filter((a) => !matchedAudiences.has(a)),
    });
  }
  return out;
}
