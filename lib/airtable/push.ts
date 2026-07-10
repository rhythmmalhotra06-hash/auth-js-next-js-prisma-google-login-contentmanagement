// Outbound drainer: Postgres → Airtable (the team's editing surface), generalized
// across domains. Writes enqueue an AirtableOutbox row (entity, entityId) in-transaction;
// this drainer pulls pending rows, groups them by (entity, entityId) so rapid successive
// edits collapse to one push, dispatches to the domain's PushHandler (push-registry.ts)
// to load CURRENT state + map fields, and creates/updates the target record. On success
// the handler stamps airtableId (new records) + airtablePushedAt (echo-suppression window
// for the pull). Gated by AIRTABLE_PUSH_ENABLED; paced + 429-backed-off by rest.ts.
// Trigger via POST /api/sync/push (Kessel internal cron).

import { prisma } from '@/lib/prisma';
import { createRecord, updateRecord } from './rest';
import { PUSH_HANDLERS } from './push-registry';

export interface DrainReport { enabled: boolean; scanned: number; pushed: number; failed: number; errors: string[] }

const pushEnabled = (): boolean => process.env.AIRTABLE_PUSH_ENABLED === 'true';

// A push that errored is retried automatically until it has failed this many times, then it's
// parked (avoids hammering a permanently-bad row while still recovering from transient failures).
const MAX_ATTEMPTS = 5;

export async function drainOutbox(limit = 100): Promise<DrainReport> {
  if (!pushEnabled()) return { enabled: false, scanned: 0, pushed: 0, failed: 0, errors: [] };

  // Drain pending rows AND error rows that haven't exhausted their retry budget, so a transient
  // failure (network blip, momentary 5xx) doesn't strand an edit forever.
  const rows = await prisma.airtableOutbox.findMany({
    where: { OR: [{ status: 'pending' }, { status: 'error', attempts: { lt: MAX_ATTEMPTS } }] },
    orderBy: { enqueuedAt: 'asc' },
    take: limit,
  });

  // Collapse rapid successive edits: one push per (entity, entityId) for its current
  // state. `entityId ?? ticketId` tolerates legacy pre-0012 rows (entity defaults to
  // 'ticket', entity_id null → fall back to the old ticket_id column).
  const groups = new Map<string, { entity: string; entityId: string; rowIds: string[] }>();
  const orphanRowIds: string[] = [];
  for (const r of rows) {
    const entity = r.entity || 'ticket';
    const entityId = r.entityId ?? (r.ticketId ?? null);
    if (!entityId) { orphanRowIds.push(r.id); continue; } // no id to act on → clear
    const key = `${entity}:${entityId}`;
    const g = groups.get(key) ?? { entity, entityId, rowIds: [] };
    g.rowIds.push(r.id);
    groups.set(key, g);
  }
  if (orphanRowIds.length) {
    await prisma.airtableOutbox.updateMany({ where: { id: { in: orphanRowIds } }, data: { status: 'error', lastError: 'no entityId', attempts: { increment: 1 } } });
  }

  let pushed = 0, failed = 0;
  const errors: string[] = [];

  // Each group is isolated in its own try/catch so one bad row (or a DB blip during stamp) can't
  // abort the whole drain batch and wedge the remaining groups.
  const markError = (rowIds: string[], msg: string) =>
    prisma.airtableOutbox.updateMany({ where: { id: { in: rowIds } }, data: { status: 'error', attempts: { increment: 1 }, lastError: msg.slice(0, 500) } });

  for (const { entity, entityId, rowIds } of groups.values()) {
    const handler = PUSH_HANDLERS[entity];
    if (!handler) {
      await markError(rowIds, `unknown entity: ${entity}`);
      errors.push(`${entity}:${entityId}: unknown entity`);
      failed++;
      continue;
    }

    try {
      const loaded = await handler.load(entityId);
      if (!loaded) {
        // Orphaned enqueue (row deleted) — clear so it doesn't wedge the queue.
        await prisma.airtableOutbox.updateMany({ where: { id: { in: rowIds } }, data: { status: 'done', processedAt: new Date() } });
        continue;
      }

      const res = loaded.recId
        ? await updateRecord(handler.baseId, handler.tableId, loaded.recId, loaded.fields)
        : await createRecord(handler.baseId, handler.tableId, loaded.fields);

      if (res.ok) {
        const recId = loaded.recId ?? res.data.id;
        // Stamp (airtableId + pushedAt + any one-shot consume) and mark the outbox rows done in ONE
        // transaction — either both land or neither, so a create's recId can't be lost (which would
        // re-create a duplicate on the next drain).
        await prisma.$transaction([
          ...handler.stampOps(entityId, recId),
          prisma.airtableOutbox.updateMany({ where: { id: { in: rowIds } }, data: { status: 'done', processedAt: new Date() } }),
        ]);
        pushed++;
      } else {
        await markError(rowIds, res.error.message);
        errors.push(`${entity}:${entityId}: ${res.error.message}`);
        failed++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await markError(rowIds, msg).catch(() => {});
      errors.push(`${entity}:${entityId}: ${msg}`);
      failed++;
    }
  }

  return { enabled: true, scanned: rows.length, pushed, failed, errors };
}
