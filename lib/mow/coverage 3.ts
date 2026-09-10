// Which of several messages leads a brand's week — decision V5, extracted so there is exactly ONE
// implementation of it.
//
// WHY THIS FILE EXISTS. The rule lived inline in `resolveBrandsForWeek()` (the Postgres path). The
// Airtable calendar reader needed the same answer, reimplemented it as `mvMessage ??= …` — take
// whichever row the API happened to return first — and shipped two defects on its first live run:
//
//   • MV w/c 7 Sep carries TWO messages (`Expert to Authority` on 6 days, `Jim Kwik` on Tuesday)
//     and THREE goals (35k on Mon, 25k on Wed–Sun). `??=` picked one arbitrarily and silently
//     dropped Tuesday's content entirely.
//   • The VL lane scanned the whole table for a VL-branded row, so a message linked to an asset
//     dated 16 Sep was presented as the message for w/c 7 Sep — a brand's message invented from
//     nothing, which is the one thing the design handoff says never to do.
//
// Both are selection bugs, not parsing bugs, which is why they survived tests written against
// record shapes. The fix is not a second rule; it is one rule with two callers.
//
// THE RULE: coverage decides. The message the team hung most of the week on is the week's message;
// the rest are kept as `related` beneath it. Deliberately not name-matching — `Jim Kwik (Mention
// Expert to Authority)` is a beat inside the campaign, not a rival to it, and matching on names
// would either merge them (losing Tuesday) or rank them (implying they compete).

/**
 * One candidate message for one brand-week.
 *
 * Structural on purpose: callers pass their own richer type (`MowMessageForWeek`, or the MV
 * grouping with its per-goal day map) and get the SAME object back as `primary`, so nothing has to
 * be re-looked-up after the pick.
 */
export interface CoverageEntry {
  name: string;
  goal: string | null;
  /** How many days OF THIS WEEK the message actually covers. The whole basis of the sort. */
  daysInWeek: number;
  /** True when the message's dates reach outside this week — rendered as a marker, never guessed away. */
  spansMultiple?: boolean;
  /** Free-form provenance the caller wants carried through ('field' | 'derived' | 'none'). */
  weekSource?: string;
}

export interface CoverageResult<T extends CoverageEntry> {
  /** The week's message. Null only when there were no candidates at all. */
  primary: T | null;
  /** Everything else that also falls in this week, most-covering first. Never discarded. */
  related: T[];
  warnings: string[];
}

/**
 * Sort candidates by coverage and split off the leader.
 *
 * Ties broken by name so the answer is stable across calls — Airtable does not promise row order,
 * and an unstable primary would mean the same week rendered differently on two page loads.
 *
 * `label` names the brand in warnings ('MV', 'Mindvalley' — caller's choice).
 */
export function pickByCoverage<T extends CoverageEntry>(
  entries: T[],
  { label, weekLabel }: { label: string; weekLabel: string },
): CoverageResult<T> {
  const warnings: string[] = [];
  if (!entries.length) return { primary: null, related: [], warnings };

  const sorted = [...entries].sort(
    (a, b) => b.daysInWeek - a.daysInWeek || a.name.localeCompare(b.name),
  );
  const [primary, ...related] = sorted;

  // Only a genuine TIE is ambiguous. An uneven split is the normal, healthy shape — a campaign
  // message plus a one-day beat inside it — and warning about it would cry wolf every week.
  if (related.length && related[0].daysInWeek === primary.daysInWeek) {
    warnings.push(
      `${label} has ${sorted.length} messages for week ${weekLabel} with equal coverage ` +
        `(${primary.daysInWeek} day(s) each): leading with “${primary.name}”. Confirm which is the week's message.`,
    );
  }
  if (primary.spansMultiple) {
    warnings.push(`${label} message “${primary.name}” spans more than one week; shown in each, marked.`);
  }

  return { primary, related, warnings };
}

/**
 * A goal that varies across the days of ONE message is a data problem, and the finding IS the
 * warning — so this reports rather than quietly choosing.
 *
 * Live case, w/c 7 Sep: `Expert to Authority` reads "To achieve 35k leads…" on Mon 7 and
 * "To achieve 25k leads…" on Wed 9–Sun 13. Picking silently is how 35k disappeared from the first
 * live run, and how a headline number would have been sourced from a figure nobody chose.
 *
 * `days` maps a goal string to the dates carrying it, so the warning can name both.
 */
export function pickGoal(
  byGoal: Map<string, string[]>,
  { label, messageName }: { label: string; messageName: string },
): { goal: string | null; warnings: string[] } {
  const warnings: string[] = [];
  const entries = [...byGoal.entries()].filter(([g]) => g.trim());
  if (!entries.length) return { goal: null, warnings };

  entries.sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  if (entries.length > 1) {
    const described = entries
      .map(([g, days]) => `“${g.trim()}” (${days.length === 1 ? days[0] : `${days.length} days`})`)
      .join(' and ');
    warnings.push(
      `${label} message “${messageName}” carries ${entries.length} different goals this week: ` +
        `${described}. Leading with the one covering most days — confirm which is right.`,
    );
  }

  return { goal: entries[0][0], warnings };
}

/**
 * Values that are present but meaningless — the third data state, alongside filled and empty.
 *
 * `test` (a message name) and `vcvdsv` (a goal) are rows someone typed to check the sync worked.
 *
 * **Decision Y2: these SUPPRESS to the tier-1 gap rather than displaying.** An earlier pass showed
 * the value with a `placeholder value` chip; the design handoff flagged that as needing
 * confirmation before it went in front of a viewer, and it did not survive the question — the
 * surface's primary reader is the founder, and junk with an explanatory chip still reads as a
 * broken tool. The value is never rewritten, merely not shown; callers set `*IsPlaceholder` so the
 * junk reaches `warnings`, where the people who can fix it will see it.
 *
 * Deliberately narrow: an explicit list, not a heuristic that might swallow a real short title.
 */
const PLACEHOLDERS = new Set(['test', 'testing', 'vcvdsv', 'asdf', 'xxx', 'tbd', 'n/a', '-']);

export const isPlaceholder = (v: string | null | undefined): boolean =>
  !!v && PLACEHOLDERS.has(v.trim().toLowerCase());

/** A value fit to display: the string itself, or null when absent OR meaningless (Y2). */
export const meaningful = (v: string | null | undefined): string | null =>
  !v || !v.trim() || isPlaceholder(v) ? null : v.trim();
