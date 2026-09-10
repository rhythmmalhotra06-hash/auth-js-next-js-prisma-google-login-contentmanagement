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
import { COMMS_DAY, VL_VIDEOS, VL_MESSAGE_OF_WEEK } from '@/lib/airtable/field-map';
import { weekBounds, weekStartOf, toYmd, weekdayName, addDays } from '@/lib/mow/week';
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

/**
 * Values that are present but meaningless — the third data state.
 *
 * `test` and `vcvdsv` are real rows someone typed to check the sync worked. They are neither
 * filled nor empty, and the UI shows them with a `placeholder value` chip rather than rewriting
 * or hiding them. Kept deliberately narrow: a short nonsense string, not a heuristic that might
 * swallow a real short title.
 */
const PLACEHOLDERS = new Set(['test', 'testing', 'vcvdsv', 'asdf', 'xxx', 'tbd', 'n/a']);
const isPlaceholder = (v: string | null): boolean => !!v && PLACEHOLDERS.has(v.trim().toLowerCase());

/** How many individual assets a lane renders before collapsing the rest. */
const MV_INLINE = 2;

export async function getCalendarWeekFromAirtable(anchor: Date): Promise<CalendarWeek> {
  // Every dated VL row is fetched, not just this week's: the same pass yields the not-dated
  // counts and the `datedThrough` boundary. ~440 rows, so one cheap pass.
  const vlRes = await listAll(VL_VIDEOS.baseId, VL_VIDEOS.tableId);
  if (!vlRes.ok) throw new Error(`Vishen lane: ${vlRes.error.message}`);

  const msgRes = await listAll(VL_MESSAGE_OF_WEEK.baseId, VL_MESSAGE_OF_WEEK.tableId);

  const { start, end } = weekBounds(weekStartOf(anchor));
  const mvRes = await listAll(COMMS_DAY.baseId, COMMS_DAY.tableId, {
    filterByFormula: `AND(IS_AFTER({Date}, "${toYmd(addDays(start, -1))}"), IS_BEFORE({Date}, "${toYmd(addDays(end, 1))}"))`,
  });
  if (!mvRes.ok) throw new Error(`Mindvalley lane: ${mvRes.error.message}`);

  return assembleWeek({
    anchor,
    vlRows: vlRes.data,
    msgRows: msgRes.ok ? msgRes.data : [],
    mvRows: mvRes.data,
    msgError: msgRes.ok ? null : msgRes.error.message,
  });
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
}: {
  anchor: Date;
  vlRows: AirtableRecord[];
  msgRows: AirtableRecord[];
  mvRows: AirtableRecord[];
  msgError?: string | null;
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
  const vlByDay = new Map<string, CalendarAsset[]>();

  for (const r of vlRows) {
    const f = r.fields as Record<string, unknown>;
    const status = selectName(f[VL_VIDEOS.fields.status]);
    const published = !!status && status.startsWith('7');
    const live = str(f[VL_VIDEOS.fields.liveDate]);

    if (!live) {
      // Never dropped. Counted, and reachable from the tray.
      notDatedTotal++;
      if (published) notDatedPublished++;
      continue;
    }
    const day = live.slice(0, 10);
    if (!vlDatedThrough || day > vlDatedThrough) vlDatedThrough = day;
    if (day < startYmd || day > endYmd) continue;

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
        messageName: msg?.name ?? null,
        goal: msg?.goal ?? firstLookup(f[VL_VIDEOS.readOnlyFields.goalFromMessage]),
      },
    ]);
  }

  // ── Mindvalley lane ───────────────────────────────────────────────────────
  // Linked Emails / Social arrive as recIds; resolving every title would be extra round-trips for
  // rows the meeting reads as volume, so the count shows and the titles stay one click away.
  const mvByDay = new Map<string, { assets: CalendarAsset[]; overflow: number }>();
  let mvMessage: string | null = null;
  let mvGoal: string | null = null;

  for (const r of mvRows) {
    const f = r.fields as Record<string, unknown>;
    const day = (str(f[COMMS_DAY.fields.date]) ?? '').slice(0, 10);
    if (!day) continue;

    mvMessage ??= str(f[COMMS_DAY.fields.messageOfWeek]);
    mvGoal ??= str(f[COMMS_DAY.fields.theGoal]);

    const emails = ids(f[COMMS_DAY.links.emails]);
    const socials = ids(f[COMMS_DAY.links.socialAllAssets]);
    const assets: CalendarAsset[] = [];

    if (emails.length) {
      assets.push({
        id: `${r.id}:email`, title: 'Email', brand: 'MV', channel: 'Email',
        status: null, source: null, publishedUrl: null, live: false,
        messageName: str(f[COMMS_DAY.fields.messageOfWeek]), goal: str(f[COMMS_DAY.fields.theGoal]),
      });
    }
    if (socials.length) {
      assets.push({
        id: `${r.id}:social`, title: 'Social', brand: 'MV', channel: 'Social',
        status: null, source: null, publishedUrl: null, live: false,
        messageName: str(f[COMMS_DAY.fields.messageOfWeek]), goal: str(f[COMMS_DAY.fields.theGoal]),
      });
    }
    const total = emails.length + socials.length;
    mvByDay.set(day, { assets: assets.slice(0, MV_INLINE), overflow: Math.max(0, total - assets.length) });
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

  // A message may span more weeks than this one; say so rather than implying it is this week's alone.
  const vlMsg = [...msgById.values()].find((m) => m.brand === 'VL');

  const headers: BrandWeekHeader[] = [
    {
      brand: 'VL', label: 'Vishen Lakhiani Media',
      message: vlMsg?.name ?? null,
      goal: vlMsg?.goal ?? null,
      messageIsPlaceholder: isPlaceholder(vlMsg?.name ?? null),
      goalIsPlaceholder: isPlaceholder(vlMsg?.goal ?? null),
      datedCount: vlDated,
      volumePct: Math.round((vlDated / busiest) * 100),
      spanNote: null,
    },
    {
      brand: 'MV', label: 'Mindvalley',
      message: mvMessage, goal: mvGoal,
      messageIsPlaceholder: isPlaceholder(mvMessage),
      goalIsPlaceholder: isPlaceholder(mvGoal),
      datedCount: mvDated,
      volumePct: Math.round((mvDated / busiest) * 100),
      spanNote: null,
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
    brandsWithoutGoal: headers.filter((h) => !h.goal || h.goalIsPlaceholder).map((h) => h.brand),
    notDated: {
      total: notDatedTotal,
      published: notDatedPublished,
      unpublished: notDatedTotal - notDatedPublished,
    },
    datedThrough: vlDatedThrough,
    asOf: new Date().toISOString(),
    warnings,
  };
}

/** Records helper kept exported for the reader's own tests. */
export type { AirtableRecord };
