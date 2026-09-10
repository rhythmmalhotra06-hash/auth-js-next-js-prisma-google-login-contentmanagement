// Week arithmetic for the MOW pack.
//
// A MOW week is Monday→Sunday (brief §2). All dates are handled as UTC calendar days because
// `CommsDay.date` and `MowWeek.weekStart` are `@db.Date` columns — no timezone component, so a
// local-time Date would shift the day across the KL/UTC boundary and silently move a slot onto
// the wrong card. Glen's own handoff records exactly that bug: an earlier UTC+8 assumption
// "moved 3 posts to different days" before it was corrected to UTC calendar day.
//
// Anything user-facing that needs KL time (the Monday 08:00 MYT fire, the Sunday-night
// generation) belongs in the job schedule, not here.

/** Midnight-UTC Date for a "YYYY-MM-DD" string. */
export function utcDay(ymd: string): Date {
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Not a date: ${ymd}`);
  return d;
}

export const toYmd = (d: Date): string => d.toISOString().slice(0, 10);

/** The Monday of the week containing `d`. Sunday belongs to the week that started 6 days ago. */
export function weekStartOf(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  const back = day === 0 ? 6 : day - 1;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back));
}

export const addDays = (d: Date, n: number): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));

/** Monday…Sunday for the week containing `d`. */
export function weekDays(d: Date): Date[] {
  const start = weekStartOf(d);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Inclusive [Monday, Sunday] bounds for a Prisma date range query. */
export function weekBounds(d: Date): { start: Date; end: Date } {
  const start = weekStartOf(d);
  return { start, end: addDays(start, 6) };
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const weekdayName = (d: Date): string => WEEKDAY[d.getUTCDay()];
