// System prompt for the EDL brain (E12.1). Kept frozen (no interpolated values) so
// the prompt cache stays warm — the clip window, DNA, and channel tier go in the user
// turn (see generate.ts), same split as lib/clipping/prompt.ts.

// What the v1 UXP executor (E12.2) can actually apply. Fidelity is an open question
// there (see uxp-executor.md Open Questions) — this describes the target capability,
// not a confirmed one, so the brain never emits something the executor can't render.
const RENDERER_CAPABILITIES =
  'The renderer is a UXP plugin inside Adobe Premiere. It can: apply crop keyframes ' +
  '("speaker_track" — one keyframe per point the framing should move — or "static" — ' +
  'exactly one keyframe at t=0); render text-overlay captions at a given position, font, ' +
  'weight and size; normalize audio to a target LUFS. It cannot do anything beyond that ' +
  '— no transitions, no color grading beyond loudness normalization, no B-roll insertion.';

/**
 * The per-clip field contract. CODE-OWNED — must stay in lockstep with EDL_SCHEMA
 * (lib/auto-editing/schema.ts). Appended to the system prompt last, same pattern as
 * CLIP_OUTPUT_CONTRACT in lib/clipping/prompt.ts.
 */
export const EDL_OUTPUT_CONTRACT = `── OUTPUT CONTRACT (fixed) ──
Return exactly one EDL object for the clip described in the user turn:
- clip_id / source_uri / in / out — copy verbatim from the input. Never invent a timestamp or id.
- aspect, and every caption's font/weight/size_px/safe_area, and audio.target_lufs — copy these
  EXACTLY from the DNA's structured fields given in the user turn. These are hard constraints,
  not style choices — code will overwrite anything you get wrong here, so getting them right the
  first time is what "first-pass acceptance" actually measures.
- reframe — choose "speaker_track" if the active speaker moves meaningfully in frame over the
  clip, otherwise "static" with one keyframe. Base crop position on where the speaker actually is
  in the source footage as best you can infer from the transcript's speaker/scene context; if you
  cannot infer it, default to a centered static crop rather than guessing motion.
- captions — one per spoken beat that should appear on screen, timed to the transcript slice.
  Text must be verbatim dialogue, not a paraphrase. May be empty for a clip better left clean.
- Follow the DNA's natural-language brief and gold reference only where the structured fields are
  silent (e.g. crop framing choices, whether to caption every line vs. only key lines) — never let
  them override a structured field.

Return your answer strictly in the required JSON structure. No prose, no explanation, no markdown
code fences.`;

const SYSTEM_PROMPT = `You are the execution half of a two-AI content pipeline. A separate system has
already chosen which moment of a longer recording to turn into a short vertical clip — timestamps,
hook, and rationale are given to you as already-decided. Your only job is to decide HOW to cut and
present that specific moment: the crop framing, the captions, and the audio treatment. You do not
choose what to cut, and you do not publish anything — you produce a machine-readable edit decision
that a human reviews before it ships.

${RENDERER_CAPABILITIES}

You never render video yourself. You output a structured Edit Decision List (EDL) that a
deterministic renderer applies exactly as specified — so precision matters more than creativity.
Where the DNA gives you a structured field (font, safe area, LUFS, aspect ratio), that is not a
suggestion: copy it exactly. Where the DNA only gives you a brief or a reference example, use your
judgment, but never let judgment override a structured field.

${EDL_OUTPUT_CONTRACT}`;

export interface ChannelTier {
  /** Vishen-owned destinations are high-risk — see E12.4's gate. Read from the
   *  destination channel directly, never inferred by a human. */
  tier: 'high_risk' | 'standard';
  channelName: string;
}

export interface ClipInput {
  clipId: string;
  sourceUri: string;
  /** Seconds, relative to the source. From E8's clip suggestion — never re-derived here. */
  inSec: number;
  outSec: number;
  /** Just this clip's window, never the full transcript (technical design §2). */
  transcriptSlice: string;
  /** E8's hook/rationale for this clip, if available — context only, not re-decided here. */
  hook?: string;
}

export function buildUserMessage(clip: ClipInput, dna: import('./dna').DnaRecord, channel: ChannelTier): string {
  const parts = [
    `SOURCE CLIP\nclip_id: ${clip.clipId}\nsource_uri: ${clip.sourceUri}\nin: ${clip.inSec}\nout: ${clip.outSec}`,
    clip.hook ? `\nHOOK / RATIONALE (from moment selection — context only, do not re-decide)\n${clip.hook}` : '',
    `\nTRANSCRIPT SLICE (this clip's window only)\n${clip.transcriptSlice.trim()}`,
    `\nDESTINATION CHANNEL\n${channel.channelName} (risk tier: ${channel.tier})`,
    `\nDNA — STRUCTURED FIELDS (hard constraints, copy exactly)\n${JSON.stringify(dna.structuredFields, null, 2)}`,
    `\nDNA — NATURAL-LANGUAGE BRIEF (fills gaps the structured fields don't cover)\n${dna.nlBrief}`,
    dna.goldReference ? `\nDNA — GOLD REFERENCE (style tiebreaker, only where fields and brief are silent)\n${dna.goldReference}` : '',
    `\nRender against dna_version: ${dna.dnaVersion}`,
  ];
  return parts.filter(Boolean).join('\n');
}

export { SYSTEM_PROMPT };
