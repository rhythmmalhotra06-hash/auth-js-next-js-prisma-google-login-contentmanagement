// DNA review generation (E13.1 — text/metadata only; no video/frame access, that's E13.2).
// Composes the asset type's DNA baseline + learned rulebook + the ticket's brief/CTA/
// positioning/audience, plus a deterministic deliverable-completeness check, into one
// review. Best-effort: never throws — the automatic trigger must never block a status
// write, and a failed review is exactly the "missing review" case the decision lock
// already handles (fail-closed, with an override).

import { anthropic, REVIEW_MODEL, friendlyAnthropicError } from '@/lib/clipping/anthropic';
import { prisma } from '@/lib/prisma';
import { getDnaReviewConfig } from '@/lib/dna-review/config';
import { checkDeliverableCompleteness } from '@/lib/dna-review/deliverables';
import { createDnaReview, type DnaReviewWithFindings } from '@/lib/dna-review/repository';

type AnyParams = Record<string, unknown>;

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', description: 'One-sentence overview of how well the brief meets DNA' },
    findings: {
      type: 'array',
      // No `maxItems` — Anthropic's structured-output API rejects it on array schemas
      // ("property 'maxItems' is not supported"), discovered live testing this. Capped
      // via prompt instruction instead ("at most a handful... not exhaustive").
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          dimension: { type: 'string', enum: ['brief_compliance', 'wording'] },
          note: { type: 'string', description: 'The finding itself, one sentence, concrete' },
          severity: { type: 'string', enum: ['info', 'suggestion', 'flag'] },
          evidence: { type: 'string', description: 'Quoted excerpt from the brief/DNA text grounding this finding' },
        },
        required: ['dimension', 'note', 'severity', 'evidence'],
      },
    },
  },
  required: ['summary', 'findings'],
} as const;

interface LlmFinding {
  dimension: 'brief_compliance' | 'wording';
  note: string;
  severity: 'info' | 'suggestion' | 'flag';
  evidence: string;
}

const SYSTEM_PROMPT = [
  "You review a Creative Services ticket's brief against its asset type's DNA before a human",
  'approver looks. You ONLY have access to text — the brief, CTA, positioning, audience, the',
  "asset type's DNA baseline, and its learned rules. You do NOT have access to the actual video",
  'or design file. Never invent claims about visual composition, pacing, on-screen text, cuts,',
  'or timing — those require frame access this review does not have. You may only comment on',
  'whether the WRITTEN BRIEF meets the DNA requirements and wording standards. If the DNA',
  "requires something the brief is silent on, flag it as missing information, not as an assumed",
  'violation. Use severity "flag" only for a clear, DNA-stated requirement the brief plainly',
  'fails; "suggestion" for a soft improvement; "info" for a neutral observation. Every finding',
  'must quote the exact brief/DNA text it is grounded in as `evidence` — never assert something',
  'you cannot point to in the text. Produce at most a handful of the most important findings, not',
  'an exhaustive list.',
].join(' ');

function buildUserPrompt(args: {
  assetTypeName: string;
  baseline: string;
  ruleBullets: string[];
  title: string;
  creativeBrief: string | null;
  cta: string | null;
  positioning: string | null;
  audience: string | null;
  typeOfRequest: string | null;
}): string {
  const lines = [
    `Asset type: ${args.assetTypeName}`,
    '',
    'DNA baseline (requirements + feedback standards):',
    args.baseline,
    '',
    'Learned rules (from past approvals/reactions — always apply):',
    args.ruleBullets.length ? args.ruleBullets.map((r) => `- ${r}`).join('\n') : '(none yet)',
    '',
    `Ticket title: ${args.title}`,
    `Type of request: ${args.typeOfRequest ?? '(not set)'}`,
    `Creative brief: ${args.creativeBrief ?? '(blank)'}`,
    `Call to action: ${args.cta ?? '(blank)'}`,
    `Positioning: ${args.positioning ?? '(blank)'}`,
    `Audience: ${args.audience ?? '(blank)'}`,
  ];
  return lines.join('\n');
}

export interface RunDnaReviewResult {
  ok: boolean;
  reviewId?: string;
  error?: string;
}

export interface RunDnaReviewOptions {
  triggeredBy: 'status_change' | 'manual';
  requestedBy?: string | null;
}

/** Run a DNA review for a ticket. Best-effort — always resolves, never throws. */
export async function runDnaReview(ticketId: string, opts: RunDnaReviewOptions): Promise<RunDnaReviewResult> {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        title: true,
        creativeBrief: true,
        cta: true,
        positioning: true,
        audience: true,
        typeOfRequest: true,
        assetTypeId: true,
      },
    });
    if (!ticket) return { ok: false, error: 'Ticket not found' };

    // The deterministic check must survive an LLM failure — it's the one part of this
    // review that can't hallucinate, and per the PRD it should "ship even if nothing else
    // in Workstream A lands." So the Anthropic call gets its own try/catch, not the outer
    // one: a failed/misconfigured API key degrades to "deterministic findings only, AI
    // review unavailable" rather than losing the whole review.
    const deliverableFindings = await checkDeliverableCompleteness(ticketId);

    let llmFindings: LlmFinding[] = [];
    let summary: string | null = null;

    if (ticket.assetTypeId) {
      try {
        const config = await getDnaReviewConfig(ticket.assetTypeId);
        if (config) {
          const user = buildUserPrompt({
            assetTypeName: config.assetTypeName,
            baseline: config.baseline,
            ruleBullets: config.ruleBullets,
            title: ticket.title,
            creativeBrief: ticket.creativeBrief,
            cta: ticket.cta,
            positioning: ticket.positioning,
            audience: ticket.audience,
            typeOfRequest: ticket.typeOfRequest,
          });

          const resp = await anthropic.messages.create({
            model: REVIEW_MODEL,
            max_tokens: 1500,
            output_config: { format: { type: 'json_schema', schema: FINDINGS_SCHEMA } },
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: user }],
          } as AnyParams as never);

          const textBlock = (resp as { content: Array<{ type: string; text?: string }> }).content.find((b) => b.type === 'text');
          if (textBlock?.text) {
            const parsed = JSON.parse(textBlock.text) as { summary?: string; findings?: LlmFinding[] };
            summary = parsed.summary ?? null;
            llmFindings = (parsed.findings ?? []).filter((f) => f.note && f.dimension && f.severity);
          }
        }
      } catch (e) {
        const friendly = friendlyAnthropicError(e);
        console.error('[dna-review] LLM portion failed — falling back to deterministic findings only', e);
        summary = friendly ?? 'AI review unavailable this run — showing deliverable-completeness checks only.';
      }
    }

    const findings = [
      ...deliverableFindings.map((f) => ({ dimension: f.dimension, note: f.note, severity: f.severity, evidence: f.evidence })),
      ...llmFindings.map((f) => ({ dimension: f.dimension, note: f.note, severity: f.severity, evidence: f.evidence })),
    ];

    const review: DnaReviewWithFindings = await createDnaReview({
      ticketId,
      assetTypeId: ticket.assetTypeId,
      model: REVIEW_MODEL,
      summary,
      triggeredBy: opts.triggeredBy,
      requestedBy: opts.requestedBy ?? null,
      findings,
    });

    return { ok: true, reviewId: review.id };
  } catch (e) {
    const friendly = friendlyAnthropicError(e);
    const message = friendly ?? (e instanceof Error ? e.message : 'DNA review failed');
    console.error('[dna-review] runDnaReview failed', e);
    return { ok: false, error: message };
  }
}
