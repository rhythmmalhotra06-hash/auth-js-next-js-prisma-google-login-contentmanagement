// One message's week — the answer to "click Expert to Authority and see everything that
// happened for it, with results".
//
// Pure over the assembled `CalendarWeek` and the pack's `PackDay[]`, so it costs nothing beyond
// the pack itself (memoised per week) and can be exercised against the calendar's own fixtures.
//
// ── WHERE THE PIECES LIVE, AND WHY THIS IS NOT A FILTER ON `allPosts` ─────────────────────────
//
// `week.allPosts` holds every Mindvalley POST, uncapped — but nothing else. The synthetic email
// rows never reach it (the lane builder filters `recXXX:email` ids out), and no Vishen asset does
// either: `allPosts` is built inside the Mindvalley loop. So a message's week is three reads:
//   • MV posts   → `week.allPosts`
//   • MV emails  → `week.days[].mv`, the `:email` rows (capped lanes, but the email row is
//                  always first, so the cap never drops it)
//   • VL assets  → `week.days[].vl`
//
// ── NAME MATCHING ────────────────────────────────────────────────────────────────────────────
//
// The header's `message` has been through `splitJammedName(raw, 'MV')`; each MV asset's
// `messageName` is the RAW day text. For the live record `MV: Be Extraordinary VL: Podcast -
// Naveen Jain` they differ, so both sides are normalised the same way before comparing.

import { splitJammedName } from './derive-week';
import type { CalendarAsset, CalendarWeek } from '@/lib/comms-calendar/types';
import type { EmailResults } from '@/lib/braze/results';
import type { PackDay } from './week-pack';

export interface MessageWeekItem extends CalendarAsset {
  date: string;
  kind: 'post' | 'email' | 'vl';
  /** Braze numbers for an email row, when a campaign matched. Attached by the page, not here. */
  emailResults?: EmailResults | null;
}

export interface MessageWeekDay {
  date: string;
  weekday: string;
  dayOfMonth: number;
  isToday: boolean;
  isFuture: boolean;
  /** From the pack — the day's two facts, never a ratio. Null when the pack has no such day. */
  planned: number | null;
  delivered: number | null;
  items: MessageWeekItem[];
}

export interface MessageWeek {
  name: string;
  /** Which brands' assets carry this message this week. */
  brands: ('MV' | 'VL')[];
  days: MessageWeekDay[];
  counts: { posts: number; emails: number; vl: number; matched: number };
}

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** True when two message names refer to the same message, allowing for the jammed `MV: … VL: …` form. */
export function sameMessage(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const candidates = (s: string) => new Set([norm(s), norm(splitJammedName(s, 'MV') || s), norm(splitJammedName(s, 'VL') || s)]);
  const ca = candidates(a);
  for (const x of candidates(b)) if (ca.has(x)) return true;
  return false;
}

/** Every email row in a built week, as match targets for the Braze reader. */
export function emailTargets(mw: MessageWeek): { id: string; title: string; subject: string | null; liveDate: string | null; audiences: string[] }[] {
  return mw.days
    .flatMap((d) => d.items.filter((i) => i.kind === 'email' && i.emailId))
    .map((i) => ({ id: i.emailId!, title: i.title, subject: i.subject ?? null, liveDate: i.date, audiences: i.audiences ?? [] }));
}

/** Attach Braze results to the email rows, in place of a second pass through the tree. */
export function withEmailResults(mw: MessageWeek, results: Map<string, EmailResults>): MessageWeek {
  if (!results.size) return mw;
  return {
    ...mw,
    days: mw.days.map((d) => ({
      ...d,
      items: d.items.map((i) => (i.kind === 'email' && i.emailId ? { ...i, emailResults: results.get(i.emailId) ?? null } : i)),
    })),
  };
}

export function messageWeek(week: CalendarWeek, name: string, packDays: PackDay[] = []): MessageWeek {
  const byDay = new Map<string, MessageWeekItem[]>();
  const push = (item: MessageWeekItem) => byDay.set(item.date, [...(byDay.get(item.date) ?? []), item]);

  for (const p of week.allPosts) {
    if (sameMessage(p.messageName, name)) push({ ...p, kind: 'post' });
  }
  for (const d of week.days) {
    for (const a of d.mv) {
      if (a.id.endsWith(':email') && sameMessage(a.messageName, name)) push({ ...a, date: d.date, kind: 'email' });
    }
    for (const a of d.vl) {
      if (sameMessage(a.messageName, name)) push({ ...a, date: d.date, kind: 'vl' });
    }
  }

  const packByDate = new Map(packDays.map((d) => [d.date, d]));
  const today = new Date().toISOString().slice(0, 10);
  const days: MessageWeekDay[] = week.days.map((d) => {
    const pd = packByDate.get(d.date);
    // Emails first, then posts, then VL — the order the meeting reads a day in.
    const order: Record<MessageWeekItem['kind'], number> = { email: 0, post: 1, vl: 2 };
    const items = (byDay.get(d.date) ?? []).sort((a, b) => order[a.kind] - order[b.kind]);
    return {
      date: d.date,
      weekday: d.weekday,
      dayOfMonth: d.dayOfMonth,
      isToday: d.isToday,
      isFuture: d.date > today,
      planned: pd?.planned ?? null,
      delivered: pd?.delivered ?? null,
      items,
    };
  });

  const all = days.flatMap((d) => d.items);
  return {
    name,
    brands: [...new Set(all.map((i) => i.brand))],
    days,
    counts: {
      posts: all.filter((i) => i.kind === 'post').length,
      emails: all.filter((i) => i.kind === 'email').length,
      vl: all.filter((i) => i.kind === 'vl').length,
      matched: all.filter((i) => i.results?.reach).length,
    },
  };
}
