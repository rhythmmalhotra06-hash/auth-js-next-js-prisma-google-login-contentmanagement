// BlinkLife push: drain the editor-task outbox + generate the Vishen review +
// capture briefs as memories. Mirror of lib/airtable/push.ts (read current ticket
// state so rapid edits collapse to one push; idempotent via blinklife_refs;
// failed rows retry then park as 'error'). All entry points no-op when push is off.
//
// BlinkLife has no batch endpoint, so tasks go one at a time (the client paces +
// backs off). Triggered by POST /api/push/blinklife or scripts/push-blinklife.ts.

import { prisma } from '@/lib/prisma';
import { callTool } from './client';
import { PUSH_ENABLED, targetProjectName } from './identity';
import {
  ticketToTask,
  briefToMemoryContent,
  renderReviewPage,
  DONE_TICKET_STATUSES,
  SKIP_PRIO_STATUSES,
  SKIP_TICKET_STATUSES,
  type TicketForTask,
  type ShippedAsset,
} from './map';

const MAX_ATTEMPTS = 5;

export interface DrainReport {
  enabled: boolean;
  tickets: number;
  created: number;
  updated: number;
  completed: number;
  skipped: number;
  failed: number;
}

/** Best-effort extraction of a BlinkLife entity id from a tool result. */
function extractId(resp: unknown): string | null {
  if (resp && typeof resp === 'object') {
    const o = resp as Record<string, unknown>;
    for (const key of ['id', 'task', 'project', 'page', 'memory']) {
      const v = o[key];
      if (typeof v === 'string') return v;
      if (v && typeof v === 'object' && typeof (v as Record<string, unknown>).id === 'string') {
        return (v as Record<string, string>).id;
      }
    }
  }
  return null;
}

interface ProjectListing {
  projects?: { id: string; name: string }[];
}

/**
 * Resolve the shared "Content Production" project id, creating it on first run.
 * Cached in blinklife_refs (kind 'project', null ticket) so we never duplicate it.
 */
export async function ensureProject(): Promise<string> {
  const existing = await prisma.blinkLifeRef.findFirst({ where: { kind: 'project', ticketId: null } });
  if (existing) return existing.externalId;

  const name = targetProjectName();
  const listing = await callTool<ProjectListing>('list_projects', { search: name, limit: 50 });
  const found = listing?.projects?.find((p) => p.name === name);
  const projectId = found?.id ?? extractId(await callTool('create_project', {
    name,
    description: 'Content tickets mirrored from the Content Production & Management portal. Each task is one ticket; the editor is in the title.',
    color: 'azure',
  }));
  if (!projectId) throw new Error('BlinkLife: could not resolve or create the Content Production project');

  await prisma.blinkLifeRef.create({ data: { kind: 'project', ticketId: null, externalId: projectId } });
  return projectId;
}

async function loadTicketForTask(id: string): Promise<TicketForTask | null> {
  const t = await prisma.ticket.findUnique({
    where: { id },
    select: {
      id: true, title: true, creativeBrief: true, cta: true, dueDate: true,
      prioStatus: true, ticketStatus: true, queueRank: true, typeOfRequest: true,
      assignee: { select: { name: true } },
      eventType: { select: { name: true } },
      assetType: { select: { name: true } },
    },
  });
  if (!t) return null;
  return {
    id: t.id, title: t.title, creativeBrief: t.creativeBrief, cta: t.cta, dueDate: t.dueDate,
    prioStatus: t.prioStatus, queueRank: t.queueRank, typeOfRequest: t.typeOfRequest,
    assigneeName: t.assignee?.name ?? null,
    eventTypeName: t.eventType?.name ?? null,
    assetTypeName: t.assetType?.name ?? null,
  };
}

async function markDone(rowIds: string[], ticketId: string) {
  const now = new Date();
  await prisma.$transaction([
    prisma.blinkLifeOutbox.updateMany({ where: { id: { in: rowIds } }, data: { status: 'done', processedAt: now } }),
    prisma.ticket.update({ where: { id: ticketId }, data: { blinklifePushedAt: now } }),
  ]);
}

async function markFailed(rowIds: string[], err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  await prisma.blinkLifeOutbox.updateMany({
    where: { id: { in: rowIds }, attempts: { gte: MAX_ATTEMPTS - 1 } },
    data: { status: 'error', lastError: message, attempts: { increment: 1 } },
  });
  await prisma.blinkLifeOutbox.updateMany({
    where: { id: { in: rowIds }, status: 'pending' },
    data: { lastError: message, attempts: { increment: 1 } },
  });
}

/** Push one ticket's current state into BlinkLife (create / update / complete the task). */
async function pushTicket(ticketId: string, projectId: string): Promise<'created' | 'updated' | 'completed' | 'skipped'> {
  const t = await loadTicketForTask(ticketId);
  if (!t) return 'skipped'; // ticket deleted

  const ref = await prisma.blinkLifeRef.findUnique({ where: { kind_ticketId: { kind: 'ticket_task', ticketId } } });
  const status = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { ticketStatus: true } });
  const ticketStatus = status?.ticketStatus ?? null;

  // Finished work: close the task if we created one; nothing to do otherwise.
  if (ticketStatus && DONE_TICKET_STATUSES.has(ticketStatus)) {
    if (ref) {
      await callTool('complete_task', { id: ref.externalId });
      return 'completed';
    }
    return 'skipped';
  }

  // Not worth mirroring (unassigned new requests, rejected, won't-do).
  if ((t.prioStatus && SKIP_PRIO_STATUSES.has(t.prioStatus)) || (ticketStatus && SKIP_TICKET_STATUSES.has(ticketStatus))) {
    return 'skipped';
  }

  const payload = ticketToTask(t);
  if (ref) {
    await callTool('update_task', { id: ref.externalId, ...payload });
    return 'updated';
  }
  const created = await callTool('create_task', { project_id: projectId, ...payload });
  const taskId = extractId(created);
  if (!taskId) throw new Error('BlinkLife: create_task returned no id');
  await prisma.blinkLifeRef.create({ data: { kind: 'ticket_task', ticketId, externalId: taskId } });
  return 'created';
}

/** Drain pending editor-task pushes to BlinkLife. */
export async function drainBlinklifeOutbox(limit = 200): Promise<DrainReport> {
  const empty: DrainReport = { enabled: PUSH_ENABLED, tickets: 0, created: 0, updated: 0, completed: 0, skipped: 0, failed: 0 };
  if (!PUSH_ENABLED) return empty;

  const rows = await prisma.blinkLifeOutbox.findMany({
    where: { status: 'pending' },
    orderBy: { enqueuedAt: 'asc' },
    take: limit,
    select: { id: true, ticketId: true },
  });
  if (rows.length === 0) return { ...empty, enabled: true };

  // Collapse to distinct tickets; keep every row id so we resolve them together.
  const rowIdsByTicket = new Map<string, string[]>();
  for (const r of rows) {
    const list = rowIdsByTicket.get(r.ticketId) ?? [];
    list.push(r.id);
    rowIdsByTicket.set(r.ticketId, list);
  }

  const projectId = await ensureProject();
  const report: DrainReport = { ...empty, enabled: true, tickets: rowIdsByTicket.size };

  for (const [ticketId, rowIds] of rowIdsByTicket) {
    try {
      const outcome = await pushTicket(ticketId, projectId);
      report[outcome] += 1;
      await markDone(rowIds, ticketId);
    } catch (err) {
      report.failed += 1;
      await markFailed(rowIds, err);
    }
  }
  return report;
}

// ── Vishen weekly review ─────────────────────────────────────────────────────

const REVIEW_SLUG = 'content-review';

function mondayOf(now: Date): Date {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export interface ReviewReport {
  enabled: boolean;
  shipped: number;
  pageId: string | null;
  slug: string;
  action: 'created' | 'updated' | 'noop';
}

/** Build/refresh the rolling "Content Review" page from the last 7 days of shipped assets. */
export async function pushVishenReview(): Promise<ReviewReport> {
  if (!PUSH_ENABLED) return { enabled: false, shipped: 0, pageId: null, slug: REVIEW_SLUG, action: 'noop' };

  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const assets = await prisma.asset.findMany({
    where: { publishedAt: { gte: since } },
    orderBy: { publishedAt: 'desc' },
    select: {
      name: true, distributionUrl: true,
      ticket: { select: { title: true, assignee: { select: { name: true } }, assetType: { select: { name: true } } } },
      performance: { select: { metric: true, value: true } },
    },
  });

  const shipped: ShippedAsset[] = assets.map((a) => ({
    editor: a.ticket?.assignee?.name ?? 'Unassigned',
    title: a.ticket?.title ?? a.name ?? 'Untitled asset',
    assetType: a.ticket?.assetType?.name ?? null,
    distributionUrl: a.distributionUrl,
    metrics: a.performance.map((p) => ({ metric: p.metric, value: p.value != null ? String(p.value) : null })),
  }));

  const weekLabel = `Week of ${mondayOf(now).toISOString().slice(0, 10)}`;
  const content = renderReviewPage(weekLabel, shipped);

  const ref = await prisma.blinkLifeRef.findFirst({ where: { kind: 'vishen_review_page', ticketId: null } });
  if (ref) {
    await callTool('update_page', { id: ref.externalId, title: `Content Review — ${weekLabel}`, content });
    await prisma.blinkLifeRef.update({ where: { id: ref.id }, data: { syncedAt: now } });
    return { enabled: true, shipped: shipped.length, pageId: ref.externalId, slug: REVIEW_SLUG, action: 'updated' };
  }

  const page = await callTool('create_page', {
    title: `Content Review — ${weekLabel}`,
    slug: REVIEW_SLUG,
    content,
    visibility: 'PRIVATE',
  });
  const pageId = extractId(page);
  if (pageId) {
    await prisma.blinkLifeRef.create({ data: { kind: 'vishen_review_page', ticketId: null, externalId: pageId } });
  }
  return { enabled: true, shipped: shipped.length, pageId, slug: REVIEW_SLUG, action: 'created' };
}

// ── Brief → memory ───────────────────────────────────────────────────────────

/** Capture a ticket's brief into BlinkLife memory (best-effort, idempotent per ticket). */
export async function pushBriefMemory(ticketId: string): Promise<void> {
  if (!PUSH_ENABLED) return;
  try {
    const existing = await prisma.blinkLifeRef.findUnique({ where: { kind_ticketId: { kind: 'brief_memory', ticketId } } });
    if (existing) return; // briefs are captured once

    const t = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        title: true, creativeBrief: true, cta: true, positioning: true, audience: true,
        eventType: { select: { name: true } },
        assetType: { select: { name: true } },
      },
    });
    if (!t || !t.creativeBrief) return; // nothing worth capturing

    const content = briefToMemoryContent({
      title: t.title, creativeBrief: t.creativeBrief, cta: t.cta,
      positioning: t.positioning, audience: t.audience,
      eventTypeName: t.eventType?.name ?? null, assetTypeName: t.assetType?.name ?? null,
    });
    await callTool('import_profile', { content });
    // import_profile splits into many memories with no single id — record a sentinel
    // so we don't re-import this brief on the next push.
    await prisma.blinkLifeRef.create({ data: { kind: 'brief_memory', ticketId, externalId: 'imported' } });
  } catch (err) {
    console.error('[blinklife] brief memory capture failed for ticket', ticketId, err);
  }
}

/** Capture an approval decision into BlinkLife memory (best-effort). */
export async function pushDecisionMemory(
  ticketId: string,
  decision: 'approved' | 'changes_requested',
  feedback: string | null,
): Promise<void> {
  if (!PUSH_ENABLED) return;
  try {
    const t = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { title: true } });
    if (!t) return;
    const verb = decision === 'approved' ? 'approved' : 'requested changes on';
    const content = `Approval decision: ${verb} "${t.title}".${feedback ? ` Feedback: ${feedback}` : ''}`;
    await callTool('capture_conversation', {
      exchanges: [{ role: 'user', content }],
    });
  } catch (err) {
    console.error('[blinklife] decision memory capture failed for ticket', ticketId, err);
  }
}
