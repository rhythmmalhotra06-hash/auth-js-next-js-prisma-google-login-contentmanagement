// Learning helpers for the clip engine. Two small, structured LLM calls that turn
// raw signals into durable "learnings" (Clip Rules rows):
//   - distillFeedbackToRule: one editor's re-run feedback → one generalizable rule
//   - proposeLearnings: performance signals (ratings/feedback) → proposed rules
// Both keep the memory clean by rewriting noisy input into crisp, reusable rules and
// avoiding duplicates of what's already stored. Cheap model (DISTILL_MODEL).

import { anthropic, DISTILL_MODEL, friendlyAnthropicError } from '@/lib/clipping/anthropic';
import { CLIP_TYPES, PROPOSED_NOTE_PREFIX, type ClipType, type RuleScope } from '@/lib/clipping/clip-types';
import { listClipRules, createClipRule } from '@/lib/clip-rules/repository';

// Re-exported so server callers can keep importing it from the learning module.
export { PROPOSED_NOTE_PREFIX };

// Sections mirror the Airtable "Section" single-select (see field-map CLIP_RULES).
export const RULE_SECTIONS = ['General', 'Clips', 'Thumbnail', 'Titles', 'Distribution'] as const;
export type RuleSection = (typeof RULE_SECTIONS)[number];


// output_config is a newer surface; cast at the call site like generate.ts does.
type AnyParams = Record<string, unknown>;

function parseJsonContent(final: { content: Array<{ type: string }> }): unknown {
  const textBlock = final.content.find((b) => b.type === 'text') as { text: string } | undefined;
  if (!textBlock) throw new Error('No content returned by the model.');
  return JSON.parse(textBlock.text);
}

async function structured(system: string, user: string, schema: object): Promise<unknown> {
  try {
    const resp = await anthropic.messages.create({
      model: DISTILL_MODEL,
      max_tokens: 1500,
      output_config: { format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content: user }],
    } as AnyParams as never);
    return parseJsonContent(resp as { content: Array<{ type: string }> });
  } catch (e) {
    const friendly = friendlyAnthropicError(e);
    if (friendly) throw new Error(friendly);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Tier 1 — distill one editor's feedback into a durable rule
// ---------------------------------------------------------------------------

export interface DistilledRule {
  /** True when the feedback is one-off / episode-specific and NOT worth remembering. */
  skip: boolean;
  /** The generalizable rule text (empty when skip). */
  rule: string;
  section: RuleSection;
}

const DISTILL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    skip: { type: 'boolean', description: 'true if the feedback is one-off / episode-specific and not worth remembering' },
    rule: { type: 'string', description: 'ONE crisp, generalizable clip-generation rule (empty if skip)' },
    section: { type: 'string', enum: RULE_SECTIONS as unknown as string[] },
  },
  required: ['skip', 'rule', 'section'],
} as const;

/**
 * Rewrite raw editor feedback into a single reusable rule for the given clip type.
 * `existingRules` (current active rule texts) are passed so it won't restate one we
 * already have — in which case it returns { skip: true }.
 */
export async function distillFeedbackToRule(
  feedback: string,
  clipType: ClipType,
  existingRules: string[],
): Promise<DistilledRule> {
  const system =
    'You maintain the rule set for a viral-clip generation engine. You convert an editor’s ' +
    'free-form feedback about a clip run into at most ONE crisp, generalizable rule that would ' +
    'improve every future run. Drop anything specific to this episode, guest, or transcript. ' +
    'If the feedback is purely one-off, not actionable as a general rule, or already covered by ' +
    'an existing rule, set skip=true and leave rule empty. Keep the rule under 200 characters, ' +
    'imperative voice, no preamble. Pick the section it best belongs to.';
  const user = [
    `Clip type being generated: ${clipType}.`,
    '',
    'Existing rules (do not duplicate these):',
    existingRules.length ? existingRules.map((r) => `- ${r}`).join('\n') : '(none yet)',
    '',
    'Editor feedback to distill:',
    feedback.trim(),
  ].join('\n');

  const out = (await structured(system, user, DISTILL_SCHEMA)) as DistilledRule;
  const rule = (out.rule ?? '').trim();
  const section: RuleSection = RULE_SECTIONS.includes(out.section) ? out.section : 'General';
  return { skip: out.skip || !rule, rule, section };
}

/** Active rule texts, used as the "don't duplicate" context for the LLM. */
async function activeRuleTexts(): Promise<string[]> {
  const res = await listClipRules();
  if (!res.ok) return [];
  return res.data.filter((r) => r.active && r.kind === 'Rule' && r.content?.trim()).map((r) => r.content!.trim());
}

export interface RememberResult {
  saved: boolean;
  /** The distilled rule that was saved (present when saved). */
  rule?: string;
  /** True when the feedback was judged one-off / already-covered and nothing was saved. */
  skipped?: boolean;
  /** Present when persistence failed — non-blocking; generation still succeeds. */
  error?: string;
}

/**
 * Distill the editor's feedback and, unless it's one-off, persist it as an active
 * Clip Rule scoped to `scope`. Best-effort: never throws — returns a result the caller
 * can surface. Deliberately does NOT gate on admin (anyone who can re-run can teach);
 * every learning is attributed via `email` + a "Learned from clip feedback" note.
 */
export async function rememberFeedbackAsLearning(args: {
  feedback: string;
  clipType: ClipType;
  scope: RuleScope;
  email: string | null;
  date: string; // ISO — passed in (Date.now() unavailable in some runtimes)
}): Promise<RememberResult> {
  const feedback = args.feedback?.trim();
  if (!feedback) return { saved: false };
  try {
    const existing = await activeRuleTexts();
    const distilled = await distillFeedbackToRule(feedback, args.clipType, existing);
    if (distilled.skip || !distilled.rule) return { saved: false, skipped: true };

    const res = await createClipRule({
      name: distilled.rule.slice(0, 60),
      content: distilled.rule,
      clipType: args.scope,
      section: distilled.section,
      note: `Learned from clip feedback — ${args.date.slice(0, 10)}`,
      updatedBy: args.email ?? undefined,
    });
    if (!res.ok) return { saved: false, error: res.error.message };
    return { saved: true, rule: distilled.rule };
  } catch (e) {
    return { saved: false, error: e instanceof Error ? e.message : 'Could not save learning.' };
  }
}

// ---------------------------------------------------------------------------
// Tier 2 — propose learnings from performance signals
// ---------------------------------------------------------------------------

export interface ClipSignal {
  rating: number | null; // e.g. 1–5
  feedback: string | null;
  released: boolean;
}

export interface ProposedLearning {
  rule: string;
  section: RuleSection;
  clipType: RuleScope; // All | Reel | Stage Talk | Short
  evidence: string; // short justification tying the rule to the signals
}

const PROPOSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    learnings: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          rule: { type: 'string', description: 'ONE crisp, generalizable clip-generation rule, under 200 chars' },
          section: { type: 'string', enum: RULE_SECTIONS as unknown as string[] },
          clipType: { type: 'string', enum: ['All', ...CLIP_TYPES] as unknown as string[] },
          evidence: { type: 'string', description: 'Short reason tying the rule to the observed performance' },
        },
        required: ['rule', 'section', 'clipType', 'evidence'],
      },
    },
  },
  required: ['learnings'],
} as const;

/**
 * Given clips that performed well vs poorly (with their editor/audience feedback),
 * propose up to 3 generalizable learnings. Existing rule texts are passed so it won't
 * repeat what's already stored. Returns [] on any failure — callers treat it as best-effort.
 */
export async function proposeLearnings(
  highs: ClipSignal[],
  lows: ClipSignal[],
  existingRules: string[],
): Promise<ProposedLearning[]> {
  if (!highs.length && !lows.length) return [];

  const fmt = (s: ClipSignal[]) =>
    s
      .map((c) => `- rating=${c.rating ?? '?'}${c.released ? ', released' : ''}${c.feedback ? `, feedback: "${c.feedback.trim()}"` : ''}`)
      .join('\n') || '(none)';

  const system =
    'You maintain the rule set for a viral-clip generation engine. From observed clip ' +
    'performance and feedback, propose at most 3 NEW, generalizable rules that would make ' +
    'future clips perform better. Each rule must be crisp (<200 chars), imperative, and NOT a ' +
    'restatement of an existing rule. Prefer patterns supported by multiple clips over one-offs. ' +
    'Scope each rule to the clip type it applies to (or All).';
  const user = [
    'High-performing clips:',
    fmt(highs),
    '',
    'Low-performing clips:',
    fmt(lows),
    '',
    'Existing rules (do not duplicate):',
    existingRules.length ? existingRules.map((r) => `- ${r}`).join('\n') : '(none yet)',
  ].join('\n');

  try {
    const out = (await structured(system, user, PROPOSE_SCHEMA)) as { learnings?: ProposedLearning[] };
    return (out.learnings ?? [])
      .map((l) => ({
        rule: (l.rule ?? '').trim(),
        section: RULE_SECTIONS.includes(l.section) ? l.section : 'General',
        clipType: (['All', ...CLIP_TYPES] as string[]).includes(l.clipType) ? l.clipType : 'All',
        evidence: (l.evidence ?? '').trim(),
      }))
      .filter((l) => l.rule) as ProposedLearning[];
  } catch {
    return [];
  }
}
