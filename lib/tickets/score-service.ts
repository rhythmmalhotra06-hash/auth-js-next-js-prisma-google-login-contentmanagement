// Server-only scoring service: reads ticket inputs from the DB, applies the pure
// scoring function, and persists priority_score. Used by intake (score-on-create)
// and the manager board's recompute action.

import { prisma } from '@/lib/prisma';
import { scoreTicket } from '@/lib/tickets/scoring';

async function getMaxVariants(): Promise<number> {
  const rows = await prisma.assetType.findMany({ select: { _count: { select: { dimensions: true } } } });
  return Math.max(1, ...rows.map((r) => r._count.dimensions));
}

export async function scoreTicketById(ticketId: string, maxVariants?: number, now: Date = new Date()): Promise<void> {
  const mv = maxVariants ?? (await getMaxVariants());
  const t = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      dueDate: true,
      eventType: { select: { name: true } },
      assetType: { select: { _count: { select: { dimensions: true } } } },
    },
  });
  if (!t) return;
  const s = scoreTicket({
    dueDate: t.dueDate,
    eventTypeName: t.eventType?.name ?? null,
    variantCount: t.assetType?._count.dimensions ?? 0,
    maxVariants: mv,
    now,
  });
  await prisma.ticket.update({ where: { id: ticketId }, data: { priorityScore: s.priorityScore } });
}

export async function recomputeAllScores(): Promise<number> {
  const now = new Date();
  const mv = await getMaxVariants();
  const tickets = await prisma.ticket.findMany({ select: { id: true } });
  for (const t of tickets) await scoreTicketById(t.id, mv, now);
  return tickets.length;
}
