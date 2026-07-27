// Compose a human-readable brief block from a generated clip's Viral Clip Extractor
// fields. Used where structured columns aren't available (e.g. the Marketing Social
// board's free-text Notes field) so the richness still reaches the reviewer.

import type { ReelsClip } from '@/lib/clipping/schema';

/** The clip's display title: the ≤8-word Nuclear Hook Title, falling back to the hook line. */
export function clipTitle(c: Pick<ReelsClip, 'nuclearHookTitle' | 'hookLine'>): string {
  return (c.nuclearHookTitle || c.hookLine || '').trim();
}

/** Virality gates as a short "Controversy · Humour" string, or '' if none set. */
export function gatesLabel(
  c: Pick<ReelsClip, 'gateControversy' | 'gateUncommonKnowledge' | 'gateHumour'>,
): string {
  return [
    c.gateControversy && 'Controversy',
    c.gateUncommonKnowledge && 'Uncommon Knowledge',
    c.gateHumour && 'Humour',
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * A labelled multi-line notes block for boards that only have a free-text field.
 * Skips empty parts so it degrades gracefully on older/partial clips.
 */
export function composeClipNotes(c: ReelsClip): string {
  const parts: string[] = [];
  if (c.descriptiveTitle) parts.push(`About: ${c.descriptiveTitle}`);
  if (c.viralMechanism) parts.push(`Viral mechanism: ${c.viralMechanism}`);
  const gates = gatesLabel(c);
  if (gates) parts.push(`Virality gates: ${gates}`);
  if (c.rationale) parts.push(`Why this clips: ${c.rationale}`);
  if (c.coldOpen) parts.push(`Cold open (first 3s): ${c.coldOpen}`);
  if (c.editNotes) parts.push(`Edit notes: ${c.editNotes}`);
  if (c.verbatimExtract) parts.push(`Verbatim (word-for-word):\n${c.verbatimExtract}`);
  return parts.join('\n\n');
}
