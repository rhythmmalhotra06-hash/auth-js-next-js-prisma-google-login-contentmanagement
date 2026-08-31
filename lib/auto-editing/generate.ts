// The EDL brain (E12.1) — one Claude call per clip, per technical design §2. Reuses
// the Anthropic client + error translation already set up for the clip engine
// (lib/clipping/anthropic.ts); only the model and prompt differ.

import { anthropic, friendlyAnthropicError } from '@/lib/clipping/anthropic';
import { EDL_SCHEMA, validateEdl, type Edl, type ValidateEdlResult } from './schema';
import { SYSTEM_PROMPT, buildUserMessage, type ClipInput, type ChannelTier } from './prompt';
import type { DnaRecord } from './dna';

// The PRD (written 2026-06-30) named `claude-sonnet-4-6`; that's since been superseded —
// this uses the current Sonnet. Re-evaluate if reasoning depth proves insufficient on
// hard reframes (E12.1 Open Questions).
const EDL_MODEL = 'claude-sonnet-5';

type AnyParams = Record<string, unknown>;

export interface GenerateEdlResult {
  edl: Edl;
  /** Hard-constraint fields the model got wrong and code force-corrected. See
   *  ValidateEdlResult — a persistently non-empty list per asset type is a drift
   *  signal worth wiring into E12.4. */
  repaired: string[];
  /** True if the first structured response was structurally malformed and this
   *  result came from the one retry (E12.1 Failure Modes: "re-call once, else flag"). */
  retried: boolean;
}

function parseEdlJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('The model did not return valid JSON.');
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

async function callOnce(userMessage: string): Promise<unknown> {
  let resp;
  try {
    resp = await anthropic.messages.create({
      model: EDL_MODEL,
      max_tokens: 4096,
      output_config: { format: { type: 'json_schema', schema: EDL_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    } as AnyParams as never);
  } catch (e) {
    const friendly = friendlyAnthropicError(e);
    throw friendly ? new Error(friendly) : e;
  }

  if (resp.stop_reason === 'refusal') {
    throw new Error('The model declined to generate an EDL for this clip.');
  }
  const textBlock = resp.content.find((b: { type: string }) => b.type === 'text') as { text: string } | undefined;
  if (!textBlock) throw new Error('No EDL content was returned by the model.');
  return parseEdlJson(textBlock.text);
}

/**
 * Generate one clip's EDL. One call per clip, never per source (technical design §2)
 * — pass only this clip's transcript slice, never the full transcript.
 *
 * On a structurally malformed response, retries once with the same input before
 * throwing — the caller (a future review-queue writer, per E12.4) is expected to flag
 * a thrown error rather than silently drop the clip.
 */
export async function generateEdl(clip: ClipInput, dna: DnaRecord, channel: ChannelTier): Promise<GenerateEdlResult> {
  if (!clip.transcriptSlice.trim()) throw new Error('Transcript slice is empty — nothing to generate an EDL from.');
  if (clip.outSec <= clip.inSec) throw new Error(`Clip out (${clip.outSec}) must be greater than in (${clip.inSec}).`);

  const userMessage = buildUserMessage(clip, dna, channel);

  const attempt = async (): Promise<{ ok: true; result: ValidateEdlResult } | { ok: false; error: string }> => {
    const parsed = await callOnce(userMessage);
    return validateEdl(parsed, dna);
  };

  const first = await attempt();
  if (first.ok) return { edl: first.result.edl, repaired: first.result.repaired, retried: false };

  console.warn(`[auto-editing] EDL for clip ${clip.clipId} failed validation (${first.error}) — retrying once.`);
  const second = await attempt();
  if (second.ok) return { edl: second.result.edl, repaired: second.result.repaired, retried: true };

  throw new Error(`EDL generation failed twice for clip ${clip.clipId}: ${second.error}`);
}
