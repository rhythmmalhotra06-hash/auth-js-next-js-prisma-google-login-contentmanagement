import { anthropic, CLIP_MODEL, friendlyAnthropicError } from '@/lib/clipping/anthropic';
import { STRATEGY_SCHEMA, validateStrategy, type Strategy } from '@/lib/clipping/schema';
import { buildUserMessage, buildResearchPrompt, type GenerationContext } from '@/lib/clipping/prompt';
import { getClipEngineConfig } from '@/lib/clipping/config';
import { DEFAULT_CLIP_TYPE, type ClipType } from '@/lib/clipping/clip-types';
import { buildSegmentIndex, snapStrategyTimestamps } from '@/lib/clipping/timestamps';

export interface GenerateOptions {
  webSearch: boolean;
  /** Which content form to generate for — scopes which rules apply. Defaults to Reel. */
  clipType?: ClipType;
  /** Editor guidance for this run (e.g. from a re-run) — steers this generation only. */
  feedback?: string;
}

export interface GenerateResult {
  strategy: Strategy;
  usedWebSearch: boolean;
}

// web_search_20260209 / output_config are newer surfaces; cast at the call sites
// so the build doesn't hinge on exact SDK param typings (per claude-api guidance).
type AnyParams = Record<string, unknown>;

/**
 * True for the 400 the API returns when STRATEGY_SCHEMA compiles to a decoding
 * grammar bigger than structured outputs allows ("The compiled grammar is too
 * large..."). It is a request-validation failure, so it is fully deterministic —
 * retrying the same schema always fails, but retrying WITHOUT the schema works.
 */
function isGrammarTooLarge(e: unknown): boolean {
  const err = e as { status?: number; error?: { error?: { message?: string } }; message?: string };
  if (err?.status !== 400) return false;
  const raw = err.error?.error?.message ?? err.message ?? '';
  return /compiled grammar is too large/i.test(raw);
}

// Fallback-only: describe the contract in the prompt when we can't enforce it via
// output_config. Derived from STRATEGY_SCHEMA so the two can never drift apart.
const JSON_SHAPE_INSTRUCTION = `OUTPUT FORMAT — CRITICAL
Respond with a single JSON object and nothing else: no prose, no explanation, no markdown code fences.
It must conform exactly to this JSON Schema (every "required" field present, no extra fields):

${JSON.stringify(STRATEGY_SCHEMA)}`;

/**
 * Parse the model's JSON. Tolerates a ```json fence and surrounding prose, which the
 * model can add on the unconstrained fallback path (never on the structured path).
 */
function parseStrategyJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    // Last resort: take the outermost {...} span.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('The model did not return valid JSON.');
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

/**
 * Phase A — optional unstructured web-search turn. Best-effort: any failure
 * returns an empty research string rather than blocking generation. Kept in a
 * SEPARATE turn from the structured call (web search + output_config must not share a turn).
 */
async function research(ctx: GenerationContext, brandPillars: string): Promise<string> {
  try {
    const tools = [{ type: 'web_search_20260209', name: 'web_search' }];
    const messages: { role: 'user' | 'assistant'; content: unknown }[] = [
      { role: 'user', content: buildResearchPrompt(ctx, brandPillars) },
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

  // Editable prompt + rules from Airtable (cached; falls back to hardcoded constants).
  const { systemPrompt, brandPillars } = await getClipEngineConfig(opts.clipType ?? DEFAULT_CLIP_TYPE);

  const researchSummary = opts.webSearch ? await research(ctx, brandPillars) : '';
  const usedWebSearch = opts.webSearch && researchSummary.length > 0;

  const userMessage = buildUserMessage(transcript, ctx, researchSummary, brandPillars, opts.feedback ?? '');

  // `structured: false` drops output_config and asks for the JSON shape in the prompt
  // instead — the fallback path when the compiled grammar is over the size cap.
  const run = (structured: boolean) =>
    anthropic.messages.stream({
      model: CLIP_MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      ...(structured
        ? { output_config: { format: { type: 'json_schema', schema: STRATEGY_SCHEMA } } }
        : {}),
      system: structured ? systemPrompt : `${systemPrompt}\n\n${JSON_SHAPE_INSTRUCTION}`,
      messages: [{ role: 'user', content: userMessage }],
    } as AnyParams as never);

  // Wrapped so any Anthropic API failure (usage limit, rate limit, auth, 5xx)
  // surfaces as a clear sentence rather than a raw "400 {...}" SDK error.
  const final = await (async () => {
    try {
      return await run(true).finalMessage();
    } catch (e) {
      // Structured outputs compile STRATEGY_SCHEMA into a decoding grammar with a size
      // cap. Over it, the request is rejected before a single token is generated — so
      // retrying is free and the run still succeeds. validateStrategy is lenient by
      // design and normalizes whatever comes back. Warn loudly: hitting this means the
      // schema needs slimming again (see the header comment in schema.ts).
      if (isGrammarTooLarge(e)) {
        console.warn(
          '[clip-gen] STRATEGY_SCHEMA is over the structured-output grammar cap — ' +
            'retrying unconstrained. Slim the schema; do not leave this in place.',
        );
        try {
          return await run(false).finalMessage();
        } catch (e2) {
          const friendly2 = friendlyAnthropicError(e2);
          throw friendly2 ? new Error(friendly2) : e2;
        }
      }
      const friendly = friendlyAnthropicError(e);
      if (friendly) throw new Error(friendly);
      throw e;
    }
  })();

  if (final.stop_reason === 'refusal') {
    throw new Error('The model declined to generate a strategy for this transcript.');
  }

  const textBlock = final.content.find((b) => b.type === 'text') as { text: string } | undefined;
  if (!textBlock) throw new Error('No strategy content was returned by the model.');

  let parsed: unknown;
  try {
    parsed = parseStrategyJson(textBlock.text);
  } catch {
    throw new Error('The model did not return valid JSON.');
  }

  const v = validateStrategy(parsed);
  if (!v.ok) throw new Error(v.error);

  // Ground timestamps in the real video: snap any value the model returned to the
  // nearest actual transcript segment. No-op when the transcript carried no timing
  // (e.g. a bare pasted transcript) — the index is empty and values pass through.
  const index = buildSegmentIndex(transcript);
  if (index.length) {
    const { corrected } = snapStrategyTimestamps(v.strategy, index);
    if (corrected) console.log(`[clip-ts] snapped ${corrected} model timestamp(s) to nearest transcript segment`);
  }

  return { strategy: v.strategy, usedWebSearch };
}
