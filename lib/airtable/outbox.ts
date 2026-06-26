// Outbox enqueue for two-way ticket PUSH. Ticket writes drop a row here (cheap
// local INSERT) and a background drainer (push.ts) sends current state to Airtable.
//
// Gated by AIRTABLE_PUSH_ENABLED so this is a no-op until the 0006 migration is
// applied and a write-scoped Airtable token is set — that way the Phase 2 code can
// merge and deploy safely before the infra is ready (no enqueue → no table → no
// broken ticket writes).

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/app/generated/prisma/client';

export const PUSH_ENABLED = process.env.AIRTABLE_PUSH_ENABLED === 'true';

/**
 * Enqueue ops for use INSIDE a `prisma.$transaction([...])` array. Returns [] when
 * push is disabled, so it can be spread safely:
 *   prisma.$transaction([ ...writes, ...outboxPushOps(ticketId) ])
 */
export function outboxPushOps(ticketId: string): Prisma.PrismaPromise<unknown>[] {
  if (!PUSH_ENABLED) return [];
  return [prisma.airtableOutbox.create({ data: { ticketId, op: 'upsert' } })];
}

/** Standalone enqueue after a non-transactional write. Best-effort — never throws. */
export async function enqueueTicketPush(ticketId: string): Promise<void> {
  if (!PUSH_ENABLED) return;
  try {
    await prisma.airtableOutbox.create({ data: { ticketId, op: 'upsert' } });
  } catch (err) {
    console.error('[airtable] enqueue push failed for ticket', ticketId, err);
  }
}
