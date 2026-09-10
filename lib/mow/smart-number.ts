// The ONE headline number for a MOW week, and how its target is resolved.
//
// Decisions this encodes (plans/ref-to-sep-call-zazzy-moth.md):
//  • S1 — exactly one headline per week. A single object, never an array. The other candidate
//    metrics are `drivers` and render smaller. The picker is a radio, never a multi-select.
//  • S2 — a live campaign defaults the headline to LEADS against the campaign's own lead goal;
//    otherwise the default comes from the week's primary Offer.
//  • S5 — Metabase (questions 31846 leads / 32044 revenue) is revenue truth. Braze is only ever
//    "engaged revenue" and must never occupy the headline slot.
//
// ── The target problem, verified against the live base on 2026-09-09 ──────────
// S2 assumed the campaign carries a numeric lead goal. It does not. On 📅 Official Cal,
// `Lead gen Goal` (fldQb61pVXu9aMHM3), `TOTAL Target revenue` and `Actual revenue` are EMPTY —
// including on `recK9N1ignQfnmD5v`, the Expert to Authority Summit that is live this very week.
// The real target exists only as PROSE on the Comms Calendar day rows:
//     "To achieve 35k leads to expert to authority summit"
//     "To achieve 25k leads to expert to authority summit"
//
// So the target is resolved in priority order, and the provenance travels with it:
//   1. `numeric`  — the Official Cal lookup, once someone populates it. The real fix.
//   2. `inferred` — parsed out of the prose goal. Usable, and NEVER presented as authoritative:
//                   the UI must show the prose beside it and label the number as inferred.
//   3. `none`     — prose only, no comparison, no % achieved. An honest empty target.
// Nothing here silently invents a denominator.

/**
 * `revenue` is ORGANIC SOCIAL revenue and nothing else — Glen's rule, and the difference between
 * $6,855 and $504,748 for w/c 7 Sep. `email_revenue` is carried separately rather than folded in
 * (AB3): Ramya presents email, Glen presents social, and a combined total would let either be
 * mistaken for the other. They are never summed.
 */
export type SmartNumberKey = 'revenue' | 'email_revenue' | 'leads' | 'active_users';

export const SMART_NUMBER_LABELS: Record<SmartNumberKey, string> = {
  revenue: 'Revenue · organic social',
  email_revenue: 'Revenue · email',
  leads: 'Leads',
  active_users: 'Active users gained',
};

export interface ResolvedTarget {
  /** null when it could not be established — render "no target set", never 0. */
  value: number | null;
  /** Where the number came from. 'inferred' MUST be surfaced in the UI. */
  provenance: 'numeric' | 'inferred' | 'none';
  /** The human sentence, always shown when present — it is the thing the team actually wrote. */
  prose: string | null;
}

/**
 * Pull a lead/revenue target out of a prose goal.
 *
 * Handles the shapes the team actually writes: "35k leads", "25K leads", "35,000 leads",
 * "$120k". Requires a unit suffix or thousands separator so a stray year or ordinal in the
 * sentence ("Q4", "2026") can't be mistaken for a target.
 */
export function parseTargetFromProse(prose: string | null | undefined): number | null {
  if (!prose) return null;
  // <number><optional k/m> immediately before an optional currency/lead word.
  const m = /(\$?\s*)(\d[\d,.]*)\s*([kKmM])\b|(\$?\s*)(\d{1,3}(?:,\d{3})+)/.exec(prose);
  if (!m) return null;
  const raw = (m[2] ?? m[5] ?? '').replace(/,/g, '');
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const suffix = (m[3] ?? '').toLowerCase();
  const scaled = suffix === 'k' ? n * 1_000 : suffix === 'm' ? n * 1_000_000 : n;
  return Number.isFinite(scaled) ? scaled : null;
}

export function resolveTarget(opts: {
  /** The Official Cal numeric lookup for this metric, when populated. */
  numeric?: number | null;
  /** `CommsDay.theGoal` — the prose the team wrote. */
  prose?: string | null;
}): ResolvedTarget {
  const prose = opts.prose?.trim() || null;
  if (opts.numeric != null && Number.isFinite(opts.numeric) && opts.numeric > 0) {
    return { value: opts.numeric, provenance: 'numeric', prose };
  }
  const inferred = parseTargetFromProse(prose);
  if (inferred != null) return { value: inferred, provenance: 'inferred', prose };
  return { value: null, provenance: 'none', prose };
}

/**
 * Which metric leads the week, before any human override.
 *
 * S2: a live campaign → leads. Otherwise the primary Offer's own definition. Falling back to
 * 'leads' rather than 'revenue' is deliberate — leads is the number we can source for any week
 * from Metabase 31846, so the default is always populated rather than defaulting to a blank.
 */
export function defaultSmartNumberKey(opts: {
  hasLiveCampaign: boolean;
  offerDefinition?: string | null;
}): SmartNumberKey {
  if (opts.hasLiveCampaign) return 'leads';
  const d = opts.offerDefinition;
  if (d === 'revenue' || d === 'leads' || d === 'active_users') return d;
  return 'leads';
}

/**
 * A campaign is live for the week if any of its days links out to 📅 Official Cal.
 * `officialCalIds` is populated by the CommsDay mirror.
 */
export const hasLiveCampaign = (days: { officialCalIds: string[] }[]): boolean =>
  days.some((d) => d.officialCalIds.length > 0);

export interface SmartNumber {
  key: SmartNumberKey;
  label: string;
  value: number | null;
  target: number | null;
  targetProvenance: ResolvedTarget['provenance'];
  targetProse: string | null;
  /** Provenance of the VALUE, e.g. 'session:metabase' | 'app:metabase'. Rendered on the page so
   *  swapping the Metabase path (plan §2) is visible rather than silent. */
  source: string | null;
  /** Revenue drifts upward as late attribution lands, so a figure is never final. */
  asOf: string | null;
}

/** Build the single headline object. Callers pass drivers separately — never inside this. */
export function buildSmartNumber(opts: {
  key: SmartNumberKey;
  value: number | null;
  target: ResolvedTarget;
  source: string | null;
  asOf?: Date | null;
}): SmartNumber {
  return {
    key: opts.key,
    label: SMART_NUMBER_LABELS[opts.key],
    value: opts.value,
    target: opts.target.value,
    targetProvenance: opts.target.provenance,
    targetProse: opts.target.prose,
    source: opts.source,
    asOf: opts.asOf ? opts.asOf.toISOString() : null,
  };
}
