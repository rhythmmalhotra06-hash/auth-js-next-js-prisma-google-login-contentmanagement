// Prioritization scoring — implements context/prioritization-algorithm.md.
//
//   urgency        = w_due * due_proximity_norm + w_event * event_tier_norm
//   complexity     = w_effort * effort_norm + w_variants * variants_norm + w_shoot * shoot
//   priority_score = urgency + lead_time_adjustment(complexity)
//
// Phase-1 seed weights — now admin-editable via lib/scoring-config (/settings/scoring).
// These constants remain the fallback when no config is supplied. Pure + framework-free.
//
// Inputs not yet available use documented defaults:
//  - event tiers: per-event-type "Tier Norm" config, else a name-based heuristic
//  - asset effort: per-asset-type "Effort Norm" config, else 0.5
//  - shoot flag: not synced yet → false

import { type ScoringConfig, DEFAULTS } from '@/lib/scoring-config/config';

export const WEIGHTS = { ...DEFAULTS.weights } as const;

// Provisional event-tier → norm. Matched on the event type NAME; default 0.5.
// Used only when an event type has no explicit "Tier Norm" set in the config.
const TIER_PATTERNS: { re: RegExp; norm: number }[] = [
  { re: /mastery|summit|\bmbu\b|festival/i, norm: 1.0 },
  { re: /masterclass|academy|membership/i, norm: 0.7 },
  { re: /social|pathway|campaign|advertis/i, norm: 0.7 },
  { re: /states/i, norm: 0.4 },
];

/** Event tier 0–1: the config's per-type value wins; else the name-pattern heuristic. */
export function eventTierNorm(eventTypeName: string | null, cfg?: ScoringConfig): number {
  if (!eventTypeName) return 0.5;
  if (cfg && eventTypeName in cfg.tierByEventType) return cfg.tierByEventType[eventTypeName];
  for (const t of TIER_PATTERNS) if (t.re.test(eventTypeName)) return t.norm;
  return 0.5;
}

// Closer due date = higher. max(0, 1 - days_until_due / window), clamped to [0,1].
export function dueProximityNorm(dueDate: Date | null, now: Date, windowDays: number = DEFAULTS.dueProximityWindowDays): number {
  if (!dueDate) return 0;
  const days = (dueDate.getTime() - now.getTime()) / 86_400_000;
  return Math.max(0, Math.min(1, 1 - days / windowDays));
}

// Campaign-window proximity 0–1 (E9.5). No dates → 0 (no boost). Inside the active
// window (start..end) → 1. Otherwise ramps up as the start (or end, if no start)
// approaches, like dueProximityNorm; once past the window's end → 0.
export function campaignProximityNorm(
  start: Date | null,
  end: Date | null,
  now: Date,
  windowDays: number = DEFAULTS.dueProximityWindowDays,
): number {
  if (!start && !end) return 0;
  if (start && end && now >= start && now <= end) return 1;
  if (end && !start && now <= end) {
    const days = (end.getTime() - now.getTime()) / 86_400_000;
    return Math.max(0, Math.min(1, 1 - days / windowDays));
  }
  const target = start ?? end;
  if (!target) return 0;
  const days = (target.getTime() - now.getTime()) / 86_400_000;
  if (days < 0) return 0; // window has passed
  return Math.max(0, Math.min(1, 1 - days / windowDays));
}

/**
 * Blend the (normalized) Airtable SCORE base with app-side deadline + campaign
 * urgency for the live queue order (E9.5). Additive so an imminent deadline lifts
 * an item without letting a trivial-but-urgent task bury a high-revenue one.
 */
export function blendQueueScore(
  parts: { scoreNorm: number; dueNorm: number; campaignNorm: number },
  cfg?: ScoringConfig,
): number {
  const w = cfg?.weights ?? WEIGHTS;
  return parts.scoreNorm + w.due * parts.dueNorm + w.campaign * parts.campaignNorm;
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

export function scoreTicket(i: ScoreInputs, cfg?: ScoringConfig): Score {
  const w = cfg?.weights ?? WEIGHTS;
  const leadtime = cfg?.leadtimeFactor ?? DEFAULTS.leadtimeFactor;
  const window = cfg?.dueProximityWindowDays ?? DEFAULTS.dueProximityWindowDays;

  const urgency = w.due * dueProximityNorm(i.dueDate, i.now, window) + w.event * eventTierNorm(i.eventTypeName, cfg);

  const variantsNorm = i.maxVariants > 0 ? Math.min(1, i.variantCount / i.maxVariants) : 0;
  const complexity =
    w.effort * (i.effortNorm ?? DEFAULTS.effortNorm) + w.variants * variantsNorm + w.shoot * (i.shootFlag ? 1 : 0);

  // Lead-time adjustment: nudge high-complexity items earlier (gentle, additive —
  // NOT a multiplier, so a trivial-but-urgent task can't outrank a critical campaign).
  const priorityScore = urgency + leadtime * complexity;

  return { urgency: round(urgency), complexity: round(complexity), priorityScore: round(priorityScore) };
}
