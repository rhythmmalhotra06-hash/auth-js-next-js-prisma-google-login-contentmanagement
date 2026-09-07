// DNA review repository — Postgres-native (no Airtable mirror; this data cites Ticket/
// AssetType evidence that's already Postgres-primary). Three tables: DnaReviewRule (the
// learned rulebook), DnaReview (one review run), DnaReviewFinding (one finding in a run).
// See prd/content-production-management/dna-feedback/technical-design.md.

import { prisma } from '@/lib/prisma';
import type { DnaReview, DnaReviewFinding, DnaReviewRule } from '@/app/generated/prisma/client';

export type { DnaReview, DnaReviewFinding, DnaReviewRule };

export type DnaReviewWithFindings = DnaReview & { findings: DnaReviewFinding[] };

/** Active rules for an asset type, newest-weighted first — the composed rulebook. */
export async function getActiveDnaRules(assetTypeId: string): Promise<DnaReviewRule[]> {
  return prisma.dnaReviewRule.findMany({
    where: { assetTypeId, active: true },
    orderBy: [{ weight: 'desc' }, { createdAt: 'asc' }],
  });
}

/** All rules for an asset type (active + pending), for the Settings approval queue. */
export async function listDnaRulesForAssetType(assetTypeId: string): Promise<DnaReviewRule[]> {
  return prisma.dnaReviewRule.findMany({
    where: { assetTypeId },
    orderBy: [{ active: 'asc' }, { createdAt: 'desc' }],
  });
}

/** Batched version for a settings page rendering many asset types at once — one query,
 *  grouped by assetTypeId, instead of N. */
export async function listDnaRulesForAssetTypes(assetTypeIds: string[]): Promise<Map<string, DnaReviewRule[]>> {
  if (!assetTypeIds.length) return new Map();
  const rows = await prisma.dnaReviewRule.findMany({
    where: { assetTypeId: { in: assetTypeIds } },
    orderBy: [{ active: 'asc' }, { createdAt: 'desc' }],
  });
  const byAssetType = new Map<string, DnaReviewRule[]>();
  for (const r of rows) {
    const list = byAssetType.get(r.assetTypeId) ?? [];
    list.push(r);
    byAssetType.set(r.assetTypeId, list);
  }
  return byAssetType;
}

export interface CreateDnaRuleInput {
  assetTypeId: string;
  statement: string;
  rationale?: string | null;
  example?: string | null;
  weight?: number;
  confidence?: number;
  active?: boolean;
  source: 'tier1_decision' | 'tier1_reaction' | 'tier2_proposal' | 'manual';
  sourceTicketId?: string | null;
  note?: string | null;
  createdBy?: string | null;
}

export async function createDnaRule(input: CreateDnaRuleInput): Promise<DnaReviewRule> {
  return prisma.dnaReviewRule.create({
    data: {
      assetTypeId: input.assetTypeId,
      statement: input.statement.slice(0, 200),
      rationale: input.rationale ?? null,
      example: input.example ?? null,
      weight: input.weight ?? 3,
      confidence: input.confidence ?? 0.5,
      active: input.active ?? false,
      source: input.source,
      sourceTicketId: input.sourceTicketId ?? null,
      note: input.note ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    },
  });
}

export async function setDnaRuleActive(id: string, active: boolean, updatedBy: string | null): Promise<DnaReviewRule> {
  return prisma.dnaReviewRule.update({ where: { id }, data: { active, updatedBy } });
}

export async function dismissProposedDnaRule(id: string, updatedBy: string | null): Promise<DnaReviewRule> {
  return prisma.dnaReviewRule.update({
    where: { id },
    data: { active: false, note: 'Dismissed proposal', updatedBy },
  });
}

export interface CreateDnaReviewInput {
  ticketId: string;
  assetTypeId: string | null;
  model: string;
  summary?: string | null;
  triggeredBy: 'status_change' | 'manual';
  requestedBy?: string | null;
  findings: Array<{
    dimension: string;
    note: string;
    severity: 'info' | 'suggestion' | 'flag';
    evidence?: string | null;
    ruleId?: string | null;
  }>;
}

/** Write one review run + its findings in a single insert. */
export async function createDnaReview(input: CreateDnaReviewInput): Promise<DnaReviewWithFindings> {
  return prisma.dnaReview.create({
    data: {
      ticketId: input.ticketId,
      assetTypeId: input.assetTypeId,
      model: input.model,
      summary: input.summary ?? null,
      triggeredBy: input.triggeredBy,
      requestedBy: input.requestedBy ?? null,
      findings: {
        create: input.findings.map((f) => ({
          dimension: f.dimension,
          note: f.note,
          severity: f.severity,
          evidence: f.evidence ?? null,
          ruleId: f.ruleId ?? null,
        })),
      },
    },
    include: { findings: true },
  });
}

/** The most recent review for a ticket, with its findings. Null if none exists yet. */
export async function getLatestDnaReview(ticketId: string): Promise<DnaReviewWithFindings | null> {
  return prisma.dnaReview.findFirst({
    where: { ticketId },
    orderBy: { createdAt: 'desc' },
    include: { findings: true },
  });
}

/**
 * Gate check for updateTicketStatus() — does the ticket's latest review have an
 * undismissed flag, or does no review exist at all. Never throws; a DB error is treated
 * as "blocked" (fail-closed), matching the decision lock's own fail-closed principle.
 */
export async function checkDnaGate(ticketId: string): Promise<{ blocked: boolean; reason: 'flag' | 'missing_review' | null; review: DnaReviewWithFindings | null }> {
  try {
    const review = await getLatestDnaReview(ticketId);
    if (!review) return { blocked: true, reason: 'missing_review', review: null };
    const unmetFlag = review.findings.some((f) => f.severity === 'flag' && f.reaction == null);
    return { blocked: unmetFlag, reason: unmetFlag ? 'flag' : null, review };
  } catch (e) {
    console.error('[dna-review] checkDnaGate failed — failing closed', e);
    return { blocked: true, reason: 'missing_review', review: null };
  }
}

export interface DnaSignalRow {
  note: string | null;
  kind: 'override' | 'reaction_helpful' | 'reaction_not_helpful';
}

/** Aggregated Tier-2 signal for an asset type: override notes (from TicketEvent, tagged
 *  "DNA override: " by updateTicketStatus) + finding reactions with a note. */
export async function listDnaSignalsForAssetType(assetTypeId: string): Promise<DnaSignalRow[]> {
  const [overrides, reactions] = await Promise.all([
    prisma.ticketEvent.findMany({
      where: { toState: 'Approved', note: { startsWith: 'DNA override: ' }, ticket: { assetTypeId } },
      select: { note: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.dnaReviewFinding.findMany({
      where: {
        reaction: { in: ['helpful', 'not_helpful'] },
        reactionNote: { not: null },
        review: { assetTypeId },
      },
      select: { reaction: true, reactionNote: true },
      orderBy: { reactedAt: 'desc' },
      take: 50,
    }),
  ]);

  const rows: DnaSignalRow[] = overrides.map((o) => ({
    note: o.note?.replace(/^DNA override: /, '') ?? null,
    kind: 'override',
  }));
  for (const r of reactions) {
    rows.push({ note: r.reactionNote, kind: r.reaction === 'helpful' ? 'reaction_helpful' : 'reaction_not_helpful' });
  }
  return rows;
}

/** Set a finding's reaction. `dismissed` clears a flag for the gate; `helpful`/`not_helpful`
 *  is the Tier-1 learning signal. Permission for `dismissed` is checked by the caller. */
export async function setFindingReaction(
  findingId: string,
  reaction: 'helpful' | 'not_helpful' | 'dismissed',
  note: string | null,
  reactedBy: string | null,
): Promise<DnaReviewFinding> {
  return prisma.dnaReviewFinding.update({
    where: { id: findingId },
    data: { reaction, reactionNote: note, reactedBy, reactedAt: new Date() },
  });
}
