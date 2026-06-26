// Prioritization scoring — implements context/prioritization-algorithm.md.
//
//   urgency        = w_due * due_proximity_norm + w_event * event_tier_norm
//   complexity     = w_effort * effort_norm + w_variants * variants_norm + w_shoot * shoot
//   priority_score = urgency + lead_time_adjustment(complexity)
//
// Phase-1 seed weights — tune after a real week (OODA). Pure + framework-free.
//
// Inputs not yet available use documented defaults:
//  - event tiers: PROVISIONAL name-based heuristic pending Moniek's ranking
//  - asset effort + shoot flag: not synced yet → effort 0.5, shoot false

export const WEIGHTS = { due: 0.5, event: 0.5, effort: 0.3, variants: 0.2, shoot: 0.5 } as const;

// Provisional event-tier → norm. Matched on the event type NAME; default 0.5.
// [CONFIRM with Moniek] — replace with the real tier ranking once decided.
const TIER_PATTERNS: { re: RegExp; norm: number }[] = [
  { re: /mastery|summit|\bmbu\b|festival/i, norm: 1.0 },
  { re: /masterclass|academy|membership/i, norm: 0.7 },
  { re: /social|pathway|campaign|advertis/i, norm: 0.7 },
  { re: /states/i, norm: 0.4 },
];

export function eventTierNorm(eventTypeName: string | null): number {
  if (!eventTypeName) return 0.5;
  for (const t of TIER_PATTERNS) if (t.re.test(eventTypeName)) return t.norm;
  return 0.5;
}

// Closer due date = higher. max(0, 1 - days_until_due / 30), clamped to [0,1].
export function dueProximityNorm(dueDate: Date | null, now: Date): number {
  if (!dueDate) return 0;
  const days = (dueDate.getTime() - now.getTime()) / 86_400_000;
  return Math.max(0, Math.min(1, 1 - days / 30));
}

export interface ScoreInputs {
  dueDate: Date | null;
  eventTypeName: string | null;
  variantCount: number; // asset_type dimension count
  maxVariants: number; // largest dimension count across asset types (for normalization)
  effortNorm?: number; // 0..1 (default 0.5 until asset effort is synced)
  shootFlag?: boolean; // requires a shoot (default false until shoots are synced)
  now: Date;
}

export interface Score {
  urgency: number;
  complexity: number;
  priorityScore: number;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export function scoreTicket(i: ScoreInputs): Score {
  const urgency = WEIGHTS.due * dueProximityNorm(i.dueDate, i.now) + WEIGHTS.event * eventTierNorm(i.eventTypeName);

  const variantsNorm = i.maxVariants > 0 ? Math.min(1, i.variantCount / i.maxVariants) : 0;
  const complexity =
    WEIGHTS.effort * (i.effortNorm ?? 0.5) + WEIGHTS.variants * variantsNorm + WEIGHTS.shoot * (i.shootFlag ? 1 : 0);

  // Lead-time adjustment: nudge high-complexity items earlier (gentle, additive —
  // NOT a multiplier, so a trivial-but-urgent task can't outrank a critical campaign).
  const priorityScore = urgency + 0.2 * complexity;

  return { urgency: round(urgency), complexity: round(complexity), priorityScore: round(priorityScore) };
}
