// DNA rule-learning — ports lib/clipping/learn.ts's proven two-tier shape:
//   - distillFeedbackToRule: one person's note (an override note, or a finding reaction)
//     → one generalizable DnaReviewRule
//   - proposeAssetTypeRules: aggregated signal (override notes + reactions across an
//     asset type's tickets) → up to 3 proposed rules, landed inactive
// Cheap model (DISTILL_MODEL). Schema kept flat and capped — see the "grammar too large"
// landmine noted in lib/clipping/schema.ts; do not let this schema grow past it.

import { anthropic, DISTILL_MODEL, friendlyAnthropicError } from '@/lib/clipping/anthropic';
import { getActiveDnaRules, createDnaRule } from '@/lib/dna-review/repository';

type AnyParams = Record<string, unknown>;

function parseJsonContent(final: { content: Array<{ type: string; text?: string }> }): unknown {
  const textBlock = final.content.find((b) => b.type === 'text');
  if (!textBlock?.text) throw new Error('No content returned by the model.');
  return JSON.parse(textBlock.text);
}

async function structured(system: string, user: string, schema: object): Promise<unknown> {
  try {
    const resp = await anthropic.messages.create({
      model: DISTILL_MODEL,
      max_tokens: 1000,
      output_config: { format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content: user }],
    } as AnyParams as never);
    return parseJsonContent(resp as { content: Array<{ type: string; text?: string }> });
  } catch (e) {
    const friendly = friendlyAnthropicError(e);
    if (friendly) throw new Error(friendly);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Tier 1 — distill one person's note into a durable rule
// ---------------------------------------------------------------------------

export interface DistilledDnaRule {
  skip: boolean;
  statement: string;
  rationale: string;
}

const DISTILL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    skip: { type: 'boolean', description: 'true if the note is one-off / episode-specific and not worth remembering' },
    statement: { type: 'string', description: 'ONE crisp, generalizable DNA rule, imperative, <200 chars (empty if skip)' },
    rationale: { type: 'string', description: 'Why this matters, in one sentence (empty if skip)' },
  },
  required: ['skip', 'statement', 'rationale'],
} as const;

/** Rewrite one person's raw note (an override note, or a finding reaction note) into a
 *  single reusable DNA rule for the given asset type. Won't restate an existing rule. */
export async function distillDnaFeedbackToRule(feedback: string, assetTypeId: string): Promise<DistilledDnaRule> {
  const existing = (await getActiveDnaRules(assetTypeId)).map((r) => r.statement);
  const system =
    'You maintain the learned DNA rulebook for a creative asset type. You convert a person’s ' +
    'free-form note about a ticket into at most ONE crisp, generalizable rule that would help ' +
    'future reviews of this asset type. Drop anything specific to this one ticket. If the note ' +
    'is purely one-off, not actionable as a general rule, or already covered by an existing ' +
    'rule, set skip=true. Keep the rule under 200 characters, imperative voice, no preamble.';
  const user = [
    'Existing rules (do not duplicate these):',
    existing.length ? existing.map((r) => `- ${r}`).join('\n') : '(none yet)',
    '',
    'Note to distill:',
    feedback.trim(),
  ].join('\n');

  const out = (await structured(system, user, DISTILL_SCHEMA)) as DistilledDnaRule;
  const statement = (out.statement ?? '').trim();
  return { skip: out.skip || !statement, statement, rationale: (out.rationale ?? '').trim() };
}

export interface RememberDnaResult {
  saved: boolean;
  rule?: string;
  skipped?: boolean;
  error?: string;
}

/** Distill and persist a note as a DnaReviewRule. Best-effort — never throws. */
export async function rememberDnaFeedbackAsLearning(args: {
  feedback: string;
  assetTypeId: string;
  active: boolean; // true for an override note (real decision authority), false for a finding reaction
  sourceTicketId?: string | null;
  source: 'tier1_decision' | 'tier1_reaction';
  createdBy: string | null;
}): Promise<RememberDnaResult> {
  const feedback = args.feedback?.trim();
  if (!feedback) return { saved: false };
  try {
    const distilled = await distillDnaFeedbackToRule(feedback, args.assetTypeId);
    if (distilled.skip || !distilled.statement) return { saved: false, skipped: true };

    await createDnaRule({
      assetTypeId: args.assetTypeId,
      statement: distilled.statement,
      rationale: distilled.rationale || undefined,
      active: args.active,
      source: args.source,
      sourceTicketId: args.sourceTicketId ?? undefined,
      note: `Learned from ${args.source === 'tier1_decision' ? 'an approval override note' : 'a finding reaction'}`,
      createdBy: args.createdBy,
    });
    return { saved: true, rule: distilled.statement };
  } catch (e) {
    return { saved: false, error: e instanceof Error ? e.message : 'Could not save learning.' };
  }
}

// ---------------------------------------------------------------------------
// Tier 2 — propose rules from aggregated signal
// ---------------------------------------------------------------------------

export interface DnaSignal {
  note: string | null; // an override note or reaction note
  kind: 'override' | 'reaction_helpful' | 'reaction_not_helpful';
}

export interface ProposedDnaRule {
  statement: string;
  rationale: string;
  evidence: string;
}

const PROPOSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    learnings: {
      type: 'array',
      // No `maxItems` — Anthropic's structured-output API rejects it on array schemas
      // (confirmed live, see generate.ts). Capped via prompt instruction ("at most 3")
      // and by slicing the result below, not schema enforcement.
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          statement: { type: 'string', description: 'ONE crisp, generalizable DNA rule, under 200 chars' },
          rationale: { type: 'string', description: 'Why this matters, one sentence' },
          evidence: { type: 'string', description: 'Short reason tying the rule to the observed signals' },
        },
        required: ['statement', 'rationale', 'evidence'],
      },
    },
  },
  required: ['learnings'],
} as const;

/** Propose up to 3 new DNA rules for an asset type from aggregated override/reaction
 *  signals. Returns [] on any failure or when there's nothing to learn from. */
export async function proposeAssetTypeRules(assetTypeId: string, signals: DnaSignal[]): Promise<ProposedDnaRule[]> {
  const withNotes = signals.filter((s) => s.note?.trim());
  if (!withNotes.length) return [];

  const existing = (await getActiveDnaRules(assetTypeId)).map((r) => r.statement);
  const fmt = (kind: DnaSignal['kind']) =>
    withNotes
      .filter((s) => s.kind === kind)
      .map((s) => `- "${s.note!.trim()}"`)
      .join('\n') || '(none)';

  const system =
    'You maintain the learned DNA rulebook for a creative asset type. From approval override ' +
    'notes and reactions to AI review findings, propose at most 3 NEW, generalizable rules that ' +
    'would improve future reviews. Each rule must be crisp (<200 chars), imperative, and NOT a ' +
    'restatement of an existing rule. Prefer patterns supported by multiple notes over one-offs.';
  const user = [
    'Approval override notes (someone approved past a blocked gate and explained why):',
    fmt('override'),
    '',
    'Findings marked helpful:',
    fmt('reaction_helpful'),
    '',
    'Findings marked not helpful:',
    fmt('reaction_not_helpful'),
    '',
    'Existing rules (do not duplicate):',
    existing.length ? existing.map((r) => `- ${r}`).join('\n') : '(none yet)',
  ].join('\n');

  try {
    const out = (await structured(system, user, PROPOSE_SCHEMA)) as { learnings?: ProposedDnaRule[] };
    return (out.learnings ?? [])
      .map((l) => ({
        statement: (l.statement ?? '').trim(),
        rationale: (l.rationale ?? '').trim(),
        evidence: (l.evidence ?? '').trim(),
      }))
      .filter((l) => l.statement)
      .slice(0, 3); // enforced here, not in the schema — see PROPOSE_SCHEMA's comment
  } catch {
    return [];
  }
}
