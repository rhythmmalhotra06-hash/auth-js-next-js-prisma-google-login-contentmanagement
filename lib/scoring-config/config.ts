// Pure, serializable capacity/scoring config + resolvers. No Airtable imports, so
// this is safe to bundle into client components (e.g. QueueTable) and to pass
// across the server→client boundary as a prop. The Airtable-backed reader/writer
// lives in ./repository. Plain objects (not Maps) keep it serializable.

export interface ScoringConfig {
  defaultCapacity: number;
  weights: { due: number; event: number; effort: number; variants: number; shoot: number; campaign: number };
  leadtimeFactor: number;
  amberPct: number;
  redPct: number;
  riskCapacityDays: number;
  dueProximityWindowDays: number;
  /**
   * How much a ticket's deadline counts, by whether the date is real. Multiplies the
   * due-proximity term only — a fixed launch gets the full deadline push, an evergreen
   * item barely any, so it can't crowd out committed work just by having a date typed in.
   */
  certaintyFactor: { fixed: number; target: number; evergreen: number };
  /** editor / contractor name → capacity (only names with an explicit override) */
  capacityByName: Record<string, number>;
  /** event type name → ticket load weight (only types with an explicit weight) */
  loadWeightByEventType: Record<string, number>;
  /** asset type name → ticket load weight */
  loadWeightByAssetType: Record<string, number>;
  /** event type name → priority tier 0–1 (only types with an explicit tier) */
  tierByEventType: Record<string, number>;
  /** asset type name → priority effort 0–1 */
  effortByAssetType: Record<string, number>;
}

// Defaults reproduce the pre-config hardcoded behaviour exactly. Any blank field
// or unreachable Airtable read falls back to these, so the feature is a no-op
// until an admin changes something.
export const DEFAULTS = {
  defaultCapacity: 4,
  weights: { due: 0.5, event: 0.5, effort: 0.3, variants: 0.2, shoot: 0.5, campaign: 0.5 },
  leadtimeFactor: 0.2,
  amberPct: 75,
  redPct: 100,
  riskCapacityDays: 4,
  dueProximityWindowDays: 30,
  loadWeight: 1, // capacity cost of a ticket whose type has no weight set
  effortNorm: 0.5, // priority effort for an asset type with none set
  certaintyFactor: { fixed: 1, target: 0.6, evergreen: 0.15 },
  /** Legacy tickets (and anything left blank) rank as if the date is a target. */
  certaintyFallback: 'target',
} as const;

export function emptyConfig(): ScoringConfig {
  return {
    defaultCapacity: DEFAULTS.defaultCapacity,
    weights: { ...DEFAULTS.weights },
    leadtimeFactor: DEFAULTS.leadtimeFactor,
    amberPct: DEFAULTS.amberPct,
    redPct: DEFAULTS.redPct,
    riskCapacityDays: DEFAULTS.riskCapacityDays,
    dueProximityWindowDays: DEFAULTS.dueProximityWindowDays,
    certaintyFactor: { ...DEFAULTS.certaintyFactor },
    capacityByName: {},
    loadWeightByEventType: {},
    loadWeightByAssetType: {},
    tierByEventType: {},
    effortByAssetType: {},
  };
}

/** Capacity for an editor/contractor by name; falls back to the global default. */
export function capacityFor(cfg: ScoringConfig, name: string | null): number {
  if (name && name in cfg.capacityByName) return cfg.capacityByName[name];
  return cfg.defaultCapacity;
}

/** Weighted capacity cost of one ticket from its event/asset type names. Asset wins. */
export function loadWeightFor(cfg: ScoringConfig, eventType: string | null, assetType: string | null): number {
  if (assetType && assetType in cfg.loadWeightByAssetType) return cfg.loadWeightByAssetType[assetType];
  if (eventType && eventType in cfg.loadWeightByEventType) return cfg.loadWeightByEventType[eventType];
  return DEFAULTS.loadWeight;
}
