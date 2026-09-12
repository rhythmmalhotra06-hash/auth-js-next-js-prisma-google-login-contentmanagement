// The Email row in the pack's day table — what went out by email each day, beside what went out
// on each social platform.
//
// ── IT SITS BESIDE THE PLATFORMS AND IS NEVER ADDED TO THEM ───────────────────────────────────
//
// `week-pack.ts` already refuses to total reach across Instagram, Facebook and TikTok, because
// they do not report the same things. Email is the strongest case of that rule, not an exception
// to it: an email has no reach at all, its "engagement" is an open, and an open is a far cheaper
// act than an Instagram engagement. Adding 300,000 email opens to 90,000 Instagram engagements
// would produce a number that describes nothing.
//
// So Email is one more row in `PlatformRead`, with `reach: null` — the same null the platforms
// use for a metric they do not report — and the coverage line names what it does report.

import { prisma } from '@/lib/prisma';
import type { PlatformRead } from './week-pack';

interface DailyEmailRow {
  pub_date: Date;
  campaigns: bigint;
  sent: bigint | null;
  opens: bigint | null;
  clicks: bigint | null;
}

const num = (v: bigint | number | null): number | null =>
  v === null || v === undefined ? null : Number(v);

/**
 * Email sends per day, from the latest capture of each campaign.
 *
 * `distinct on (braze_campaign_id)` for the same reason every other reader here does it: the
 * nightly pull writes one row per campaign per day, and summing across captures would multiply
 * every figure by the number of nights since the send.
 *
 * Only the to-date rows (`window_days is null`) — the day table is a volume read, and the
 * 2-day window exists for the per-email view where "how did it open" is the question.
 */
export async function dailyEmailReads(fromYmd: string, toYmd: string): Promise<Map<string, PlatformRead>> {
  let rows: DailyEmailRow[] = [];
  try {
    rows = await prisma.$queryRaw<DailyEmailRow[]>`
      with latest as (
        select distinct on (braze_campaign_id)
          braze_campaign_id,
          first_sent_at::date as pub_date,
          sent, unique_opens, unique_clicks
        from email_metrics
        where window_days is null
          and first_sent_at is not null
          and first_sent_at::date between ${fromYmd}::date and ${toYmd}::date
        order by braze_campaign_id, captured_at desc
      )
      select pub_date,
             count(*)::bigint            as campaigns,
             sum(sent)::bigint           as sent,
             sum(unique_opens)::bigint   as opens,
             sum(unique_clicks)::bigint  as clicks
      from latest
      group by 1
      order by 1
    `;
  } catch {
    // No table yet, or no database — the pack degrades to its social half, which is what it
    // showed before this existed.
    return new Map();
  }

  const out = new Map<string, PlatformRead>();
  for (const r of rows) {
    const ymd = (r.pub_date instanceof Date ? r.pub_date : new Date(r.pub_date)).toISOString().slice(0, 10);
    out.set(ymd, {
      platform: 'Email',
      // The count the meeting reads as "how much went out" is CAMPAIGNS — one per list — which
      // over-counts a single email sent to eight lists as eight. That is the same population
      // question the day table already carries for social, and the pack's own note about
      // planned-vs-delivered covers it: these are facts side by side, not a completion rate.
      posts: Number(r.campaigns),
      reach: null, // an email has no reach; null is "not reported", never zero
      engagements: num(r.opens),
      clicks: num(r.clicks),
      sent: num(r.sent),
    });
  }
  return out;
}
