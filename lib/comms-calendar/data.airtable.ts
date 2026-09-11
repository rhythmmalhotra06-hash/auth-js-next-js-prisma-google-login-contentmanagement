// The comms calendar, read straight from Airtable.
//
// Handoff sequencing (§10.2): build against Airtable directly behind COMMS_CALENDAR_BACKEND,
// so the surface ships before the reference reconcile. Field ids are hard-coded via
// lib/airtable/field-map.ts and NEVER resolved by name — the table names are emoji-prefixed and
// name-based lookup has already caused silent data loss once on this project.
//
// GRAIN IS THE ASSET, grouped by date in the front end. There is no day record in either base and
// none should be created (10 Sep handoff §7 "do not build": a day-grain table).
//
// The two lanes come from different places, which is the whole reason this reader exists:
//   Vishen     → VL_VIDEOS, grouped by `Live Date`
//   Mindvalley → COMMS_DAY (the day-level comms calendar), whose rows already carry a date
//
// Everything here tolerates absence. On the live base 221 of 440 VL assets have no Live Date,
// `Goal` is empty on all six real messages, and the only VL message is named `test`.

import { listAll, type AirtableRecord } from '@/lib/airtable/rest';
import { swr, invalidate } from '@/lib/cache/swr';
import { timed } from '@/lib/perf/timed';
import { COMMS_DAY, VL_VIDEOS, VL_MESSAGE_OF_WEEK } from '@/lib/airtable/field-map';
import { weekBounds, weekStartOf, toYmd, weekdayName, addDays } from '@/lib/mow/week';
import { pickByCoverage, pickGoal, isPlaceholder, meaningful, type CoverageEntry } from '@/lib/mow/coverage';
import { splitJammedName } from '@/lib/mow/derive-week';
import { getSocialPosts, type SocialPost } from './social-posts';
import type { BrandWeekHeader, CalendarAsset, CalendarDay, CalendarWeek } from './types';

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
function selectName(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (Array.isArray(v)) return selectName(v[0]);
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return null;
}
const firstLookup = (v: unknown): string | null => (Array.isArray(v) ? str(v[0]) : str(v));

/** How many individual assets a lane renders before collapsing the rest. */
const MV_INLINE = 2;

/**
 * How far either side of the target week the comms-day fetch reaches.
 *
 * Two weeks each way, for one reason: a message's TRUE span is only knowable from days outside the
 * week. `Expert to Authority` runs 7–21 Sep, so a one-week fetch can only report "this week" and
 * `spanNote` was stuck at null. Same `filterByFormula`, same single request — and it is exactly the
 * window the month view needs, so Month inherits this fetch rather than adding its own.
 */
const WINDOW_WEEKS = 2;

// ── The reads, each memoised with stale-while-revalidate ──────────────────────────────────────
//
// Every load used to re-read all ~442 Vishen-lane rows (five sequential pages), because the
// not-dated counts and the `datedThrough` boundary are base-wide facts. That dominated the page
// cost and was invisible until measured — and three sibling readers (month, not-dated, asset
// detail) each repeated the same scan with every column and no cache at all. They now all share
// `vlRows()`. The field projection matters as much as the memo: asking for the whole wide table
// took 4.4s of a 5.5s page.
//
// Staleness: `swr` returns a value up to five minutes old and refreshes it behind the reader.
// The one writer, the not-dated tray's Live Date action, calls `invalidateCalendarCaches()`.
// See lib/cache/swr.ts for the trade.

const VL_FIELDS = [
  VL_VIDEOS.fields.name, VL_VIDEOS.fields.liveDate, VL_VIDEOS.fields.status,
  VL_VIDEOS.fields.medium, VL_VIDEOS.fields.source, VL_VIDEOS.fields.publishedLink,
  VL_VIDEOS.links.messageOfWeek, VL_VIDEOS.readOnlyFields.goalFromMessage,
];

/** Every VL Videos row, projected to the calendar's fields. Shared by all four calendar readers. */
export function vlRows(): Promise<AirtableRecord[]> {
  return swr('vl:rows', async () => {
    const res = await listAll(VL_VIDEOS.baseId, VL_VIDEOS.tableId, { fields: VL_FIELDS });
    if (!res.ok) throw new Error(`Vishen lane: ${res.error.message}`);
    return res.data;
  });
}

/** The VL Message of the Week table — a handful of rows, edited rarely. */
export function mowRows(): Promise<AirtableRecord[]> {
  return swr('vl:mow', async () => {
    const res = await listAll(VL_MESSAGE_OF_WEEK.baseId, VL_MESSAGE_OF_WEEK.tableId);
    if (!res.ok) throw new Error(`Message of the Week: ${res.error.message}`);
    return res.data;
  });
}

/** Comms-day rows with `Date` strictly between `afterYmd` and `beforeYmd` (Airtable's IS_AFTER/IS_BEFORE). */
export function commsDaysBetween(afterYmd: string, beforeYmd: string): Promise<AirtableRecord[]> {
  return swr(`calendar:days:${afterYmd}:${beforeYmd}`, async () => {
    const res = await listAll(COMMS_DAY.baseId, COMMS_DAY.tableId, {
      filterByFormula: `AND(IS_AFTER({Date}, "${afterYmd}"), IS_BEFORE({Date}, "${beforeYmd}"))`,
    });
    if (!res.ok) throw new Error(`Mindvalley lane: ${res.error.message}`);
    return res.data;
  });
}

/** Call after any write to VL Videos, the comms days, or 📣 Social — from the server action, before `revalidatePath`. */
export function invalidateCalendarCaches(): void {
  invalidate('vl:');
  invalidate('calendar:');
  invalidate('social:');
}

/**
 * The week, assembled. Memoised per week start so the pack, the calendar, `/studio` and the
 * ingest route — which all ask for the same week within the same minutes — assemble it once.
 */
export function getCalendarWeekFromAirtable(anchor: Date): Promise<CalendarWeek> {
  const weekStart = weekStartOf(anchor);
  return swr(`calendar:week:${toYmd(weekStart)}`, () => timed('calendar.week', () => buildWeek(weekStart)));
}

async function buildWeek(weekStart: Date): Promise<CalendarWeek> {
  const { start, end } = weekBounds(weekStart);
  const from = addDays(start, -7 * WINDOW_WEEKS - 1);
  const to = addDays(end, 7 * WINDOW_WEEKS + 1);

  // Three independent reads, genuinely concurrent now that the Airtable client has a per-base
  // limiter rather than a serial queue. Two hit the VL base and one the comms base, so they do
  // not even share a budget.
  //
  // The 📣 Social resolution depends only on the comms-day rows, so it starts the moment those
  // land rather than after the slowest of the three — that alone was a full round trip of
  // avoidable waiting. Only the target week's ids are resolved: the ±2-week window exists for
  // span detection, and resolving all of it would be a lot of records for rows nothing renders.
  const inWeek = (v: unknown): boolean => {
    const d = (str(v) ?? '').slice(0, 10);
    return !!d && d >= toYmd(start) && d <= toYmd(end);
  };
  const mvPromise = commsDaysBetween(toYmd(from), toYmd(to));
  const postsPromise = mvPromise.then((mvRows) => {
    const socialIds = mvRows
      .filter((r) => inWeek(r.fields[COMMS_DAY.fields.date]))
      .flatMap((r) => ids(r.fields[COMMS_DAY.links.socialAllAssets]));
    return getSocialPosts(socialIds).catch(() => new Map<string, SocialPost>());
  });

  const [vl, msg, mvRows, posts] = await Promise.all([
    vlRows(),
    mowRows().then((rows) => ({ rows, error: null as string | null }), (err: unknown) => ({ rows: [] as AirtableRecord[], error: err instanceof Error ? err.message : String(err) })),
    mvPromise,
    postsPromise,
  ]);

  return assembleWeek({
    anchor: weekStart,
    vlRows: vl,
    msgRows: msg.rows,
    mvRows,
    msgError: msg.error,
    posts,
  });
}

/** A comms-day row reduced to what both the message resolver and the lane builder need. */
interface MvDay {
  date: string;
  message: string | null;
  goal: string | null;
  emails: number;
  socials: number;
  recId: string;
  /**
   * Links out to 📅 Official Cal. This is the live-campaign signal (S2) — a week with any of
   * these is a campaign week, which defaults the headline metric to leads.
   */
  officialCalIds: string[];
}

/**
 * Which message leads the Mindvalley week, and with which goal.
 *
 * The MV message is NOT on the MOW master — it is plain text repeated on every comms-day row, so
 * coverage is simply how many of the week's days carry each string. Live w/c 7 Sep:
 * `Expert to Authority` on 6 days, `Jim Kwik (Mention Expert to Authority)` on Tuesday alone.
 */
function resolveMvMessage(
  window: MvDay[],
  startYmd: string,
  endYmd: string,
  weekLabel: string,
): { header: Pick<BrandWeekHeader, 'message' | 'goal' | 'related' | 'messageIsPlaceholder' | 'goalIsPlaceholder' | 'spanNote'>; warnings: string[] } {
  const warnings: string[] = [];
  const inWeek = window.filter((d) => d.date >= startYmd && d.date <= endYmd);

  // Group the week's days by message text. `splitJammedName` handles the live record
  // `MV: Be Extraordinary VL: Podcast - Naveen Jain` (22 Sep) without breaking brand grouping.
  const byMessage = new Map<string, { days: string[]; goals: Map<string, string[]> }>();
  for (const d of inWeek) {
    const raw = d.message?.trim();
    if (!raw) continue;
    const name = splitJammedName(raw, 'MV') || raw;
    const bucket = byMessage.get(name) ?? { days: [] as string[], goals: new Map<string, string[]>() };
    bucket.days.push(d.date);
    if (d.goal?.trim()) {
      bucket.goals.set(d.goal, [...(bucket.goals.get(d.goal) ?? []), d.date]);
    }
    byMessage.set(name, bucket);
  }

  const entries: (CoverageEntry & { goals: Map<string, string[]> })[] = [...byMessage.entries()].map(
    ([name, b]) => ({
      name,
      goal: null,
      goals: b.goals,
      daysInWeek: b.days.length,
      // The span is only visible because the fetch reaches outside the week.
      spansMultiple: window.some(
        (d) => (d.date < startYmd || d.date > endYmd) && splitJammedName(d.message?.trim() ?? '', 'MV') === name,
      ),
    }),
  );

  const picked = pickByCoverage(entries, { label: 'Mindvalley', weekLabel });
  warnings.push(...picked.warnings);
  if (!picked.primary) {
    return {
      header: { message: null, goal: null, related: [], messageIsPlaceholder: false, goalIsPlaceholder: false, spanNote: null },
      warnings,
    };
  }

  const g = pickGoal(picked.primary.goals, { label: 'Mindvalley', messageName: picked.primary.name });
  warnings.push(...g.warnings);

  // Y2: junk suppresses to the ordinary gap, but is named here so it reaches someone who can fix it.
  const rawMessage = picked.primary.name;
  const rawGoal = g.goal;
  if (isPlaceholder(rawMessage)) warnings.push(`Mindvalley's message for ${weekLabel} is the placeholder “${rawMessage}” — shown as no message committed.`);
  if (isPlaceholder(rawGoal)) warnings.push(`Mindvalley's goal for ${weekLabel} is the placeholder “${rawGoal}” — shown as no goal set.`);

  return {
    header: {
      message: meaningful(rawMessage),
      goal: meaningful(rawGoal),
      related: picked.related.map((r) => ({ name: r.name, days: r.daysInWeek })),
      messageIsPlaceholder: isPlaceholder(rawMessage),
      goalIsPlaceholder: isPlaceholder(rawGoal),
      spanNote: picked.primary.spansMultiple ? spanNoteFor(window, rawMessage) : null,
    },
    warnings,
  };
}

/** "spans 7–21 Sep" — the real range, read off the window rather than guessed. */
function spanNoteFor(window: MvDay[], name: string): string | null {
  const dates = window
    .filter((d) => splitJammedName(d.message?.trim() ?? '', 'MV') === name)
    .map((d) => d.date)
    .sort();
  if (dates.length < 2) return null;
  const fmt = (ymd: string, withMonth: boolean) =>
    new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric',
      ...(withMonth ? { month: 'short' as const } : {}),
      timeZone: 'UTC',
    });
  const first = dates[0];
  const last = dates[dates.length - 1];
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  return `spans ${fmt(first, !sameMonth)}–${fmt(last, true)}`;
}

/**
 * Pure assembly — the half worth testing, and the half the Postgres reader will share.
 *
 * Takes raw Airtable records so it can be exercised against real payload shapes without a token.
 */
export function assembleWeek({
  anchor,
  vlRows,
  msgRows,
  mvRows,
  msgError = null,
  posts = new Map(),
}: {
  anchor: Date;
  vlRows: AirtableRecord[];
  msgRows: AirtableRecord[];
  mvRows: AirtableRecord[];
  msgError?: string | null;
  /** Resolved 📣 Social records, keyed by recId. Empty in tests that only exercise shapes. */
  posts?: Map<string, SocialPost>;
}): CalendarWeek {
  const weekStart = weekStartOf(anchor);
  const { start, end } = weekBounds(weekStart);
  const startYmd = toYmd(start);
  const endYmd = toYmd(end);
  const warnings: string[] = [];

  // ── Vishen lane ───────────────────────────────────────────────────────────
  // Message names/goals live on the synced copy in the VL base.
  const msgById = new Map<string, { name: string | null; goal: string | null; brand: string | null }>();
  for (const m of msgRows) {
    msgById.set(m.id, {
      name: str(m.fields[VL_MESSAGE_OF_WEEK.fields.name]),
      goal: str(m.fields[VL_MESSAGE_OF_WEEK.fields.goal]),
      brand: selectName(m.fields[VL_MESSAGE_OF_WEEK.fields.brand]),
    });
  }
  if (msgError) warnings.push(`Could not read the Message of the Week table: ${msgError}`);

  let vlDatedThrough: string | null = null;
  let notDatedTotal = 0;
  let notDatedPublished = 0;
  let vlDatedAfterWeek = 0;
  let vlTotal = 0;
  const vlByDay = new Map<string, CalendarAsset[]>();
  /**
   * Which messages the week's OWN assets link to, and how many of its days each covers.
   *
   * This map is the fix for the worst defect the first live run exposed. The previous version
   * resolved the VL message by scanning the whole MOW table for a VL-branded row — and since
   * exactly one asset in the base carries a link, and it is dated 16 Sep, w/c 7 Sep was rendered
   * with a message nobody had committed for it. Vishen's own lane, on the surface built for him.
   * Only assets dated INTO this week may nominate this week's message.
   */
  const vlMsgDays = new Map<string, Set<string>>();

  for (const r of vlRows) {
    const f = r.fields as Record<string, unknown>;
    const status = selectName(f[VL_VIDEOS.fields.status]);
    const published = !!status && status.startsWith('7');
    const live = str(f[VL_VIDEOS.fields.liveDate]);
    vlTotal++;

    if (!live) {
      // Never dropped. Counted, and reachable from the tray.
      notDatedTotal++;
      if (published) notDatedPublished++;
      continue;
    }
    const day = live.slice(0, 10);
    if (!vlDatedThrough || day > vlDatedThrough) vlDatedThrough = day;
    if (day > endYmd) vlDatedAfterWeek++;
    if (day < startYmd || day > endYmd) continue;

    for (const id of ids(f[VL_VIDEOS.links.messageOfWeek])) {
      vlMsgDays.set(id, new Set([...(vlMsgDays.get(id) ?? []), day]));
    }

    const msg = msgById.get(ids(f[VL_VIDEOS.links.messageOfWeek])[0] ?? '');
    vlByDay.set(day, [
      ...(vlByDay.get(day) ?? []),
      {
        id: r.id,
        title: str(f[VL_VIDEOS.fields.name]) ?? '(untitled)',
        brand: 'VL',
        channel: selectName(f[VL_VIDEOS.fields.medium]),
        status,
        source: selectName(f[VL_VIDEOS.fields.source]),
        publishedUrl: str(f[VL_VIDEOS.fields.publishedLink]),
        live: published,
        // Y2 applies per asset too: an asset inheriting `test` inherits nothing worth showing.
        messageName: meaningful(msg?.name),
        goal: meaningful(msg?.goal ?? firstLookup(f[VL_VIDEOS.readOnlyFields.goalFromMessage])),
      },
    ]);
  }

  // ── Mindvalley lane ───────────────────────────────────────────────────────
  // Linked Emails / Social arrive as recIds; resolving every title would be extra round-trips for
  // rows the meeting reads as volume, so the count shows and the titles stay one click away.
  const mvByDay = new Map<string, { assets: CalendarAsset[]; overflow: number }>();
  const mvWindow: MvDay[] = [];
  // Uncapped, for the post grid. The lanes below cap at MV_INLINE.
  const allPosts: (CalendarAsset & { date: string })[] = [];

  for (const r of mvRows) {
    const f = r.fields as Record<string, unknown>;
    const day = (str(f[COMMS_DAY.fields.date]) ?? '').slice(0, 10);
    if (!day) continue;

    const emails = ids(f[COMMS_DAY.links.emails]);
    const socials = ids(f[COMMS_DAY.links.socialAllAssets]);
    const dayMessage = str(f[COMMS_DAY.fields.messageOfWeek]);
    const dayGoal = str(f[COMMS_DAY.fields.theGoal]);

    // The whole window feeds the message resolver; only the target week builds lanes.
    mvWindow.push({
      date: day, message: dayMessage, goal: dayGoal,
      emails: emails.length, socials: socials.length, recId: r.id,
      officialCalIds: ids(f[COMMS_DAY.links.officialCal]),
    });
    if (day < startYmd || day > endYmd) continue;

    const assets: CalendarAsset[] = [];
    // Each day's own message text, not the week's — a day carrying a different message (Tue 8's
    // Jim Kwik beat) must say so rather than inheriting the week's leader.
    const perAsset = { messageName: meaningful(dayMessage), goal: meaningful(dayGoal) };

    if (emails.length) {
      assets.push({
        id: `${r.id}:email`, title: 'Email', brand: 'MV', channel: 'Email',
        status: null, source: null, publishedUrl: null, live: false, ...perAsset,
      });
    }
    // Real posts, one row each — title, platform, and results where Perch matched.
    for (const id of socials) {
      const p = posts.get(id);
      if (!p) continue;
      assets.push({
        id: p.id,
        title: p.title,
        brand: 'MV',
        channel: p.platforms.join(' · ') || null,
        status: p.status,
        source: null,
        publishedUrl: p.publishedUrl,
        live: !!p.publishedUrl || !!p.results,
        platforms: p.platforms,
        imageUrl: p.imageUrl,
        results: p.results
          ? { reach: p.results.reach, engagements: p.results.engagements, multiAccount: p.results.multiAccount }
          : null,
        ...perAsset,
      });
    }
    for (const a of assets) if (!a.id.includes(':')) allPosts.push({ ...a, date: day });

    // Any social ids that did not resolve still count, so the day's volume stays honest.
    const unresolved = socials.filter((id) => !posts.has(id)).length;
    const total = assets.length + unresolved;
    mvByDay.set(day, {
      assets: assets.slice(0, MV_INLINE),
      overflow: Math.max(0, total - Math.min(assets.length, MV_INLINE)),
    });
  }

  // ── Assemble the seven days ───────────────────────────────────────────────
  const today = toYmd(new Date());
  const days: CalendarDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const ymd = toYmd(d);
    const mv = mvByDay.get(ymd);
    return {
      date: ymd,
      weekday: weekdayName(d),
      dayOfMonth: d.getUTCDate(),
      isToday: ymd === today,
      isWeekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
      vl: vlByDay.get(ymd) ?? [],
      mv: mv?.assets ?? [],
      mvOverflow: mv?.overflow ?? 0,
      // Row layout gives every VL title its own line, so this lane never collapses.
      vlOverflow: 0,
    };
  });

  const vlDated = days.reduce((n, d) => n + d.vl.length, 0);
  const mvDated = days.reduce((n, d) => n + d.mv.length + d.mvOverflow, 0);
  const busiest = Math.max(vlDated, mvDated, 1);

  // ── The two brand headers ─────────────────────────────────────────────────
  // Both lanes now go through the SAME coverage rule (lib/mow/coverage.ts). The two brands reach
  // it from different places — MV from repeated text on the comms days, VL from its assets' links
  // — but the selection itself is one implementation, so the two can no longer disagree.
  const weekLabel = startYmd;

  const vlEntries: CoverageEntry[] = [...vlMsgDays.entries()].flatMap(([id, dayset]) => {
    const m = msgById.get(id);
    if (!m) return [];
    return [{
      name: splitJammedName(m.name, 'VL') || (m.name ?? ''),
      goal: m.goal,
      daysInWeek: dayset.size,
    }];
  });
  const vlPicked = pickByCoverage(vlEntries, { label: 'Vishen Lakhiani Media', weekLabel });
  warnings.push(...vlPicked.warnings);

  const vlRawMessage = vlPicked.primary?.name ?? null;
  const vlRawGoal = vlPicked.primary?.goal ?? null;
  if (isPlaceholder(vlRawMessage)) {
    warnings.push(`Vishen's message for ${weekLabel} is the placeholder “${vlRawMessage}” — shown as no message committed.`);
  }
  if (isPlaceholder(vlRawGoal)) {
    warnings.push(`Vishen's goal for ${weekLabel} is the placeholder “${vlRawGoal}” — shown as no goal set.`);
  }

  const mv = resolveMvMessage(mvWindow, startYmd, endYmd, weekLabel);
  warnings.push(...mv.warnings);

  const headers: BrandWeekHeader[] = [
    {
      brand: 'VL', label: 'Vishen Lakhiani Media',
      message: meaningful(vlRawMessage),
      goal: meaningful(vlRawGoal),
      related: vlPicked.related.map((r) => ({ name: r.name, days: r.daysInWeek })),
      messageIsPlaceholder: isPlaceholder(vlRawMessage),
      goalIsPlaceholder: isPlaceholder(vlRawGoal),
      datedCount: vlDated,
      volumePct: Math.round((vlDated / busiest) * 100),
      spanNote: null,
    },
    {
      brand: 'MV', label: 'Mindvalley',
      ...mv.header,
      datedCount: mvDated,
      volumePct: Math.round((mvDated / busiest) * 100),
    },
  ];

  if (!headers.some((h) => h.message)) {
    warnings.push('Neither brand has a message committed for this week.');
  }

  return {
    weekStart: startYmd,
    weekEnd: endYmd,
    days,
    headers,
    // The gold element. A placeholder goal counts as missing — `vcvdsv` is not a goal.
    allPosts,
    brandsWithoutGoal: headers.filter((h) => !h.goal || h.goalIsPlaceholder).map((h) => h.brand),
    notDated: {
      total: notDatedTotal,
      published: notDatedPublished,
      unpublished: notDatedTotal - notDatedPublished,
      sharePct: vlTotal > 0 ? Math.round((notDatedTotal / vlTotal) * 100) : null,
    },
    // S2's live-campaign signal, computed from the week's own days.
    liveCampaign: mvWindow.some((d) => d.date >= startYmd && d.date <= endYmd && d.officialCalIds.length > 0),
    datedThrough: vlDatedThrough,
    datedAfterWeek: vlDatedAfterWeek,
    asOf: new Date().toISOString(),
    warnings,
  };
}

/** Records helper kept exported for the reader's own tests. */
export type { AirtableRecord };
