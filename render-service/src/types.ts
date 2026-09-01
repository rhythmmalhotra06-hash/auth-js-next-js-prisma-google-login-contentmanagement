// Mirrors the Edl type in lib/auto-editing/schema.ts (main app). Duplicated rather than
// imported because this is a separate deployable package with its own dependency tree
// (Remotion) — no build-time link to the Next.js app. KEEP IN SYNC BY HAND; if the EDL
// contract changes there, change it here too. The brain (E12.1) is the source of truth.

export interface ReframeKeyframe {
  t: number; // seconds, relative to clip start
  x: number; // normalized 0–1 — used here as the object-position focus-point center
  y: number;
  w: number; // reserved for future finer-grained crop control — unused by this renderer (see EdlComposition)
  h: number;
}

export interface Reframe {
  mode: 'speaker_track' | 'static';
  keyframes: ReframeKeyframe[];
}

export interface Caption {
  t_in: number;
  t_out: number;
  text: string;
  font: string;
  weight: number;
  size_px: number;
  x: number; // normalized 0–1, caption CENTER position
  y: number;
  safe_area: string;
}

export interface AudioSpec {
  target_lufs: number;
  normalize: boolean;
}

export interface Edl {
  clip_id: string;
  source_uri: string; // any HTTPS-fetchable URL (Dropbox direct link, resolved YouTube source, etc.) — not GCS-specific (2026-09-01, see lib/auto-editing/schema.ts)
  in: number; // seconds
  out: number; // seconds
  aspect: string; // e.g. "9:16"
  reframe: Reframe;
  captions: Caption[];
  audio: AudioSpec;
  dna_version: string;
  render_target: 'remotion';
}
