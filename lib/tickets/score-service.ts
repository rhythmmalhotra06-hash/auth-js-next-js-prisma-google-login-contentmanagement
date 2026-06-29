// Server-only scoring service: reads ticket inputs from the DB, applies the pure
// scoring function, and persists priority_score. Used by intake (score-on-create)
// and the manager board's recompute action.

import { prisma } from '@/lib/prisma';
import { scoreTicket } from '@/lib/tickets/scoring';
import { getScoringConfig, type ScoringConfig } from '@/lib/scoring-config/repository';

async function getMaxVariants(): Promise<number> {
  const rows = await prisma.assetType.findMany({ select: { _count: { select: { dimensions: true } } } });
  return Math.max(1, ...rows.map((r) => r._count.dimensions));
}

export async function scoreTicketById(ticketId: string, maxVariants?: number, now: Date = new Date(), cfg?: ScoringConfig): Promise<void> {
  const mv = maxVariants ?? (await getMaxVariants());
  const config = cfg ?? (await getScoringConfig());
  const t = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      dueDate: true,
      eventType: { select: { name: true } },
      assetType: { select: { name: true, _count: { select: { dimensions: true } } } },
    },
  });
  if (!t) return;
  const assetName = t.assetType?.name ?? null;
  const s = scoreTicket({
    dueDate: t.dueDate,
    eventTypeName: t.eventType?.name ?? null,
    variantCount: t.assetType?._count.dimensions ?? 0,
    maxVariants: mv,
    // Per-asset-type effort override from config (falls back to scoreTicket's default).
    effortNorm: assetName && assetName in config.effortByAssetType ? config.effortByAssetType[assetName] : undefined,
    now,
  }, config);
  await prisma.ticket.update({ where: { id: ticketId }, data: { priorityScore: s.priorityScore } });
}

export async function recomputeAllScores(): Promise<number> {
  const now = new Date();
  const [mv, cfg] = await Promise.all([getMaxVariants(), getScoringConfig()]);
  const tickets = await prisma.ticket.findMany({ select: { id: true } });
  for (const t of tickets) await scoreTicketById(t.id, mv, now, cfg);
  return tickets.length;
}
