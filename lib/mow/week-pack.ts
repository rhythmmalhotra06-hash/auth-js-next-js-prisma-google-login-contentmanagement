// The Monday pack's data — artboard `2a`, `/performance/week`.
//
// Vishen's complaint about the existing reporting is "too many numbers, I'm not clear what this
// means": Glen's report puts ~60 on one screen and the design's answer is ELEVEN. So this module
// is as much about what it refuses to compute as what it returns.
//
// It is assembled from three places, deliberately:
//   • the message, goal and day-by-day plan  → the comms calendar reader (Airtable). Same
//     resolver, so the pack and the calendar can never disagree about whose week it is.
//   • delivered social numbers               → `social_metrics` (Postgres), nightly from Perch
//   • staged→committed prose                 → Postgres. Not built here yet; see the note below.
//
// TWO TRAPS THIS CODE EXISTS TO AVOID, both found by querying production rather than reasoning:
//
// 1. **Five capture rows per post.** 1,642 rows cover 329 posts — the nightly cron re-captures
//    each one. `sum(reach)` over them inflates by ~5×. Every figure here comes from the LATEST
//    capture per post via `distinct on`. This is the same class of error as Glen's rule about
//    `SELECT DISTINCT order_id`, which has inflated a revenue figure twice, once by $6,261.
//
// 2. **The platforms report different metrics.** Verified on live rows for w/c 7 Sep:
//    Instagram returns reach + engagements and NO clicks; Facebook returns clicks and NO reach or
//    engagements; TikTok returns reach alone. So a cross-platform "week reach" would silently be
//    an Instagram number wearing a total's clothes. `PlatformRead` keeps them separate and
//    `crossPlatformTotals` is deliberately absent. Do not add one.

import { prisma } from '@/lib/prisma';
// Reads the Airtable path directly, the same way app/studio/comms-calendar does — there is no
// backend dispatcher yet and COMMS_CALENDAR_BACKEND still defaults to `airtable`. When the
// Postgres reader lands, both call sites change together.
import { getCalendarWeekFromAirtable } from '@/lib/comms-calendar/data.airtable';
import { weekBounds, weekStartOf, toYmd } from './week';
import type { CalendarAsset, CalendarWeek } from '@/lib/comms-calendar/types';

/** One platform's read for one day. Nulls are "this platform does not report it", never zero. */
export interface PlatformRead {
  platform: string;
  posts: number;
  reach: number | null;
  engagements: number | null;
  clicks: number | null;
}

/** The five states, and `blocked` is NOT `missed` — two conditions, two colours. */
export type SlotState = 'planned' | 'shipped' | 'offPlan' | 'missed' | 'blocked' | null;

export interface PackDay {
  date: string;
  weekday: string;
  dayOfMonth: number;
  isToday: boolean;
  isFuture: boolean;
  /**
   * Slots the comms calendar planned for this day: VL assets + MV email/social links.
   *
   * NOT comparable to `delivered` as a ratio — see the note on that field.
   */
  planned: number;
  /**
   * What went live: VL assets at a published status, plus every post Perch saw published that day.
   *
   * **This is a WIDER population than `planned`, deliberately.** Perch watches 10+ connected
   * accounts including the regional ones (`mindvalley.de`, `mindvalleyenespanol`,
   * `mindvalleybookclub`), while the comms calendar links a much smaller planned set. So on a
   * normal day `delivered` EXCEEDS `planned` — Mon 7 Sep is 7 planned against 19 delivered — and
   * treating the pair as planned-vs-actual would read as a 271% completion rate.
   *
   * They are two separate facts, and the UI labels them as such. The one comparison that IS sound
   * is the weak one `slotState` makes: a planned day where nothing at all went out.
   */
  delivered: number;
  state: SlotState;
  /** Per platform, never summed across them. Empty when Perch saw nothing that day. */
  platforms: PlatformRead[];
  /** The titles the day is carrying, for the expansion row. */
  vlTitles: { id: string; title: string; live: boolean; channel: string | null }[];
  mvSlots: number;
}

export interface WeekPack {
  /** The calendar's own answer — message, goal, related beats, warnings. Reused, not recomputed. */
  week: CalendarWeek;
  days: PackDay[];
  /** Posts Perch saw published in this week, deduped to one row per post. */
  postsThisWeek: number;
  /**
   * Which metrics are actually available, so the page can say so once at screen level rather
   * than hedging next to every figure (the design collapsed five hedges into one statement).
   */
  coverage: { platform: string; posts: number; has: string[]; missing: string[] }[];
  asOf: string;
}

interface DailyRow {
  pub_date: Date;
  platform: string;
  posts: bigint;
  reach: bigint | null;
  eng: bigint | null;
  clicks: bigint | null;
}

const num = (v: bigint | number | null): number | null =>
  v === null || v === undefined ? null : Number(v);

/**
 * Delivered social numbers for a date range, one row per platform per publish-day.
 *
 * `raw.details.created_at` is the post's own publish time as epoch SECONDS — the only publish
 * date we hold, since `captured_at` is when the cron ran. Present on all 1,642 rows.
 *
 * The platform comes from which `*_metadata` block Perch attached; the `channel` column reads
 * `socialprofile` on every row and is useless for this.
 */
async function dailyPlatformReads(fromYmd: string, toYmd_: string): Promise<DailyRow[]> {
  return prisma.$queryRaw<DailyRow[]>`
    with latest as (
      select distinct on (platform_post_id)
        platform_post_id,
        to_timestamp((raw->'details'->>'created_at')::bigint)::date as pub_date,
        case
          when raw->'details' ? 'instagram_metadata'       then 'Instagram'
          when raw->'details' ? 'facebook_metadata'        then 'Facebook'
          when raw->'details' ? 'tiktokbusiness_metadata'  then 'TikTok'
          else 'Other'
        end as platform,
        reach, engagements, clicks
      from social_metrics
      where platform_post_id is not null
        and raw->'details' ? 'created_at'
      order by platform_post_id, captured_at desc
    )
    select pub_date, platform,
           count(*)::bigint          as posts,
           sum(reach)::bigint        as reach,
           sum(engagements)::bigint  as eng,
           sum(clicks)::bigint       as clicks
    from latest
    where pub_date between ${fromYmd}::date and ${toYmd_}::date
    group by 1, 2
    order by 1, 2
  `;
}

export async function getWeekPack(anchor: Date): Promise<WeekPack> {
  const weekStart = weekStartOf(anchor);
  const { start, end } = weekBounds(weekStart);
  const startYmd = toYmd(start);
  const endYmd = toYmd(end);

  const [week, rows] = await Promise.all([
    getCalendarWeekFromAirtable(anchor),
    dailyPlatformReads(startYmd, endYmd).catch(() => [] as DailyRow[]),
  ]);

  const byDay = new Map<string, PlatformRead[]>();
  for (const r of rows) {
    const ymd = toYmd(r.pub_date instanceof Date ? r.pub_date : new Date(r.pub_date));
    byDay.set(ymd, [
      ...(byDay.get(ymd) ?? []),
      {
        platform: r.platform,
        posts: Number(r.posts),
        reach: num(r.reach),
        engagements: num(r.eng),
        clicks: num(r.clicks),
      },
    ]);
  }

  const today = toYmd(new Date());

  const days: PackDay[] = week.days.map((d): PackDay => {
    const platforms = byDay.get(d.date) ?? [];
    const vlPlanned = d.vl.length;
    const mvSlots = d.mv.length + d.mvOverflow;
    const planned = vlPlanned + mvSlots;
    const vlLive = d.vl.filter((a: CalendarAsset) => a.live).length;
    const delivered = vlLive + platforms.reduce((n, p) => n + p.posts, 0);
    const isFuture = d.date > today;

    return {
      date: d.date,
      weekday: d.weekday,
      dayOfMonth: d.dayOfMonth,
      isToday: d.isToday,
      isFuture,
      planned,
      delivered,
      state: slotState({ isFuture, planned, delivered }),
      platforms,
      vlTitles: d.vl.map((a: CalendarAsset) => ({ id: a.id, title: a.title, live: a.live, channel: a.channel })),
      mvSlots,
    };
  });

  return {
    week,
    days,
    postsThisWeek: rows.reduce((n: number, r: DailyRow) => n + Number(r.posts), 0),
    coverage: coverageOf(rows),
    asOf: new Date().toISOString(),
  };
}

/**
 * A day's status. The important line is the last one.
 *
 * A day with nothing planned and nothing shipped is NOT a miss — it is a quiet day, and painting
 * it red is how a calendar earns the reputation of crying wolf. `missed` is reserved for the real
 * case Glen described: a day that was planned and where nothing went out, "not even a substitute".
 */
function slotState({ isFuture, planned, delivered }: { isFuture: boolean; planned: number; delivered: number }): SlotState {
  if (isFuture) return planned > 0 ? 'planned' : null;
  if (planned > 0 && delivered > 0) return 'shipped';
  if (planned > 0) return 'missed';
  if (delivered > 0) return 'offPlan';
  return null;
}

/**
 * What each platform actually reports, computed from the rows in hand rather than asserted.
 *
 * This is what lets the page make ONE screen-level statement about provenance instead of a hedge
 * beside every number — and it stays true if Perch starts returning a field it currently doesn't.
 */
function coverageOf(rows: DailyRow[]): WeekPack['coverage'] {
  const acc = new Map<string, { posts: number; reach: boolean; eng: boolean; clicks: boolean }>();
  for (const r of rows) {
    const cur = acc.get(r.platform) ?? { posts: 0, reach: false, eng: false, clicks: false };
    acc.set(r.platform, {
      posts: cur.posts + Number(r.posts),
      reach: cur.reach || r.reach !== null,
      eng: cur.eng || r.eng !== null,
      clicks: cur.clicks || r.clicks !== null,
    });
  }
  return [...acc.entries()]
    .map(([platform, v]) => {
      const has: string[] = [];
      const missing: string[] = [];
      (v.reach ? has : missing).push('reach');
      (v.eng ? has : missing).push('engagements');
      (v.clicks ? has : missing).push('clicks');
      return { platform, posts: v.posts, has, missing };
    })
    .sort((a, b) => b.posts - a.posts);
}
