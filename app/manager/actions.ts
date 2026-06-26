'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { recomputeAllScores } from '@/lib/tickets/score-service';

export async function recomputePriority(): Promise<{ ok: boolean; scored: number }> {
  const scored = await recomputeAllScores();
  revalidatePath('/manager');
  revalidatePath('/tickets');
  revalidatePath('/editor');
  return { ok: true, scored };
}

// Persist the manager's manual queue order: queue_rank = position (1-based).
// queue_rank then overrides priority_score for display order across all views.
export async function setQueueOrder(orderedIds: string[]): Promise<{ ok: boolean }> {
  await prisma.$transaction(
    orderedIds.map((id, idx) => prisma.ticket.update({ where: { id }, data: { queueRank: idx + 1 } })),
  );
  revalidatePath('/manager');
  revalidatePath('/tickets');
  revalidatePath('/editor');
  return { ok: true };
}
