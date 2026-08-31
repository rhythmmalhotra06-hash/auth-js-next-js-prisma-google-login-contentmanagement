// Structured-output contract for the Edit Decision List (EDL) — E12.1's brain↔executor
// contract (see prd/content-production-management/auto-editing-agent/edl-brain-service.md
// and the companion technical design doc, section 3.1). One EDL per clip.
//
// Unlike STRATEGY_SCHEMA (lib/clipping/schema.ts), this schema is small and single-clip,
// so it is in no danger of the structured-output grammar size cap — but if fields are
// ever added, the same rule applies: structure (properties/nesting/enums) costs grammar
// size, description length does not.

import type { DnaRecord } from './dna';

export const RENDER_TARGETS = ['premiere_uxp'] as const; // v2 may add 'ffmpeg' (headless)
export type RenderTarget = (typeof RENDER_TARGETS)[number];

export const REFRAME_MODES = ['speaker_track', 'static'] as const;
export type ReframeMode = (typeof REFRAME_MODES)[number];

const str = (description: string) => ({ type: 'string', description });
const num = (description: string) => ({ type: 'number', description });

export interface ReframeKeyframe {
  t: number; // seconds, relative to clip start
  x: number; y: number; w: number; h: number; // normalized 0–1 crop rect
}

export interface Reframe {
  mode: ReframeMode;
  keyframes: ReframeKeyframe[];
}

export interface Caption {
  t_in: number;
  t_out: number;
  text: string;
  font: string;
  weight: number;
  size_px: number;
  x: number; // normalized 0–1
  y: number; // normalized 0–1
  safe_area: string; // versioned spec id, e.g. "ig_reel_v2" — see DnaRecord
}

export interface AudioSpec {
  target_lufs: number;
  normalize: boolean;
}

export interface Edl {
  clip_id: string;
  source_uri: string;
  in: number; // seconds
  out: number; // seconds
  aspect: string; // e.g. "9:16"
  reframe: Reframe;
  captions: Caption[];
  audio: AudioSpec;
  dna_version: string; // which DNA produced this — drift tracking (E12.4)
  render_target: RenderTarget;
}

export const EDL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['clip_id', 'source_uri', 'in', 'out', 'aspect', 'reframe', 'captions', 'audio', 'render_target'],
  properties: {
    clip_id: str('The clip record id this EDL was generated for. Copy verbatim from the input — never invent one.'),
    source_uri: str('The canonical source media URI. Copy verbatim from the input.'),
    in: num('Clip start, in seconds, relative to the source. Copy from the input clip window — never invent a timestamp.'),
    out: num('Clip end, in seconds, relative to the source. Must be greater than "in".'),
    aspect: str('Target aspect ratio, e.g. "9:16". Use the DNA\'s structured aspect ratio.'),
    reframe: {
      type: 'object',
      additionalProperties: false,
      required: ['mode', 'keyframes'],
      properties: {
        mode: { type: 'string', enum: [...REFRAME_MODES], description: '"speaker_track" if the active speaker moves in frame over the clip, otherwise "static".' },
        keyframes: {
          type: 'array',
          description: 'One or more crop keyframes. A "static" clip needs exactly one, at t=0. "speaker_track" needs one per point the framing should move.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['t', 'x', 'y', 'w', 'h'],
            properties: {
              t: num('Seconds from clip start.'),
              x: num('Crop left edge, normalized 0–1 of source width.'),
              y: num('Crop top edge, normalized 0–1 of source height.'),
              w: num('Crop width, normalized 0–1 of source width.'),
              h: num('Crop height, normalized 0–1 of source height.'),
            },
          },
        },
      },
    },
    captions: {
      type: 'array',
      description: 'Caption objects in on-screen order. May be empty for a clip with no on-screen text.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['t_in', 't_out', 'text', 'font', 'weight', 'size_px', 'x', 'y', 'safe_area'],
        properties: {
          t_in: num('Caption start, seconds from clip start.'),
          t_out: num('Caption end, seconds from clip start.'),
          text: str('The caption text, verbatim from the dialogue at this timestamp.'),
          font: str("The DNA's structured caption font. Copy it exactly — this is a hard constraint, not a style choice."),
          weight: num("The DNA's structured caption weight (e.g. 700). Copy it exactly."),
          size_px: num("The DNA's structured caption size in pixels. Copy it exactly."),
          x: num('Caption center, normalized 0–1 horizontal position within the safe area.'),
          y: num('Caption center, normalized 0–1 vertical position within the safe area.'),
          safe_area: str("The DNA's structured safe-area spec id. Copy it exactly — never invent or guess one."),
        },
      },
    },
    audio: {
      type: 'object',
      additionalProperties: false,
      required: ['target_lufs', 'normalize'],
      properties: {
        target_lufs: num("The DNA's structured target LUFS. Copy it exactly."),
        normalize: { type: 'boolean', description: 'Whether to normalize loudness to target_lufs. Default true unless the DNA brief says otherwise.' },
      },
    },
    render_target: { type: 'string', enum: [...RENDER_TARGETS], description: 'Always "premiere_uxp" in v1.' },
  },
} as const;

/** Everything the brain guarantees in code rather than trusting the model to self-enforce
 *  (technical design §2: "structured fields are hard constraints... code guarantees them"). */
export interface ValidateEdlResult {
  edl: Edl;
  /** Field paths the model got wrong that were force-corrected to the DNA's hard
   *  constraints, e.g. "captions[0].font", "aspect". Empty when the model complied
   *  fully. Surface this — a consistently non-empty list per asset type is itself a
   *  drift signal worth feeding into E12.4 once that's wired up. */
  repaired: string[];
}

/**
 * Validate a raw EDL against structural requirements and repair it against the DNA's
 * hard constraints (E12.1 Failure Modes: "repair if trivial ... else re-call once, else
 * flag"). Structural failures (missing/malformed required fields) return an error for
 * the caller to retry or flag; hard-constraint mismatches are repaired in place, never
 * rejected — the model is asked to honor them, code guarantees them.
 */
export function validateEdl(value: unknown, dna: DnaRecord): { ok: true; result: ValidateEdlResult } | { ok: false; error: string } {
  const v = value as Partial<Edl> | null | undefined;
  if (!v || typeof v !== 'object') return { ok: false, error: 'EDL is not an object' };
  if (typeof v.clip_id !== 'string' || !v.clip_id.trim()) return { ok: false, error: 'EDL is missing clip_id' };
  if (typeof v.source_uri !== 'string' || !v.source_uri.trim()) return { ok: false, error: 'EDL is missing source_uri' };
  if (typeof v.in !== 'number' || typeof v.out !== 'number' || !Number.isFinite(v.in) || !Number.isFinite(v.out)) {
    return { ok: false, error: 'EDL in/out must be numbers' };
  }
  if (v.out <= v.in) return { ok: false, error: `EDL out (${v.out}) must be greater than in (${v.in})` };
  if (!v.reframe || !REFRAME_MODES.includes(v.reframe.mode as ReframeMode) || !Array.isArray(v.reframe.keyframes)) {
    return { ok: false, error: 'EDL reframe is missing or malformed' };
  }
  if (v.reframe.keyframes.length === 0) return { ok: false, error: 'EDL reframe.keyframes is empty' };
  if (!Array.isArray(v.captions)) return { ok: false, error: 'EDL captions must be an array (may be empty)' };
  if (!v.audio || typeof v.audio.target_lufs !== 'number') return { ok: false, error: 'EDL audio.target_lufs is missing' };
  if (!RENDER_TARGETS.includes(v.render_target as RenderTarget)) return { ok: false, error: 'EDL render_target is missing or unrecognized' };

  const repaired: string[] = [];
  const { structuredFields } = dna;

  if (v.aspect !== structuredFields.aspectRatio) {
    repaired.push('aspect');
    v.aspect = structuredFields.aspectRatio;
  }

  const captions = v.captions.map((c, i) => {
    const fixed = { ...c };
    if (fixed.font !== structuredFields.captionFont) { repaired.push(`captions[${i}].font`); fixed.font = structuredFields.captionFont; }
    if (fixed.weight !== structuredFields.captionWeight) { repaired.push(`captions[${i}].weight`); fixed.weight = structuredFields.captionWeight; }
    if (fixed.size_px !== structuredFields.captionSizePx) { repaired.push(`captions[${i}].size_px`); fixed.size_px = structuredFields.captionSizePx; }
    if (fixed.safe_area !== structuredFields.safeAreaSpecId) { repaired.push(`captions[${i}].safe_area`); fixed.safe_area = structuredFields.safeAreaSpecId; }
    return fixed;
  });

  if (v.audio.target_lufs !== structuredFields.targetLufs) {
    repaired.push('audio.target_lufs');
    v.audio.target_lufs = structuredFields.targetLufs;
  }
  if (typeof v.audio.normalize !== 'boolean') v.audio.normalize = true;

  const edl: Edl = {
    clip_id: v.clip_id,
    source_uri: v.source_uri,
    in: v.in,
    out: v.out,
    aspect: v.aspect,
    reframe: v.reframe as Reframe,
    captions,
    audio: v.audio as AudioSpec,
    dna_version: dna.dnaVersion,
    render_target: v.render_target as RenderTarget,
  };

  return { ok: true, result: { edl, repaired } };
}
