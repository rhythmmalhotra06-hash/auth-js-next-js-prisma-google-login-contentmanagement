import { anthropic, CLIP_MODEL } from '@/lib/clipping/anthropic';
import { STRATEGY_SCHEMA, validateStrategy, type Strategy } from '@/lib/clipping/schema';
import { SYSTEM_PROMPT, buildUserMessage, buildResearchPrompt, type GenerationContext } from '@/lib/clipping/prompt';

export interface GenerateOptions {
  webSearch: boolean;
}

export interface GenerateResult {
  strategy: Strategy;
  usedWebSearch: boolean;
}

// web_search_20260209 / output_config are newer surfaces; cast at the call sites
// so the build doesn't hinge on exact SDK param typings (per claude-api guidance).
type AnyParams = Record<string, unknown>;

/**
 * Phase A — optional unstructured web-search turn. Best-effort: any failure
 * returns an empty research string rather than blocking generation. Kept in a
 * SEPARATE turn from the structured call (web search + output_config must not share a turn).
 */
async function research(ctx: GenerationContext): Promise<string> {
  try {
    const tools = [{ type: 'web_search_20260209', name: 'web_search' }];
    const messages: { role: 'user' | 'assistant'; content: unknown }[] = [
      { role: 'user', content: buildResearchPrompt(ctx) },
    ];
    let resp = await anthropic.messages.create({
      model: CLIP_MODEL,
      max_tokens: 4096,
      thinking: { type: 'adaptive' },
      tools,
      messages,
    } as AnyParams as never);

    let guard = 0;
    while (resp.stop_reason === 'pause_turn' && guard++ < 5) {
      messages.push({ role: 'assistant', content: resp.content });
      resp = await anthropic.messages.create({
        model: CLIP_MODEL,
        max_tokens: 4096,
        thinking: { type: 'adaptive' },
        tools,
        messages,
      } as AnyParams as never);
    }

    return resp.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('\n')
      .trim();
  } catch {
    return '';
  }
}

/**
 * Phase B — the structured-output call (streamed to avoid HTTP timeouts on the
 * long 10-section response). Returns the validated 10-section strategy.
 */
export async function generateStrategy(
  transcript: string,
  ctx: GenerationContext,
  opts: GenerateOptions,
): Promise<GenerateResult> {
  if (!transcript.trim()) throw new Error('Transcript is empty — nothing to generate from.');

  const researchSummary = opts.webSearch ? await research(ctx) : '';
  const usedWebSearch = opts.webSearch && researchSummary.length > 0;

  const stream = anthropic.messages.stream({
    model: CLIP_MODEL,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { format: { type: 'json_schema', schema: STRATEGY_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(transcript, ctx, researchSummary) }],
  } as AnyParams as never);

  const final = await stream.finalMessage();

  if (final.stop_reason === 'refusal') {
    throw new Error('The model declined to generate a strategy for this transcript.');
  }

  const textBlock = final.content.find((b) => b.type === 'text') as { text: string } | undefined;
  if (!textBlock) throw new Error('No strategy content was returned by the model.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new Error('The model did not return valid JSON.');
  }

  const v = validateStrategy(parsed);
  if (!v.ok) throw new Error(v.error);

  return { strategy: v.strategy, usedWebSearch };
}
