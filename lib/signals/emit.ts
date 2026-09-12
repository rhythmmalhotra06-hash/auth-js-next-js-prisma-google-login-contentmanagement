// The Signal bus.
//
// Agents do not call each other. An agent writes a typed observation onto the node it
// concerns, with its evidence attached; other agents subscribe by kind, and every hop is
// visible in the thread the humans are already reading. No agent-to-agent RPC exists in this
// system, and none should: an invisible hand-off is one nobody can audit or argue with.
//
// The natural key is the whole safety mechanism. A check that runs daily would otherwise
// emit the same "shoot not filmed" fifteen times in a fortnight; instead a re-run updates the
// open Signal, and a Signal whose condition stops holding closes itself.

import { prisma } from '@/lib/prisma';

/** Deliberately closed [D120]. Adding one is a schema change, not a string. */
export const SIGNAL_KINDS = ['learning', 'anomaly', 'blocker', 'chore', 'watch', 'gap', 'suggestion'] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

export const AGENTS = ['video', 'social', 'email', 'production', 'design', 'planning'] as const;
export type AgentId = (typeof AGENTS)[number];

export const AGENT_LABEL: Record<AgentId, string> = {
  video: 'Video agent', social: 'Social agent', email: 'Email & VL channels agent',
  production: 'Production agent', design: 'Design agent', planning: 'Planning agent',
};

export interface SignalInput {
  agent: AgentId;
  /** Stable id of the rule that produced this. Part of the identity of the Signal. */
  checkId: string;
  kind: SignalKind;
  lane?: string | null;
  subjectType: 'ticket' | 'publication' | 'assetType' | 'commsDay' | 'shoot' | 'mediaSource' | 'account';
  subjectId: string;
  publicationId?: string | null;
  /** Bucket for periodic checks, e.g. '2026-W37'. Null when the check is not periodic. */
  period?: string | null;
  title: string;
  body: string;
  /** `{ refs, n, delta, cohort }`. A Signal without evidence is an opinion. */
  evidence?: Record<string, unknown> | null;
  /** Who should act. Never Vishen — his desk is the channel, he is not paged [D92]. */
  ownerHint?: string | null;
}

export interface EmitReport {
  created: number;
  updated: number;
  /** Conditions that stopped holding — closed as resolved-by-data, not deleted. */
  autoResolved: number;
  suppressed: number;
}

function keyOf(s: { agent: string; checkId: string; subjectType: string; subjectId: string; period?: string | null }): string {
  return [s.agent, s.checkId, s.subjectType, s.subjectId, s.period ?? ''].join('|');
}

/**
 * Write a check's full current output.
 *
 * The contract is *the complete set for this check*, not a delta — which is what lets a Signal
 * close itself: anything previously open under the same check that is absent from this run no
 * longer holds, so it resolves with `resolvedBy: 'data'`. Nothing is deleted; a Signal that
 * mattered last week remains readable in the thread it was written to.
 */
export async function emit(agent: AgentId, checkId: string, signals: SignalInput[]): Promise<EmitReport> {
  const report: EmitReport = { created: 0, updated: 0, autoResolved: 0, suppressed: 0 };
  const now = new Date();

  const existing = await prisma.signal.findMany({
    where: { agent, checkId, status: { in: ['open', 'acknowledged', 'dismissed'] } },
  });
  const byKey = new Map(existing.map((e) => [keyOf(e), e]));
  const seen = new Set<string>();

  for (const s of signals) {
    const key = keyOf(s);
    seen.add(key);
    const prior = byKey.get(key);

    // A dismissal is a decision with a shelf life: the same finding stays quiet for 30 days
    // and then earns the right to be raised again [D103].
    if (prior?.status === 'dismissed' && prior.suppressedUntil && prior.suppressedUntil > now) {
      report.suppressed++;
      continue;
    }

    const data = {
      kind: s.kind,
      lane: s.lane ?? null,
      publicationId: s.publicationId ?? null,
      title: s.title,
      body: s.body,
      evidence: (s.evidence ?? null) as never,
      ownerHint: s.ownerHint ?? null,
    };

    if (prior) {
      await prisma.signal.update({
        where: { id: prior.id },
        // A re-raised dismissal comes back open; an acknowledged one stays acknowledged.
        data: { ...data, status: prior.status === 'dismissed' ? 'open' : prior.status, dismissedReason: null, suppressedUntil: null },
      });
      report.updated++;
    } else {
      await prisma.signal.create({
        data: {
          agent, checkId, subjectType: s.subjectType, subjectId: s.subjectId,
          period: s.period ?? null, status: 'open', ...data,
        },
      });
      report.created++;
    }
  }

  for (const [key, e] of byKey) {
    if (seen.has(key) || e.status === 'dismissed') continue;
    await prisma.signal.update({
      where: { id: e.id },
      data: { status: 'resolved', resolvedBy: 'data', resolvedAt: now },
    });
    report.autoResolved++;
  }

  return report;
}

export async function openSignals(opts: { subjectType?: string; subjectId?: string; agent?: AgentId; limit?: number } = {}) {
  return prisma.signal.findMany({
    where: {
      status: { in: ['open', 'acknowledged'] },
      ...(opts.subjectType ? { subjectType: opts.subjectType } : {}),
      ...(opts.subjectId ? { subjectId: opts.subjectId } : {}),
      ...(opts.agent ? { agent: opts.agent } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: opts.limit ?? 50,
  });
}
