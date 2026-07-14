// Timestamp helpers for the clipping engine. Transcripts flow through as text
// whose lines are prefixed with a [M:SS] / [H:MM:SS] marker (see transcript.ts +
// supadata.ts). These helpers parse those markers into a segment index and snap
// the model's returned timestamps to the nearest real segment boundary — the fix
// for AI-hallucinated timecodes that don't exist in the source video.

import type { Strategy } from '@/lib/clipping/schema';

export interface TranscriptSegment {
  seconds: number;
  text: string;
}

/** Format seconds as `M:SS` (<1h) or `H:MM:SS` (>=1h). */
export function secondsToLabel(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
}

/**
 * Parse a timestamp label into seconds. Accepts `SS`, `M:SS`, `MM:SS`,
 * `H:MM:SS`, `HH:MM:SS`, tolerating surrounding brackets/whitespace. Returns
 * null when the value isn't a recognizable clock.
 */
export function labelToSeconds(label: string | null | undefined): number | null {
  if (!label) return null;
  const cleaned = label.replace(/[[\]\s]/g, '');
  if (!cleaned || !/^\d{1,2}(:\d{1,2}){0,2}$/.test(cleaned)) return null;
  const parts = cleaned.split(':').map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return null;
  let seconds = 0;
  for (const p of parts) seconds = seconds * 60 + p;
  return seconds;
}

const LINE_MARKER = /^\s*\[\s*(\d{1,2}(?::\d{1,2}){1,2})\s*\]\s*(.*)$/;

/**
 * Build a time-ordered index of transcript segments from the `[ts] text` line
 * markers. Returns [] when the transcript carries no parseable timestamps (e.g.
 * a bare pasted transcript) — callers must treat an empty index as "no timing
 * available" and skip snapping.
 */
export function buildSegmentIndex(transcript: string): TranscriptSegment[] {
  const out: TranscriptSegment[] = [];
  for (const line of transcript.split('\n')) {
    const m = line.match(LINE_MARKER);
    if (!m) continue;
    const seconds = labelToSeconds(m[1]);
    if (seconds == null) continue;
    out.push({ seconds, text: m[2].trim() });
  }
  return out.sort((a, b) => a.seconds - b.seconds);
}

/** Nearest real segment start (in seconds) to a target, or null if index empty. */
function nearestSeconds(target: number, index: TranscriptSegment[]): number | null {
  if (!index.length) return null;
  let best = index[0].seconds;
  let bestDist = Math.abs(target - best);
  for (const seg of index) {
    const d = Math.abs(target - seg.seconds);
    if (d < bestDist) {
      best = seg.seconds;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Snap a single timestamp label to the nearest real segment boundary. Returns
 * the snapped `M:SS` label, or the original string unchanged when it can't be
 * parsed and the index can't help.
 */
function snapLabel(label: string, index: TranscriptSegment[]): { value: string; changed: boolean } {
  const secs = labelToSeconds(label);
  if (secs == null) return { value: label, changed: false };
  const snapped = nearestSeconds(secs, index);
  if (snapped == null) return { value: label, changed: false };
  const value = secondsToLabel(snapped);
  return { value, changed: value !== label.replace(/[[\]\s]/g, '') };
}

/**
 * Snap every timestamp the model produced (clip start/end, chapter markers, show
 * notes) to the nearest real transcript segment. Mutates the strategy in place and
 * returns how many values were corrected. No-op when the index is empty.
 */
export function snapStrategyTimestamps(strategy: Strategy, index: TranscriptSegment[]): { corrected: number } {
  if (!index.length) return { corrected: 0 };
  let corrected = 0;
  const apply = (obj: Record<string, string>, key: string) => {
    if (typeof obj[key] !== 'string') return;
    const { value, changed } = snapLabel(obj[key], index);
    obj[key] = value;
    if (changed) corrected++;
  };

  for (const clip of strategy.reelsClips ?? []) {
    apply(clip as unknown as Record<string, string>, 'timestampStart');
    apply(clip as unknown as Record<string, string>, 'timestampEnd');
  }
  for (const marker of strategy.youtubeHook?.chapterMarkers ?? []) {
    apply(marker as unknown as Record<string, string>, 'timestamp');
  }
  for (const note of strategy.showNotes?.timestamps ?? []) {
    apply(note as unknown as Record<string, string>, 'timestamp');
  }
  return { corrected };
}
