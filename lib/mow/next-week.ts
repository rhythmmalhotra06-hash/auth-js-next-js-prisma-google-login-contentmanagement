// What is planned for next week — the section Vishen asked for by name.
//
// His brief is "day by day cadence with named owners… and what's planned next week". The pack
// answered the first half and stopped at Sunday, which makes it a post-mortem. A Monday meeting
// that only looks backwards cannot change anything; the forward half is where a thin day is still
// fixable.
//
// Read-only and deliberately thin on interpretation: this is the PLAN, not a forecast. It says
// what the comms calendar holds and where it holds nothing, and it never guesses at what a blank
// day will become.

import { getCalendarWeekFromAirtable } from '@/lib/comms-calendar/data.airtable';
import { weekStartOf, addDays, toYmd } from './week';

export interface NextWeekDay {
  date: string;
  weekday: string;
  dayOfMonth: number;
  isWeekend: boolean;
  emails: number;
  posts: number;
  /** Titles of what is already drafted, capped — evidence that the slot is real. */
  titles: string[];
}

export interface NextWeek {
  weekStart: string;
  weekEnd: string;
  /** The message next week runs under, when one is committed. */
  message: string | null;
  goal: string | null;
  days: NextWeekDay[];
  totals: { emails: number; posts: number };
  /**
   * Weekday slots with nothing planned at all.
   *
   * Weekends are excluded: Mindvalley does not email at the weekend and a quiet Saturday is not a
   * gap. Flagging one would train the room to ignore this list, which is the only way it stops
   * working.
   */
  emptyWeekdays: { date: string; weekday: string }[];
}

export async function getNextWeek(anchor: Date): Promise<NextWeek> {
  // Next week is the Monday AFTER the week being reviewed.
  const week = await getCalendarWeekFromAirtable(addDays(weekStartOf(anchor), 7));

  const days: NextWeekDay[] = week.days.map((d) => {
    const posts = d.mv.filter((a) => !a.id.includes(':')).length + d.mvOverflow;
    const emails = d.mv.filter((a) => a.channel === 'Email').length;
    return {
      date: d.date,
      weekday: d.weekday,
      dayOfMonth: d.dayOfMonth,
      isWeekend: d.isWeekend,
      emails,
      posts,
      titles: week.allPosts.filter((p) => p.date === d.date).map((p) => p.title).slice(0, 3),
    };
  });

  const mv = week.headers.find((h) => h.brand === 'MV');

  return {
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
    message: mv?.message ?? null,
    goal: mv?.goal ?? null,
    days,
    totals: {
      emails: days.reduce((n, d) => n + d.emails, 0),
      posts: days.reduce((n, d) => n + d.posts, 0),
    },
    emptyWeekdays: days
      .filter((d) => !d.isWeekend && d.emails === 0 && d.posts === 0)
      .map((d) => ({ date: d.date, weekday: d.weekday })),
  };
}

export { toYmd };
