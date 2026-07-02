// Sync health — answers "is Airtable in step with Postgres?" for the admin surface.
// Reads the outbox depth (pending/error), the newest push + inbound-pull cursor, and
// the most recent failed pushes so drift is visible and debuggable.

import { prisma } from '@/lib/prisma';
import { TICKET_PULL_CURSOR } from '@/lib/airtable/pull';

export interface SyncErrorRow {
  ticketId: string;
  attempts: number;
  lastError: string | null;
  enqueuedAt: string;
}

export interface SyncHealth {
  pushEnabled: boolean;
  ticketsInPg: number;
  outboxPending: number;
  outboxError: number;
  lastPushedAt: string | null;
  pullCursor: string | null;
  pullCursorUpdatedAt: string | null;
  recentErrors: SyncErrorRow[];
}

export async function getSyncHealth(): Promise<SyncHealth> {
  const [outboxPending, outboxError, ticketsInPg, lastPushed, cursor, recentErrors] = await Promise.all([
    prisma.airtableOutbox.count({ where: { status: 'pending' } }),
    prisma.airtableOutbox.count({ where: { status: 'error' } }),
    prisma.ticket.count(),
    prisma.ticket.findFirst({ where: { airtablePushedAt: { not: null } }, orderBy: { airtablePushedAt: 'desc' }, select: { airtablePushedAt: true } }),
    prisma.syncState.findUnique({ where: { key: TICKET_PULL_CURSOR } }),
    prisma.airtableOutbox.findMany({
      where: { status: 'error' },
      orderBy: { enqueuedAt: 'desc' },
      take: 10,
      select: { ticketId: true, attempts: true, lastError: true, enqueuedAt: true },
    }),
  ]);

  return {
    pushEnabled: process.env.AIRTABLE_PUSH_ENABLED === 'true',
    ticketsInPg,
    outboxPending,
    outboxError,
    lastPushedAt: lastPushed?.airtablePushedAt?.toISOString() ?? null,
    pullCursor: cursor?.value ?? null,
    pullCursorUpdatedAt: cursor?.updatedAt.toISOString() ?? null,
    recentErrors: recentErrors.map((e) => ({
      ticketId: e.ticketId,
      attempts: e.attempts,
      lastError: e.lastError,
      enqueuedAt: e.enqueuedAt.toISOString(),
    })),
  };
}
