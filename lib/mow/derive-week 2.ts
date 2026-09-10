// Deriving a MOW message's week, and normalising its brand — both of which exist because the
// Airtable master is mid-fix. Plan §0 / decisions V2 and V3.
//
// WHY DERIVE AT ALL: `MOW-HANDOFF-10SEP.md` §3.1 calls the missing `Week starting` field a hard
// blocker, on the grounds that with one message row per brand there is no way to establish that
// two rows are the same week. That is true of the field, but not of the data: a message already
// carries dates through its links —
//   • MV messages → the 🗓️ Comms Calendar link (verified 10 Sep: 'Expert to Authority' links
//     Sep 7–21, 'Meditations & Manifesting' links Sep 1–6)
//   • VL messages → the `Live Date (from Videos)` lookup
// So the week is derivable today, which is what makes the surface testable before the field lands.
//
// The field is still being added (V2). When `weekStarting` is populated it WINS — deriving is the
// fallback, not the design.

import { weekStartOf, toYmd } from './week';

export type MowBrandKey = 'MV' | 'VL';

/**
 * Map Airtable's Brand value onto a stable key.
 *
 * 'Mindalley' is a live misspelling on 6 of the 7 records (verified 10 Sep). It is recognised
 * here so the surface keeps working, and deliberately NOT rewritten anywhere: reference data is
 * read-only in the app and the fix belongs in Airtable followed by a reconcile
 * (`MOW-HANDOFF-10SEP.md` §3.4). Recognising both spellings means the app needs no change on the
 * day Ramya fixes it.
 */
export function normaliseBrand(raw: string | null | undefined): MowBrandKey | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (v === 'vl' || v.startsWith('vishen')) return 'VL';
  // Both the correct spelling and the live typo.
  if (v === 'mindvalley' || v === 'mindalley' || v === 'mv') return 'MV';
  return null;
}

/** Human label for a brand key. Never the raw Airtable value — that carries the typo. */
export const BRAND_LABEL: Record<MowBrandKey, string> = {
  MV: 'Mindvalley',
  VL: 'Vishen Lakhiani Media',
};

export interface DerivedWeeks {
  /** Every Monday the message's linked dates fall into, ascending. */
  weekStarts: Date[];
  /** How the week was established — surfaced in the UI so a derived week is never mistaken for a set one. */
  source: 'field' | 'derived' | 'none';
  /** True when the message spans more than one week; it renders in each, marked (V2). */
  spansMultiple: boolean;
}

/**
 * Establish which week(s) a message belongs to.
 *
 * `weekStarting` wins when present. Otherwise every linked date is bucketed to its Monday, and
 * the message belongs to all of them — a message spanning three weeks ('Expert to Authority',
 * Sep 7–21) is shown in each rather than being guessed into one. Guessing is what the handoff
 * was rightly worried about; showing it three times with a marker is honest and still useful.
 */
export function deriveWeeks(msg: {
  weekStarting?: Date | null;
  linkedDates?: (Date | string | null | undefined)[];
}): DerivedWeeks {
  if (msg.weekStarting) {
    return { weekStarts: [weekStartOf(msg.weekStarting)], source: 'field', spansMultiple: false };
  }

  const seen = new Map<string, Date>();
  for (const d of msg.linkedDates ?? []) {
    if (!d) continue;
    const date = d instanceof Date ? d : parseLoose(d);
    if (!date) continue;
    const ws = weekStartOf(date);
    seen.set(toYmd(ws), ws);
  }

  const weekStarts = [...seen.values()].sort((a, b) => a.getTime() - b.getTime());
  if (!weekStarts.length) return { weekStarts: [], source: 'none', spansMultiple: false };
  return { weekStarts, source: 'derived', spansMultiple: weekStarts.length > 1 };
}

/**
 * Dates arrive in several shapes from Airtable: a bare "YYYY-MM-DD" from a date field, an ISO
 * timestamp from a lookup, and — on the comms-calendar link — the record's DISPLAY NAME, which
 * for that table is a formula rendering "September 8, 2026". All three appear in live data, so
 * all three parse.
 */
function parseLoose(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(`${s.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // "September 8, 2026" — the comms-calendar link's display name.
  const m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(s);
  if (m) {
    const month = MONTHS.indexOf(m[1].toLowerCase());
    if (month >= 0) return new Date(Date.UTC(Number(m[3]), month, Number(m[2])));
  }
  return null;
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/**
 * A message name like `MV: Be Extraordinary VL: Podcast - Naveen Jain` is real, live data —
 * someone jamming two brands into one record because the structure didn't let them separate
 * (10 Sep handoff §1). It must render without breaking brand grouping (acceptance criterion 7),
 * so this splits the display text per brand while leaving the record's own Brand tag authoritative.
 */
export function splitJammedName(name: string | null | undefined, brand: MowBrandKey | null): string {
  if (!name) return '';
  const m = /^\s*MV:\s*(.*?)\s+VL:\s*(.*)$/i.exec(name);
  if (!m) return name.trim();
  if (brand === 'MV') return m[1].trim();
  if (brand === 'VL') return m[2].trim();
  return name.trim();
}
