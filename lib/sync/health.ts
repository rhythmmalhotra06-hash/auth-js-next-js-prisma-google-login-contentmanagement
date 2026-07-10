// Sync health — answers "is Airtable in step with Postgres?" for the admin surface.
// Reads the outbox depth (pending/error, broken down per domain), the newest push +
// inbound-pull cursors, and the most recent failed pushes so drift is visible.

import { prisma } from '@/lib/prisma';
import { PULL_RUNNERS } from '@/lib/airtable/pull-registry';
import { TICKET_PULL_CURSOR } from '@/lib/airtable/pull';

export interface SyncErrorRow {
  entity: string;
  entityId: string;
  attempts: number;
  lastError: string | null;
  enqueuedAt: string;
}

export interface EntityDepth { entity: string; pending: number; error: number }

export interface SyncHealth {
  pushEnabled: boolean;
  ticketsInPg: number;
  outboxPending: number;
  outboxError: number;
  outboxByEntity: EntityDepth[];
  lastPushedAt: string | null;
  pullCursor: string | null;
  pullCursorUpdatedAt: string | null;
  recentErrors: SyncErrorRow[];
}

export async function getSyncHealth(): Promise<SyncHealth> {
  const [outboxPending, outboxError, ticketsInPg, lastPushed, cursor, recentErrors, pendingGroups, errorGroups] = await Promise.all([
    prisma.airtableOutbox.count({ where: { status: 'pending' } }),
    prisma.airtableOutbox.count({ where: { status: 'error' } }),
    prisma.ticket.count(),
    prisma.ticket.findFirst({ where: { airtablePushedAt: { not: null } }, orderBy: { airtablePushedAt: 'desc' }, select: { airtablePushedAt: true } }),
    prisma.syncState.findUnique({ where: { key: TICKET_PULL_CURSOR } }),
    prisma.airtableOutbox.findMany({
      where: { status: 'error' },
      orderBy: { enqueuedAt: 'desc' },
      take: 10,
      select: { entity: true, entityId: true, ticketId: true, attempts: true, lastError: true, enqueuedAt: true },
    }),
    prisma.airtableOutbox.groupBy({ by: ['entity'], where: { status: 'pending' }, _count: { _all: true } }),
    prisma.airtableOutbox.groupBy({ by: ['entity'], where: { status: 'error' }, _count: { _all: true } }),
  ]);

  // Merge the per-entity pending/error counts into one row per domain.
  const byEntity = new Map<string, EntityDepth>();
  for (const g of pendingGroups) byEntity.set(g.entity, { entity: g.entity, pending: g._count._all, error: 0 });
  for (const g of errorGroups) {
    const row = byEntity.get(g.entity) ?? { entity: g.entity, pending: 0, error: 0 };
    row.error = g._count._all;
    byEntity.set(g.entity, row);
  }

  return {
    pushEnabled: process.env.AIRTABLE_PUSH_ENABLED === 'true',
    ticketsInPg,
    outboxPending,
    outboxError,
    outboxByEntity: [...byEntity.values()].sort((a, b) => a.entity.localeCompare(b.entity)),
    lastPushedAt: lastPushed?.airtablePushedAt?.toISOString() ?? null,
    pullCursor: cursor?.value ?? null,
    pullCursorUpdatedAt: cursor?.updatedAt.toISOString() ?? null,
    recentErrors: recentErrors.map((e) => ({
      entity: e.entity || 'ticket',
      entityId: e.entityId ?? (e.ticketId ?? '(unknown)'),
      attempts: e.attempts,
      lastError: e.lastError,
      enqueuedAt: e.enqueuedAt.toISOString(),
    })),
  };
}

/** Registered pull domains (for display / ops). */
export const PULL_ENTITIES = PULL_RUNNERS.map((r) => r.entity);
