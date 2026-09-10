// The month zoom-out — artboard `5a`.
//
// Week is a schedule (day-rows, artboard `1a`); Month keeps the calendar shape. A deliberate
// split, not an inconsistency: the week answers "what goes out Tuesday", the month answers "what
// is this month about, and where are the holes".
//
// THE MESSAGE BANDS ARE THE POINT. The design handoff calls them "the strongest single element in
// the whole export — they answer 'what is this week about' spatially and instantly. Keep them
// exactly." So a band is a contiguous run of days carrying the same message, positioned as a
// percentage of the month, per brand.
//
// Three rules the handoff is emphatic about, all encoded here rather than left to the component:
//
//  1. **No zero-width bars.** A brand with nothing on a day emits NO bar for that day, so a day's
//     bar count is its real lane count. A 0px bar with a blank label was one of the three
//     literal-zero violations found in the previous pass.
//  2. **Absence must not have a band's shape.** A brand with no message for a stretch does not get
//     a grey full-width band — that reads at a glance as a message spanning the month. It gets a
//     marker, a label and a named owner (`gap: true` below), which the component draws as a
//     hairline rule rather than a filled block.
//  3. **Provisional is not missed.** Days beyond the last dated day keep their own cells and a
//     shared tint — never red. Nothing after the boundary was missed; it was never dated. The
//     boundary is COMPUTED (Y3): the handoff was written when the last VL date was 22 Sep, it is
//     now 30 Sep and sparse, so a constant would already be wrong.

import { listAll } from '@/lib/airtable/rest';
import { COMMS_DAY, VL_VIDEOS, VL_MESSAGE_OF_WEEK } from '@/lib/airtable/field-map';
import { toYmd, addDays, weekdayName } from '@/lib/mow/week';
import { meaningful } from '@/lib/mow/coverage';
import { splitJammedName } from '@/lib/mow/derive-week';
import type { Brand } from './types';

export interface MonthBand {
  brand: Brand;
  /** Null when this stretch has no message — see rule 2. Never rendered as a filled band. */
  name: string | null;
  gap: boolean;
  startYmd: string;
  endYmd: string;
  /** Position within the month, 0-100. The band is absolutely placed on a full-width track. */
  leftPct: number;
  widthPct: number;
  days: number;
}

export interface MonthDay {
  date: string;
  dayOfMonth: number;
  weekday: string;
  /** False for the leading/trailing cells that pad the first and last weeks. */
  inMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  /** Asset counts per lane. Zero means NO BAR, not a zero-width one. */
  vl: number;
  mv: number;
  /** Beyond the last dated day anywhere — provisional, tinted, never red. */
  provisional: boolean;
  /** The single marker where the provisional stretch begins. Said once, not per cell. */
  boundaryStart: boolean;
}

export interface CalendarMonth {
  monthStart: string;
  monthEnd: string;
  label: string;
  /** Weeks of seven, Monday first, padded at both ends. */
  weeks: MonthDay[][];
  bands: MonthBand[];
  datedThrough: string | null;
  /** Vishen assets dated after this month ends. */
  datedAfterMonth: number;
  /** Dated Vishen assets inside this month. */
  datedInMonth: number;
  /** How many days of the month carry any Vishen asset at all — the sparseness of the tail. */
  vlDaysCovered: number;
  notDated: { total: number; published: number; unpublished: number; sharePct: number | null };
  asOf: string;
  warnings: string[];
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const ids = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
function selectName(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (Array.isArray(v)) return selectName(v[0]);
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return null;
}

const monthStartOf = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const monthEndOf = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
/** Monday-first weekday index: Mon=0 ... Sun=6. */
const mondayIndex = (d: Date): number => (d.getUTCDay() + 6) % 7;

export async function getCalendarMonthFromAirtable(anchor: Date): Promise<CalendarMonth> {
  const start = monthStartOf(anchor);
  const end = monthEndOf(anchor);
  const startYmd = toYmd(start);
  const endYmd = toYmd(end);

  const [vlRes, msgRes, mvRes] = await Promise.all([
    listAll(VL_VIDEOS.baseId, VL_VIDEOS.tableId),
    listAll(VL_MESSAGE_OF_WEEK.baseId, VL_MESSAGE_OF_WEEK.tableId),
    listAll(COMMS_DAY.baseId, COMMS_DAY.tableId, {
      filterByFormula: `AND(IS_AFTER({Date}, "${toYmd(addDays(start, -1))}"), IS_BEFORE({Date}, "${toYmd(addDays(end, 1))}"))`,
    }),
  ]);
  if (!vlRes.ok) throw new Error(`Vishen lane: ${vlRes.error.message}`);
  if (!mvRes.ok) throw new Error(`Mindvalley lane: ${mvRes.error.message}`);

  const warnings: string[] = [];
  if (!msgRes.ok) warnings.push(`Could not read the Message of the Week table: ${msgRes.error.message}`);

  // Message names, for the Vishen bands.
  const msgName = new Map<string, string | null>();
  if (msgRes.ok) {
    for (const m of msgRes.data) {
      msgName.set(m.id, meaningful(splitJammedName(str(m.fields[VL_MESSAGE_OF_WEEK.fields.name]), 'VL')));
    }
  }

  // Vishen lane: counts per day, message per day, and the base-wide totals.
  const vlPerDay = new Map<string, number>();
  const vlMsgPerDay = new Map<string, string | null>();
  let datedThrough: string | null = null;
  let datedAfterMonth = 0;
  let datedInMonth = 0;
  let notDatedTotal = 0;
  let notDatedPublished = 0;
  let vlTotal = 0;

  for (const r of vlRes.data) {
    const f = r.fields as Record<string, unknown>;
    vlTotal++;
    const live = str(f[VL_VIDEOS.fields.liveDate]);
    const status = selectName(f[VL_VIDEOS.fields.status]);
    const published = !!status && status.startsWith('7');

    if (!live) {
      notDatedTotal++;
      if (published) notDatedPublished++;
      continue;
    }
    const day = live.slice(0, 10);
    if (!datedThrough || day > datedThrough) datedThrough = day;
    if (day > endYmd) datedAfterMonth++;
    if (day < startYmd || day > endYmd) continue;

    datedInMonth++;
    vlPerDay.set(day, (vlPerDay.get(day) ?? 0) + 1);
    for (const id of ids(f[VL_VIDEOS.links.messageOfWeek])) {
      const n = msgName.get(id) ?? null;
      if (n && !vlMsgPerDay.get(day)) vlMsgPerDay.set(day, n);
    }
  }

  // Mindvalley lane: counts and message per day, straight off the comms days.
  const mvPerDay = new Map<string, number>();
  const mvMsgPerDay = new Map<string, string | null>();
  for (const r of mvRes.data) {
    const f = r.fields as Record<string, unknown>;
    const day = (str(f[COMMS_DAY.fields.date]) ?? '').slice(0, 10);
    if (!day || day < startYmd || day > endYmd) continue;
    mvPerDay.set(day, ids(f[COMMS_DAY.links.emails]).length + ids(f[COMMS_DAY.links.socialAllAssets]).length);
    mvMsgPerDay.set(day, meaningful(splitJammedName(str(f[COMMS_DAY.fields.messageOfWeek]), 'MV')));
  }

  // The grid.
  const today = toYmd(new Date());
  const lead = mondayIndex(start);
  const daysInMonth = end.getUTCDate();
  const boundaryFirstDay = datedThrough
    ? toYmd(addDays(new Date(`${datedThrough}T00:00:00Z`), 1))
    : null;
  const cells: MonthDay[] = [];

  for (let i = 0; i < lead; i++) cells.push(blankCell(addDays(start, i - lead)));

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day));
    const ymd = toYmd(d);
    const provisional = !!datedThrough && ymd > datedThrough;
    cells.push({
      date: ymd,
      dayOfMonth: day,
      weekday: weekdayName(d),
      inMonth: true,
      isToday: ymd === today,
      isWeekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
      vl: vlPerDay.get(ymd) ?? 0,
      mv: mvPerDay.get(ymd) ?? 0,
      provisional,
      // Said ONCE, where the stretch starts, not on every cell after it.
      boundaryStart: provisional && ymd === boundaryFirstDay,
    });
  }

  // Trailing pad. 30 Sep 2026 is a Wednesday, so September ends with four empty positions.
  let pad = 1;
  while (cells.length % 7 !== 0) cells.push(blankCell(addDays(end, pad++)));

  const weeks: MonthDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return {
    monthStart: startYmd,
    monthEnd: endYmd,
    label: start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    weeks,
    bands: [...bandsFor('VL', vlMsgPerDay, start, end), ...bandsFor('MV', mvMsgPerDay, start, end)],
    datedThrough,
    datedAfterMonth,
    datedInMonth,
    vlDaysCovered: vlPerDay.size,
    notDated: {
      total: notDatedTotal,
      published: notDatedPublished,
      unpublished: notDatedTotal - notDatedPublished,
      sharePct: vlTotal > 0 ? Math.round((notDatedTotal / vlTotal) * 100) : null,
    },
    asOf: new Date().toISOString(),
    warnings,
  };
}

function blankCell(d: Date): MonthDay {
  return {
    date: toYmd(d),
    dayOfMonth: d.getUTCDate(),
    weekday: weekdayName(d),
    inMonth: false,
    isToday: false,
    isWeekend: d.getUTCDay() === 0 || d.getUTCDay() === 6,
    vl: 0,
    mv: 0,
    provisional: false,
    boundaryStart: false,
  };
}

/**
 * Collapse a per-day message map into contiguous bands.
 *
 * A stretch with no message becomes a band with `gap: true` and `name: null` — carried rather than
 * skipped, because the component needs to know WHERE the absence sits in order to draw a hairline
 * there instead of a filled block. Skipping it would leave the track blank, which reads as a
 * rendering failure rather than as a stated gap.
 *
 * Exported for tests/offline/verify-month — the run-collapsing and the percentage maths are the
 * fiddliest logic in this file and the only part that does not need a token to exercise.
 */
export function bandsFor(
  brand: Brand,
  perDay: Map<string, string | null>,
  start: Date,
  end: Date,
): MonthBand[] {
  const total = end.getUTCDate();
  const nameOn = (day: number): string | null =>
    perDay.get(toYmd(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day)))) ?? null;

  const out: MonthBand[] = [];
  let runName = nameOn(1);
  let runFrom = 1;

  const flush = (lastDay: number) => {
    const days = lastDay - runFrom + 1;
    out.push({
      brand,
      name: runName,
      gap: runName === null,
      startYmd: toYmd(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), runFrom))),
      endYmd: toYmd(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), lastDay))),
      leftPct: ((runFrom - 1) / total) * 100,
      widthPct: (days / total) * 100,
      days,
    });
  };

  for (let day = 2; day <= total; day++) {
    const here = nameOn(day);
    if (here !== runName) {
      flush(day - 1);
      runName = here;
      runFrom = day;
    }
  }
  flush(total);
  return out;
}
