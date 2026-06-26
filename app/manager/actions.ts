'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { recomputeAllScores } from '@/lib/tickets/score-service';
import { drainOutbox, type DrainReport } from '@/lib/airtable/push';
import { getEmployeeForSession } from '@/lib/employee';

export async function recomputePriority(): Promise<{ ok: boolean; scored: number }> {
  const scored = await recomputeAllScores();
  revalidatePath('/manager');
  revalidatePath('/tickets');
  revalidatePath('/editor');
  return { ok: true, scored };
}

// Manually drain the Airtable push outbox (portal → Airtable). The scheduled
// trigger (POST /api/sync/push) is blocked by IAP for external callers, so this
// gives managers an in-app, IAP-authenticated way to flush queued ticket writes.
// drainOutbox is a no-op unless AIRTABLE_PUSH_ENABLED=true.
export async function syncToAirtableNow(): Promise<DrainReport & { ok: boolean; error?: string }> {
  const me = await getEmployeeForSession();
  if (!me) return { ok: false, error: 'Not signed in', enabled: false, tickets: 0, created: 0, updated: 0, failed: 0 };
  try {
    const report = await drainOutbox();
    revalidatePath('/manager');
    return { ok: true, ...report };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Sync failed', enabled: true, tickets: 0, created: 0, updated: 0, failed: 0 };
  }
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
