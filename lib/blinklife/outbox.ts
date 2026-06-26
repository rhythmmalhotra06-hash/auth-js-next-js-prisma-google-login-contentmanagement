// Outbox enqueue for the BlinkLife editor-task push. Ticket writes drop a row here
// (cheap local INSERT) and a background drainer (push.ts) mirrors current ticket
// state into BlinkLife. Mirror of lib/airtable/outbox.ts.
//
// Gated by BLINKLIFE_ENABLED so this is a no-op until the 0007 migration is applied
// and BLINKLIFE_TOKEN is set — the integration can merge and deploy safely before
// the infra is ready (no enqueue → no broken ticket writes).

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/app/generated/prisma/client';
import { PUSH_ENABLED } from './identity';

export { PUSH_ENABLED };

/**
 * Enqueue ops for use INSIDE a `prisma.$transaction([...])` array. Returns [] when
 * push is disabled, so it can be spread alongside the Airtable outbox ops:
 *   prisma.$transaction([ ...writes, ...outboxPushOps(id), ...blinklifeOutboxOps(id) ])
 */
export function blinklifeOutboxOps(ticketId: string): Prisma.PrismaPromise<unknown>[] {
  if (!PUSH_ENABLED) return [];
  return [prisma.blinkLifeOutbox.create({ data: { ticketId, op: 'upsert' } })];
}

/** Standalone enqueue after a non-transactional write. Best-effort — never throws. */
export async function enqueueBlinklifePush(ticketId: string): Promise<void> {
  if (!PUSH_ENABLED) return;
  try {
    await prisma.blinkLifeOutbox.create({ data: { ticketId, op: 'upsert' } });
  } catch (err) {
    console.error('[blinklife] enqueue push failed for ticket', ticketId, err);
  }
}
