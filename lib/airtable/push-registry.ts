// Push registry — maps an outbox `entity` to how its current PG state is loaded and
// mapped to an Airtable record. The generalized drainer (push.ts) dispatches on this
// so every domain (tickets first; shoots/social/media next) shares one drain loop.
//
// To onboard a domain: add a PushHandler here (its base/table + load + stamp) and
// enqueue AirtableOutbox rows with that `entity`. No changes to push.ts needed.

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/app/generated/prisma/client';
import { TICKETS, SHOOTS, SOCIAL, VISHEN_VIDEOS } from './field-map';
import { ticketToAirtableFields, type TicketForPush } from './push-map';
import { shootToAirtableFields } from './shoot-push-map';
import { socialToAirtableFields } from './social-push-map';
import { vishenVideoToAirtableFields } from './vishen-video-push-map';

export interface LoadedPush {
  /** Current Airtable recId for this row, or null if it has never been pushed. */
  recId: string | null;
  /** The Airtable field payload to create/update with. */
  fields: Record<string, unknown>;
}

export interface PushHandler {
  baseId: string;
  tableId: string;
  /** Load current PG state by internal id → recId + Airtable fields; null if the row is gone. */
  load(id: string): Promise<LoadedPush | null>;
  /** Prisma write ops to run in the SAME transaction as the outbox mark-done (atomic): stamp
   *  airtableId + airtablePushedAt (echo-suppression window), plus any post-push state a domain
   *  needs to consume (e.g. shoots reset the one-shot newPrioTicket trigger). Not awaited here —
   *  the drainer composes them into one $transaction. */
  stampOps(id: string, recId: string): Prisma.PrismaPromise<unknown>[];
}

// ── Ticket handler (the original, unchanged behavior) ────────────────────────

// Relations the ticket push payload needs — each reference row's airtableId (recId).
const TICKET_PUSH_INCLUDE = {
  assignee: { select: { airtableId: true } },
  requester: { select: { airtableId: true } },
  eventType: { select: { airtableId: true } },
  assetType: { select: { airtableId: true } },
  officialCalendar: { select: { airtableId: true } },
  authors: { select: { author: { select: { airtableId: true } } } },
  shoots: { select: { shoot: { select: { airtableId: true } } } },
} as const;

type TicketPushRow = {
  airtableId: string | null;
  title: string | null;
  queueRank: number | null;
  projectProgram: string | null;
  creativeBrief: string | null;
  cta: string | null;
  dueDate: Date | null;
  prioStatus: string | null;
  ticketStatus: string | null;
  typeOfRequest: string | null;
  teamServiceLevel: string | null;
  notes: string | null;
  sourceLinks: string | null;
  downloadLink: string | null;
  assetFolderLink: string | null;
  workingFiles: string | null;
  final16x9: string | null;
  folder16x9: string | null;
  final9x16: string | null;
  folder9x16: string | null;
  final4x5: string | null;
  folder4x5: string | null;
  assignee: { airtableId: string | null } | null;
  requester: { airtableId: string | null } | null;
  eventType: { airtableId: string | null } | null;
  assetType: { airtableId: string | null } | null;
  officialCalendar: { airtableId: string | null } | null;
  authors: { author: { airtableId: string | null } | null }[];
  shoots: { shoot: { airtableId: string | null } | null }[];
};

function toTicketPush(t: TicketPushRow): TicketForPush {
  return {
    title: t.title,
    projectProgram: t.projectProgram,
    creativeBrief: t.creativeBrief,
    cta: t.cta,
    dueDate: t.dueDate,
    prioStatus: t.prioStatus,
    ticketStatus: t.ticketStatus,
    typeOfRequest: t.typeOfRequest,
    teamServiceLevel: t.teamServiceLevel,
    notes: t.notes,
    sourceLinks: t.sourceLinks,
    downloadLink: t.downloadLink,
    assetFolderLink: t.assetFolderLink,
    workingFiles: t.workingFiles,
    final16x9: t.final16x9,
    folder16x9: t.folder16x9,
    final9x16: t.final9x16,
    folder9x16: t.folder9x16,
    final4x5: t.final4x5,
    folder4x5: t.folder4x5,
    eventTypeAirtableId: t.eventType?.airtableId ?? null,
    assetTypeAirtableId: t.assetType?.airtableId ?? null,
    assigneeAirtableId: t.assignee?.airtableId ?? null,
    requesterAirtableId: t.requester?.airtableId ?? null,
    officialCalendarAirtableId: t.officialCalendar?.airtableId ?? null,
    authorAirtableIds: t.authors.map((a) => a.author?.airtableId).filter((x): x is string => !!x),
    shootAirtableIds: t.shoots.map((s) => s.shoot?.airtableId).filter((x): x is string => !!x),
    queueRank: t.queueRank,
  };
}

const ticketHandler: PushHandler = {
  baseId: TICKETS.baseId,
  tableId: TICKETS.tableId,
  async load(id) {
    const t = (await prisma.ticket.findUnique({
      where: { id },
      include: TICKET_PUSH_INCLUDE,
    })) as unknown as TicketPushRow | null;
    if (!t) return null;
    return { recId: t.airtableId, fields: ticketToAirtableFields(toTicketPush(t)) };
  },
  stampOps(id, recId) {
    return [prisma.ticket.update({ where: { id }, data: { airtableId: recId, airtablePushedAt: new Date() } })];
  },
};

// ── Shoot handler ────────────────────────────────────────────────────────────

const SHOOT_PUSH_SELECT = {
  airtableId: true, title: true, status: true, format: true, filmingDate: true, filmingLocation: true,
  brief: true, productionSupport: true, vishenApproved: true, priorityRanking: true, rawFiles: true,
  platforms: true, newPrioTicket: true, requestedById: true, authorIds: true, eventTypeIds: true,
  assetTypeIds: true, assetLibraryIds: true, ticketIds: true,
} as const;

const shootHandler: PushHandler = {
  baseId: SHOOTS.baseId,
  tableId: SHOOTS.tableId,
  async load(id) {
    const s = await prisma.shoot.findUnique({ where: { id }, select: SHOOT_PUSH_SELECT });
    if (!s) return null;
    const { airtableId, ...rest } = s;
    return { recId: airtableId, fields: shootToAirtableFields(rest) };
  },
  stampOps(id, recId) {
    // Reset newPrioTicket to false post-push: the checkbox is a ONE-SHOT trigger for the
    // Airtable "raise Prio ticket" automation. The push just delivered its current value; if we
    // left it true in PG, every later full-state push would re-check it and raise duplicate
    // tickets. Consuming it here (atomic with the outbox mark-done) makes it fire exactly once.
    return [prisma.shoot.update({ where: { id }, data: { airtableId: recId, airtablePushedAt: new Date(), newPrioTicket: false } })];
  },
};

// ── Social handler ───────────────────────────────────────────────────────────

const SOCIAL_PUSH_SELECT = {
  airtableId: true, title: true, notes: true, captions: true, status: true, clipSourceUrl: true,
  sourceTitle: true, viralityScore: true, timecode: true, creativeTicketId: true, officialCalId: true,
} as const;

const socialHandler: PushHandler = {
  baseId: SOCIAL.baseId,
  tableId: SOCIAL.tableId,
  async load(id) {
    const s = await prisma.socialPost.findUnique({ where: { id }, select: SOCIAL_PUSH_SELECT });
    if (!s) return null;
    const { airtableId, ...rest } = s;
    return { recId: airtableId, fields: socialToAirtableFields(rest) };
  },
  stampOps(id, recId) {
    return [prisma.socialPost.update({ where: { id }, data: { airtableId: recId, airtablePushedAt: new Date() } })];
  },
};

// ── Vishen Video handler (writes only approval/rating/views24h) ──────────────

const vishenVideoHandler: PushHandler = {
  baseId: VISHEN_VIDEOS.baseId,
  tableId: VISHEN_VIDEOS.tableId,
  async load(id) {
    const v = await prisma.vishenVideo.findUnique({ where: { id }, select: { airtableId: true, approval: true, rating: true, views24h: true } });
    if (!v) return null;
    const { airtableId, ...rest } = v;
    return { recId: airtableId, fields: vishenVideoToAirtableFields(rest) };
  },
  stampOps(id, recId) {
    return [prisma.vishenVideo.update({ where: { id }, data: { airtableId: recId, airtablePushedAt: new Date() } })];
  },
};

// ── Registry ─────────────────────────────────────────────────────────────────

export const PUSH_HANDLERS: Record<string, PushHandler> = {
  ticket: ticketHandler,
  shoot: shootHandler,
  social: socialHandler,
  vishenVideo: vishenVideoHandler,
};
