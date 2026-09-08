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
import { extractFrames } from '@/lib/dna-review/frames';
import {
  resolveVideoSource,
  isAttemptableVideoLink,
  isSafePublicHttpUrl,
  VIDEO_SOURCE_FAILURE_MESSAGE,
  type VideoSourceFailureReason,
} from '@/lib/dna-review/video-source';

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

// ---------------------------------------------------------------------------
// E13.2 — Multimodal (frame-based) review. Opt-in, not automatic: materially more
// expensive/slower than the text-only path (a real video download + ffmpeg pass), so it's
// triggered by an explicit "Review with visuals" click, never the status-change trigger.
// ---------------------------------------------------------------------------

interface VisualLlmFinding {
  dimension: 'brief_compliance' | 'wording' | 'visual' | 'timing';
  note: string;
  severity: 'info' | 'suggestion' | 'flag';
  evidence: string;
  timestampMs?: number;
}

const VISUAL_FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', description: 'One-sentence overview of how well the video meets DNA' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          dimension: { type: 'string', enum: ['brief_compliance', 'wording', 'visual', 'timing'] },
          note: { type: 'string', description: 'The finding itself, one sentence, concrete' },
          severity: { type: 'string', enum: ['info', 'suggestion', 'flag'] },
          evidence: { type: 'string', description: 'Quoted brief/DNA text, OR a description of what the cited frame shows' },
          timestampMs: { type: 'integer', description: 'Set only for a visual/timing finding grounded in a specific frame — the timestamp of that frame in milliseconds' },
        },
        required: ['dimension', 'note', 'severity', 'evidence'],
      },
    },
  },
  required: ['summary', 'findings'],
} as const;

const VISUAL_SYSTEM_PROMPT = [
  "You review a Creative Services video ticket against its asset type's DNA before a human",
  'approver looks. You have the brief/DNA text AND a series of frames sampled evenly across',
  'the video, each labeled with its timestamp. Reference frames by their timestamp (mm:ss)',
  'when critiquing visual elements — composition, on-screen text legibility, cuts, pacing,',
  'hook timing. Never invent a visual detail not actually visible in the frames you were',
  'given — the frames are sparse samples, not every moment of the video, so do not claim',
  'certainty about anything between sampled frames. Use severity "flag" only for a clear,',
  'DNA-stated requirement plainly violated; "suggestion" for a soft improvement; "info" for a',
  'neutral observation. Keep `summary` to ONE short sentence — the findings are the substantive',
  'output, and a long summary wastes budget that should go to them. Produce at most a handful',
  'of the most important findings, not an exhaustive list.',
].join(' ');

/**
 * The ticket's delivery-link columns, fed to the resolver in lib/dna-review/video-source.ts.
 *
 * All four are FREE TEXT in Airtable, so the resolver — not this function — decides which
 * of the links they contain is actually downloadable. See that module's header for the
 * measured distribution; the short version is that taking the first non-empty field (what
 * this used to do) picked an undownloadable Dropbox folder, Replay page or Frame.io URL on
 * 44% of tickets, which surfaced as ffprobe's "moov atom not found".
 *
 * `assetFolderLink` is included per a33e581: as lib/tickets/write.airtable.ts notes on the
 * "asset ready" trigger, non-ads tickets have no ratio links, so the Asset Folder Link is
 * their delivery signal instead.
 */
async function ticketLinkFields(ticketId: string) {
  const t = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { final9x16: true, final16x9: true, final4x5: true, assetFolderLink: true },
  });
  return {
    final9x16: t?.final9x16 ?? null,
    final16x9: t?.final16x9 ?? null,
    final4x5: t?.final4x5 ?? null,
    assetFolderLink: t?.assetFolderLink ?? null,
  };
}

export interface RunVisualDnaReviewResult {
  ok: boolean;
  reviewId?: string;
  error?: string;
  /** Set when the failure is "we have no usable link", not "the review itself failed" —
   *  the ticket panel then offers its paste-a-direct-link box. */
  needsLink?: boolean;
  /** The resolver's typed reason, or render-service's structured code. */
  reason?: VideoSourceFailureReason | string;
  /** The best link we found but couldn't use, so the UI can name it. */
  detectedUrl?: string | null;
}

export interface RunVisualDnaReviewOptions {
  requestedBy?: string | null;
  /** Escape hatch: a direct video link supplied by the user, used instead of resolving the
   *  ticket's own fields. Still validated, and still recorded as the review's
   *  frameSourceUrl. */
  videoUrlOverride?: string | null;
}

/**
 * Opt-in visual review: extract frames via render-service, send them + the brief/DNA
 * context as a multimodal call, write a NEW DnaReview row (the review history is
 * immutable — each run is its own row, and the latest one is what the decision lock and
 * the ticket panel read). Best-effort — never throws.
 */
export async function runVisualDnaReview(
  ticketId: string,
  opts: RunVisualDnaReviewOptions = {},
): Promise<RunVisualDnaReviewResult> {
  const { requestedBy = null, videoUrlOverride = null } = opts;
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

    let videoUrl: string;
    const override = videoUrlOverride?.trim();
    if (override) {
      if (!isSafePublicHttpUrl(override)) {
        return {
          ok: false,
          needsLink: true,
          reason: 'not-a-url',
          error: 'Enter a full https:// link to a publicly reachable file.',
        };
      }
      if (!isAttemptableVideoLink(override)) {
        return {
          ok: false,
          needsLink: true,
          reason: 'unsupported-host',
          error:
            'That looks like a preview or review page rather than a file. Paste the link to the video FILE itself (a Dropbox .../scl/fi/... link, or any URL ending in .mp4).',
        };
      }
      videoUrl = override;
    } else {
      const resolved = resolveVideoSource(await ticketLinkFields(ticketId));
      if (!resolved.ok) {
        return {
          ok: false,
          needsLink: true,
          reason: resolved.reason,
          detectedUrl: resolved.sample,
          error: VIDEO_SOURCE_FAILURE_MESSAGE[resolved.reason](resolved.sample),
        };
      }
      videoUrl = resolved.chosen.url;
    }

    const frameResult = await extractFrames(videoUrl);
    if (!frameResult.ok || !frameResult.frames?.length) {
      return {
        ok: false,
        error: frameResult.error ?? 'Frame extraction returned no frames.',
        needsLink: frameResult.needsLink ?? false,
        reason: frameResult.code,
        detectedUrl: videoUrl,
      };
    }

    const deliverableFindings = await checkDeliverableCompleteness(ticketId);
    const config = ticket.assetTypeId ? await getDnaReviewConfig(ticket.assetTypeId) : null;

    const contextText = buildUserPrompt({
      assetTypeName: config?.assetTypeName ?? '(no asset type set)',
      baseline: config?.baseline ?? 'No DNA requirements or feedback standards have been written for this asset type yet.',
      ruleBullets: config?.ruleBullets ?? [],
      title: ticket.title,
      creativeBrief: ticket.creativeBrief,
      cta: ticket.cta,
      positioning: ticket.positioning,
      audience: ticket.audience,
      typeOfRequest: ticket.typeOfRequest,
    });

    const content: Array<Record<string, unknown>> = [
      { type: 'text', text: `${contextText}\n\nBelow are ${frameResult.frames.length} frames sampled evenly across the ${Math.round((frameResult.durationMs ?? 0) / 1000)}s video.` },
    ];
    for (const frame of frameResult.frames) {
      const mm = Math.floor(frame.timestampMs / 60000);
      const ss = Math.round((frame.timestampMs % 60000) / 1000).toString().padStart(2, '0');
      content.push({ type: 'text', text: `Frame at ${mm}:${ss}:` });
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: frame.base64 } });
    }

    let summary: string | null = null;
    let llmFindings: VisualLlmFinding[] = [];
    try {
      const resp = await anthropic.messages.create({
        model: REVIEW_MODEL,
        // A 60-frame review genuinely needs more budget than the text-only path — hit
        // stop_reason: 'max_tokens' at 2000 in testing, which the schema-constrained
        // decoder closes into valid-but-empty JSON rather than an error, so this failure
        // mode is silent unless caught explicitly (see the stop_reason check below).
        max_tokens: 4096,
        output_config: { format: { type: 'json_schema', schema: VISUAL_FINDINGS_SCHEMA } },
        system: VISUAL_SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
      } as AnyParams as never);

      const stopReason = (resp as { stop_reason?: string }).stop_reason;
      if (stopReason === 'max_tokens') {
        // Don't silently accept whatever partial-but-valid JSON the constrained decoder
        // closed with — this is a real failure (the review is incomplete), not a review
        // that legitimately found nothing.
        return { ok: false, error: 'Visual review ran out of response budget before finishing — try again or reduce frame count.' };
      }

      const textBlock = (resp as { content: Array<{ type: string; text?: string }> }).content.find((b) => b.type === 'text');
      if (textBlock?.text) {
        const parsed = JSON.parse(textBlock.text) as { summary?: string; findings?: VisualLlmFinding[] };
        summary = parsed.summary ?? null;
        llmFindings = (parsed.findings ?? []).filter((f) => f.note && f.dimension && f.severity);
      }
    } catch (e) {
      const friendly = friendlyAnthropicError(e);
      console.error('[dna-review] visual review LLM call failed', e);
      return { ok: false, error: friendly ?? (e instanceof Error ? e.message : 'Visual review failed') };
    }

    const findings = [
      ...deliverableFindings.map((f) => ({ dimension: f.dimension, note: f.note, severity: f.severity, evidence: f.evidence })),
      ...llmFindings.map((f) => ({ dimension: f.dimension, note: f.note, severity: f.severity, evidence: f.evidence, timestampMs: f.timestampMs })),
    ];

    const review = await createDnaReview({
      ticketId,
      assetTypeId: ticket.assetTypeId,
      model: REVIEW_MODEL,
      summary,
      triggeredBy: 'manual',
      requestedBy: requestedBy ?? null,
      usedFrames: true,
      frameSourceUrl: videoUrl,
      frameCount: frameResult.frames.length,
      findings,
    });

    return { ok: true, reviewId: review.id };
  } catch (e) {
    console.error('[dna-review] runVisualDnaReview failed', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Visual review failed' };
  }
}
