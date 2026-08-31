// DNA records — E12.3 (dna-pilot-selection.md). Three layers, fixed precedence when
// they conflict: structured fields (hard constraints, never violated) > NL brief
// (gap-filler) > gold reference (style tiebreaker, imitated only where both are silent).
//
// Real records live in Airtable, built for pilot asset types first — and per E12.3's
// Open Questions, the pilot types themselves are NOT YET CHOSEN (Gareth/Titus, as of
// 2026-08-31). getDnaForAssetType() below is a placeholder that always returns one
// stub record so E12.1 (the brain service) has something real to call Claude against
// today. Swap its body for a real Airtable lookup once E12.3 lands — nothing else in
// this module should need to change; the DnaRecord shape is the actual contract.

export interface DnaStructuredFields {
  captionFont: string;
  captionWeight: number;
  captionSizePx: number;
  /** Versioned spec id — safe areas shift as platforms change UI (E12.3 Rules & Logic).
   *  Never hard-code geometry against this id outside a real spec lookup table. */
  safeAreaSpecId: string;
  targetLufs: number;
  aspectRatio: string;
}

export interface DnaRecord {
  assetType: string;
  structuredFields: DnaStructuredFields;
  /** Gap-filler, seeded from the clip-engine base prompt (E8) per E12.3. */
  nlBrief: string;
  /** Style tiebreaker — link/descriptor of an exemplar clip. Null until one is chosen. */
  goldReference: string | null;
  /** e.g. "podcast@2026-06-28" — stamped onto every EDL the brain emits for drift
   *  tracking (E12.4). Bump this whenever structuredFields or nlBrief change. */
  dnaVersion: string;
}

/**
 * STUB — not a real pilot type. Placeholder DNA so the brain service (E12.1) is
 * exercisable before E12.3 picks real pilot asset types and builds their Airtable
 * records. Values are plausible defaults, not sourced from any actual brand spec —
 * do not treat this as the real Mindvalley caption/safe-area standard.
 */
export const STUB_PILOT_DNA: DnaRecord = {
  assetType: '__stub_pilot__',
  structuredFields: {
    captionFont: 'MV Sans',
    captionWeight: 700,
    captionSizePx: 48,
    safeAreaSpecId: 'ig_reel_v2',
    targetLufs: -14.0,
    aspectRatio: '9:16',
  },
  nlBrief:
    'Punchy, high-energy talking-head reels. Favor tight cuts on the hook and a confident, ' +
    'direct-to-camera delivery. This brief is a placeholder — real pilot briefs are seeded ' +
    'from the clip-engine base prompt (see lib/clipping/prompt.ts) per E12.3.',
  goldReference: null,
  dnaVersion: 'stub@2026-08-31',
};

/**
 * Resolve the DNA record for an asset type. Always returns the stub today — see the
 * module header. Never throws; a missing/unbuilt DNA record for a real asset type
 * should fail loudly at the call site (E12.1's generate step), not silently here.
 */
export async function getDnaForAssetType(assetType: string): Promise<DnaRecord> {
  void assetType; // unused until the real Airtable-backed lookup replaces this stub
  return STUB_PILOT_DNA;
}
