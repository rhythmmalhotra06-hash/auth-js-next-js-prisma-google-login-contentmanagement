// Queue/list data for the role views — POSTGRES-backed (system of record).
// The first five columns are mandated identical across ALL views: Title, Priority,
// Assigned, Ticket Status, Priority Status (CLAUDE.md §7).
//
// Tickets are mirrored from Airtable into Postgres (backfill + two-way sync), so
// reads are fast + relational here. Person/calendar IDS exposed to the UI stay as
// Airtable recIds (via each relation's airtableId) so recId-based filters that the
// rest of the app uses keep working across the Postgres cutover.

import { prisma } from '@/lib/prisma';
import { listActiveEmployeeRecords, listAllEmployeeRecords } from '@/lib/repositories/employee.repository';
import { listActiveContractorRecords } from '@/lib/repositories/contractor.repository';
import { cleanBrief } from '@/lib/tickets/brief';
import { dueProximityNorm, campaignProximityNorm, blendQueueScore, explainQueueScore, scoreNormFor, asDateCertainty, type ScoreRange } from '@/lib/tickets/scoring';
import { getScoringConfig } from '@/lib/scoring-config/repository';
import { toTimelineRow, type TicketTimelineRow } from '@/lib/tickets/timeline';

export interface QueueTicket {
  id: string;
  title: string;
  priorityScore: string | null;
  queueRank: number | null;
  assignee: string | null;
  /** The assignee is no longer on the roster — the credit stands, the person has left. */
  assigneeExTeam: boolean;
  ticketStatus: string | null;
  prioStatus: string | null;
  eventType: string | null;
  assetType: string | null;
  requester: string | null;
  requesterId: string | null;
  officialCalendar: string | null;
  officialCalendarId: string | null;
  typeOfRequest: string | null;
  dueDate: string | null;
  /** 'fixed' | 'target' | 'evergreen' — whether the due date can move. Null on legacy rows. */
  dateCertainty: string | null;
  /** Why this ticket ranks where it does, in plain language. Filled by the ranking pass. */
  scoreWhy?: string;
  folderUrl: string | null;
  /** Live performance metrics — not wired to a source yet (Clarisights/Amplitude). Undefined today. */
  perf?: { ctr: number; roas: number; views: string; series: number[] } | null;
}

export interface EmployeeOption { id: string; name: string; exTeam?: boolean }

/** An assignable person — Employee creatives + active Contractor/Freelancers. */
export interface AssigneeOption { id: string; name: string; group: 'Creatives' | 'Freelancers & contractors' }

// Active = everything except terminal states (matches the queue's domain, not a perf hack).
// Published means live on the destination channel (Instagram etc.) — more terminal than
// Done/Shipping, not a synonym of either (2026-09-01).
const ACTIVE_STATUSES_EXCLUDED = ['Done', "Won't Do", 'Published'];

// The relations every ticket read needs. Person/calendar rows carry airtableId so we
// can expose recIds to the UI. Asset-type carries the team-lead + dimension lookups.
const TICKET_INCLUDE = {
  assignee: { select: { name: true, airtableId: true, active: true } },
  requester: { select: { name: true, airtableId: true } },
  eventType: { select: { name: true } },
  assetType: {
    select: {
      name: true,
      teamLeads: { select: { employee: { select: { name: true } } } },
      dimensions: { select: { dimension: { select: { label: true } } } },
    },
  },
  officialCalendar: { select: { name: true, airtableId: true, startDate: true, endDate: true } },
} as const;

type TicketWithRelations = {
  id: string;
  title: string;
  priorityScore: unknown;
  queueRank: number | null;
  ticketStatus: string | null;
  prioStatus: string | null;
  typeOfRequest: string | null;
  dueDate: Date | null;
  dateCertainty: string | null;
  assetFolderLink: string | null;
  assignee: { name: string; airtableId: string | null; active: boolean } | null;
  assigneeName: string | null; // attribution snapshot; outlives the FK
  requester: { name: string; airtableId: string | null } | null;
  eventType: { name: string } | null;
  assetType: { name: string } | null;
  officialCalendar: { name: string; airtableId: string | null; startDate: Date | null; endDate: Date | null } | null;
};

const numOf = (v: unknown): number | null => {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(String(v));
  return Number.isNaN(n) ? null : n;
};
const isoDate = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);

/**
 * Who gets the credit. Prefers the live employee row; falls back to the `assignee_name`
 * snapshot so a ticket still names its creative even if the FK was lost (see
 * `prisma/migrations/0019_ticket_assignee_name`). `exTeam` is true once that person is off
 * the roster — the tag stays, it's just marked.
 */
function creditedTo(t: { assignee: { name: string; active: boolean } | null; assigneeName: string | null }): { name: string | null; exTeam: boolean } {
  if (t.assignee) return { name: t.assignee.name, exTeam: !t.assignee.active };
  return { name: t.assigneeName, exTeam: !!t.assigneeName };
}

/** Base QueueTicket (pre-blend); priorityScore filled by the ranking pass. */
function toQueueTicket(t: TicketWithRelations): QueueTicket & { rawScore: number | null; campaignWindow: { start: Date | null; end: Date | null } | null } {
  const credit = creditedTo(t);
  return {
    id: t.id,
    title: t.title || '(untitled)',
    priorityScore: null,
    queueRank: t.queueRank,
    assignee: credit.name,
    assigneeExTeam: credit.exTeam,
    ticketStatus: t.ticketStatus,
    prioStatus: t.prioStatus,
    eventType: t.eventType?.name ?? null,
    assetType: t.assetType?.name ?? null,
    requester: t.requester?.name ?? null,
    requesterId: t.requester?.airtableId ?? null,
    officialCalendar: t.officialCalendar?.name ?? null,
    officialCalendarId: t.officialCalendar?.airtableId ?? null,
    typeOfRequest: t.typeOfRequest,
    dueDate: isoDate(t.dueDate),
    dateCertainty: asDateCertainty(t.dateCertainty),
    folderUrl: t.assetFolderLink,
    rawScore: numOf(t.priorityScore),
    campaignWindow: t.officialCalendar ? { start: t.officialCalendar.startDate, end: t.officialCalendar.endDate } : null,
  };
}

/** Active employees for assignment pickers (Airtable recId → name). */
export async function getActiveEmployees(): Promise<EmployeeOption[]> {
  const rows = await listActiveEmployeeRecords();
  return rows.map((r) => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The assignment picker's full roster: current staff first, then ex-team members flagged.
 * Tickets often need crediting to whoever actually did the work even after they've left,
 * so the picker offers them — grouped apart, never mixed into the default choices.
 */
export async function getAssignableEmployees(): Promise<EmployeeOption[]> {
  const rows = await listAllEmployeeRecords(); // already active-first, then by name
  return rows.map((r) => ({ id: r.id, name: r.name, exTeam: !r.active }));
}

/**
 * The only people a ticket gets assigned to: Employee **creatives** plus active
 * **Contractor/Freelancers** — used by the assignee filter.
 */
export async function getEligibleAssignees(): Promise<AssigneeOption[]> {
  const [employees, contractors] = await Promise.all([
    listActiveEmployeeRecords(),
    listActiveContractorRecords(),
  ]);
  const creatives: AssigneeOption[] = employees
    .filter((e) => !!e.team || e.roles.includes('Editor') || e.roles.includes('Designer'))
    .map((e) => ({ id: e.id, name: e.name, group: 'Creatives' as const }));
  const freelancers: AssigneeOption[] = contractors
    .map((c) => ({ id: c.id, name: c.name, group: 'Freelancers & contractors' as const }));
  const byName = (a: AssigneeOption, b: AssigneeOption) => a.name.localeCompare(b.name);
  return [...creatives.sort(byName), ...freelancers.sort(byName)];
}

// Global min/max of the Airtable SCORE mirror, so a ticket's displayed priority is the
// same number on every surface (see scoreNormFor). Cached like the scoring config —
// the range only moves when SCORE inputs change, which a 5-minute lag covers fine.
const SCORE_RANGE_TTL_MS = 5 * 60_000;
let scoreRangeCache: { at: number; range: ScoreRange } | null = null;
let scoreRangeInFlight: Promise<ScoreRange> | null = null;

async function getScoreRange(): Promise<ScoreRange> {
  if (scoreRangeCache && Date.now() - scoreRangeCache.at < SCORE_RANGE_TTL_MS) return scoreRangeCache.range;
  if (scoreRangeInFlight) return scoreRangeInFlight;
  scoreRangeInFlight = (async () => {
    try {
      const agg = await prisma.ticket.aggregate({ _min: { priorityScore: true }, _max: { priorityScore: true } });
      const range = { min: numOf(agg._min.priorityScore) ?? 0, max: numOf(agg._max.priorityScore) ?? 0 };
      scoreRangeCache = { at: Date.now(), range };
      return range;
    } catch {
      // Never let a ranking read fail on this — a degenerate range just means the
      // deadline + campaign terms decide the order on their own.
      return { min: 0, max: 0 };
    } finally {
      scoreRangeInFlight = null;
    }
  })();
  return scoreRangeInFlight;
}

/**
 * Rank + shape a set of ticket rows into QueueTickets. E9.5 blend: normalize the
 * Airtable SCORE base against the global score range, layer app-side deadline +
 * campaign urgency, and display the blended 0–100. Manual queue_rank still wins.
 */
async function rankTickets(rows: TicketWithRelations[]): Promise<QueueTicket[]> {
  const [cfg, range] = await Promise.all([getScoringConfig(), getScoreRange()]);
  const base = rows.map(toQueueTicket);

  const now = new Date();
  const win = cfg.dueProximityWindowDays;
  const blendMax = 1 + cfg.weights.due + cfg.weights.campaign;

  const ranked = base.map((r) => {
    const scoreNorm = scoreNormFor(r.rawScore, range);
    const dueNorm = dueProximityNorm(r.dueDate ? new Date(r.dueDate) : null, now, win);
    const campaignNorm = r.campaignWindow ? campaignProximityNorm(r.campaignWindow.start, r.campaignWindow.end, now, win) : 0;
    const parts = { scoreNorm, dueNorm, campaignNorm, dateCertainty: r.dateCertainty, dueDate: r.dueDate };
    const blended = blendQueueScore(parts, cfg);
    return { row: r, blended, why: explainQueueScore(parts, cfg) };
  });

  ranked.sort((a, b) => {
    const ar = a.row.queueRank, br = b.row.queueRank;
    if (ar != null && br != null) return ar - br;
    if (ar != null) return -1;
    if (br != null) return 1;
    return b.blended - a.blended;
  });

  return ranked.map(({ row, blended, why }) => {
    const { rawScore: _s, campaignWindow: _w, ...rest } = row;
    return { ...rest, priorityScore: String(Math.round((blended / blendMax) * 100)), scoreWhy: why };
  });
}

export async function getQueueTickets(opts: { assigneeId?: string; includeCompleted?: boolean } = {}): Promise<QueueTicket[]> {
  const rows = (await prisma.ticket.findMany({
    where: {
      ...(opts.includeCompleted ? {} : { ticketStatus: { notIn: ACTIVE_STATUSES_EXCLUDED } }),
      // assigneeId here is an Airtable recId (from the UI); match via the relation.
      ...(opts.assigneeId ? { assignee: { airtableId: opts.assigneeId } } : {}),
    },
    include: TICKET_INCLUDE,
  })) as unknown as TicketWithRelations[];
  return rankTickets(rows);
}

/**
 * The newest shipped (Done) tickets, capped — for the founder overview.
 */
export async function getRecentShipped(limit = 12): Promise<QueueTicket[]> {
  const rows = (await prisma.ticket.findMany({
    where: { ticketStatus: 'Done' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: TICKET_INCLUDE,
  })) as unknown as TicketWithRelations[];
  return rankTickets(rows);
}

/**
 * The full archive of requests a person raised (every status). Matched by the
 * requester's Airtable recId (the id the app carries for employees).
 */
export async function getMyRequests(employee: { id: string; name: string }): Promise<QueueTicket[]> {
  if (!employee?.id) return [];
  const rows = (await prisma.ticket.findMany({
    where: { requester: { airtableId: employee.id } },
    orderBy: { createdAt: 'desc' },
    include: TICKET_INCLUDE,
  })) as unknown as TicketWithRelations[];
  return rankTickets(rows);
}

// ── Scoped requests view (E9.3) ──────────────────────────────────────────────

export type RequestScope = 'mine' | 'team' | 'campaign' | 'all';

export async function getRequestsForScope(
  employee: { id: string; name: string; team: string | null },
  scope: RequestScope,
  opts: { calendarId?: string } = {},
): Promise<QueueTicket[]> {
  switch (scope) {
    case 'team': {
      if (!employee.team) return [];
      const [active, emps] = await Promise.all([getQueueTickets(), listActiveEmployeeRecords()]);
      const teamOf = new Map(emps.map((e) => [e.id, e.team]));
      return active.filter((t) => !!t.requesterId && teamOf.get(t.requesterId) === employee.team);
    }
    case 'campaign': {
      if (!opts.calendarId) return [];
      const active = await getQueueTickets();
      return active.filter((t) => t.officialCalendarId === opts.calendarId);
    }
    case 'all':
      return getQueueTickets();
    case 'mine':
    default:
      return getMyRequests(employee);
  }
}

export interface TicketEventRow { id: string; fromState: string | null; toState: string; actor: string | null; note: string | null; createdAt: string }
export interface ApprovalRow { id: string; approver: string | null; state: string; feedback: string | null; decidedAt: string | null; createdAt: string }
export interface AssetRow { id: string; kind: string; fileUrl: string | null; distributionUrl: string | null; publishedAt: string | null; createdAt: string }

export interface TicketDetail {
  id: string;
  title: string;
  createdAt: string;
  creativeBrief: string | null;
  cta: string | null;
  dueDate: string | null;
  ticketStatus: string | null;
  prioStatus: string | null;
  typeOfRequest: string | null;
  teamServiceLevel: string | null;
  team: string | null;
  project: string | null;
  dimensions: string | null;
  teamLead: string | null;
  queueRank: number | null;
  folderUrl: string | null;
  sourceLinks: string | null;
  downloadLink: string | null;
  isAds: boolean;
  assetFolderLink: string | null;
  workingFiles: string | null;
  final16x9: string | null;
  folder16x9: string | null;
  final9x16: string | null;
  folder9x16: string | null;
  final4x5: string | null;
  folder4x5: string | null;
  notes: string | null;
  priorityScore: string | null;
  eventType: string | null;
  assetType: string | null;
  /** PG uuid of the asset type — needed to load its DNA server-side (the name isn't a key). */
  assetTypeId: string | null;
  requester: string | null;
  requesterId: string | null;
  assignee: string | null;
  assigneeId: string | null;
  /** The credited creative has left — the tag stands, it's just marked. */
  assigneeExTeam: boolean;
  officialCalendar: string | null;
  authors: string[];
  events: TicketEventRow[];
  approvals: ApprovalRow[];
  assets: AssetRow[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getTicketDetail(id: string): Promise<TicketDetail | null> {
  // Accept our PG uuid (the id the queue now emits) or an Airtable recId (old links).
  const where = UUID_RE.test(id) ? { id } : { airtableId: id };
  const t = await prisma.ticket.findFirst({
    where,
    include: {
      assignee: { select: { name: true, airtableId: true, active: true } },
      requester: { select: { name: true, airtableId: true } },
      eventType: { select: { name: true } },
      assetType: {
        select: {
          name: true,
          teamLeads: { select: { employee: { select: { name: true } } } },
          dimensions: { select: { dimension: { select: { label: true } } } },
        },
      },
      officialCalendar: { select: { name: true } },
      authors: { select: { author: { select: { name: true } } } },
      events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { name: true } } } },
      approvals: { orderBy: { createdAt: 'asc' }, include: { approver: { select: { name: true } } } },
    },
  });
  if (!t) return null;

  // Assets are collapsed onto the delivery-link columns (raw / final / folder).
  const assets: AssetRow[] = [];
  const createdAt = t.createdAt.toISOString();
  const pushAsset = (kind: string, url: string | null) => {
    const u = url && url.trim() ? url.trim() : null;
    if (u) assets.push({ id: `${t.id}:${kind}`, kind, fileUrl: u, distributionUrl: null, publishedAt: null, createdAt });
  };
  pushAsset('raw', t.sourceLinks);
  pushAsset('final', t.final16x9);
  pushAsset('final', t.final9x16);
  pushAsset('final', t.final4x5);
  pushAsset('folder', t.assetFolderLink);

  const teamServiceLevel = t.teamServiceLevel;
  // TODO(ads-signal): STALE. The "Team/Service Level" field no longer has an "ad" option
  // (video options are now "Video Team - Non/Campaign"), so this always returns false and
  // ad tickets lose their per-ratio delivery fields on the Postgres backend. The reliable
  // signal is creativeServiceType, but it isn't synced to a discrete column yet — add that
  // column + sync, then key isAds off it (the Airtable path already does).
  const isAds = (teamServiceLevel ?? '').toLowerCase().includes('ad');

  const teamLead = t.assetType?.teamLeads?.map((tl) => tl.employee?.name).filter(Boolean).join(', ') || null;
  const dimensions = t.assetType?.dimensions?.map((d) => d.dimension?.label).filter(Boolean).join(', ') || null;
  const credit = creditedTo(t);

  return {
    id: t.id,
    title: t.title || '(untitled)',
    createdAt,
    creativeBrief: cleanBrief(t.creativeBrief),
    cta: t.cta,
    dueDate: isoDate(t.dueDate),
    ticketStatus: t.ticketStatus,
    prioStatus: t.prioStatus,
    typeOfRequest: t.typeOfRequest,
    teamServiceLevel,
    // creativeServiceType isn't stored discretely; teamServiceLevel is the closest signal.
    team: teamServiceLevel,
    isAds,
    assetFolderLink: t.assetFolderLink,
    workingFiles: t.workingFiles,
    final16x9: t.final16x9,
    folder16x9: t.folder16x9,
    final9x16: t.final9x16,
    folder9x16: t.folder9x16,
    final4x5: t.final4x5,
    folder4x5: t.folder4x5,
    project: t.projectProgram,
    dimensions,
    teamLead,
    queueRank: t.queueRank,
    folderUrl: t.assetFolderLink,
    sourceLinks: t.sourceLinks,
    downloadLink: t.downloadLink,
    notes: cleanBrief(t.notes),
    priorityScore: t.priorityScore != null ? String(t.priorityScore) : null,
    eventType: t.eventType?.name ?? null,
    assetType: t.assetType?.name ?? null,
    assetTypeId: t.assetTypeId ?? null,
    requester: t.requester?.name ?? null,
    requesterId: t.requester?.airtableId ?? null,
    assignee: credit.name,
    assigneeId: t.assignee?.airtableId ?? null,
    assigneeExTeam: credit.exTeam,
    officialCalendar: t.officialCalendar?.name ?? null,
    authors: t.authors.map((a) => a.author?.name).filter((n): n is string => !!n),
    events: t.events.map((e) => ({
      id: e.id, fromState: e.fromState, toState: e.toState, actor: e.actor?.name ?? null, note: e.note, createdAt: e.createdAt.toISOString(),
    })),
    approvals: t.approvals.map((a) => ({
      id: a.id, approver: a.approver?.name ?? null, state: a.state, feedback: a.feedback, decidedAt: a.decidedAt?.toISOString() ?? null, createdAt: a.createdAt.toISOString(),
    })),
    assets,
  };
}

// Recently-completed tickets counted toward the timeline averages — capped the same way
// getRecentShipped() is, so this never scans the ~9k Done history.
const RECENT_COMPLETED_LIMIT = 150;

const TIMELINE_INCLUDE = {
  eventType: { select: { name: true } },
  events: { orderBy: { createdAt: 'asc' as const }, include: { actor: { select: { name: true } } } },
};

type TicketWithTimelineRelations = {
  id: string;
  title: string;
  ticketStatus: string | null;
  createdAt: Date;
  eventType: { name: string } | null;
  events: { toState: string; createdAt: Date; note: string | null; actor: { name: string } | null }[];
};

function toTicketTimelineRow(t: TicketWithTimelineRelations): TicketTimelineRow | null {
  return toTimelineRow({
    id: t.id,
    title: t.title || '(untitled)',
    eventType: t.eventType?.name ?? null,
    ticketStatus: t.ticketStatus,
    createdAt: t.createdAt.toISOString(),
    events: t.events.map((e) => ({
      id: '', fromState: null, toState: e.toState, actor: e.actor?.name ?? null, note: e.note, createdAt: e.createdAt.toISOString(),
    })),
  });
}

/**
 * Production-timeline rows for /studio/timeline — every in-flight ticket (bounded, it's
 * the live queue) plus a capped slice of recently-created completed tickets, so the
 * bottleneck ranking and stage averages can be computed without ever scanning the full
 * Done history. Optionally scoped to one event type (e.g. "Masterclass").
 */
export async function getTicketTimelines(opts: { eventType?: string } = {}): Promise<TicketTimelineRow[]> {
  const eventTypeWhere = opts.eventType ? { eventType: { name: opts.eventType } } : {};
  const [active, recentCompleted] = await Promise.all([
    prisma.ticket.findMany({
      where: { ...eventTypeWhere, ticketStatus: { notIn: ['Done', 'Shipping', 'Published', "Won't Do"] } },
      include: TIMELINE_INCLUDE,
    }),
    prisma.ticket.findMany({
      where: { ...eventTypeWhere, ticketStatus: { in: ['Done', 'Shipping', 'Published'] } },
      orderBy: { createdAt: 'desc' },
      take: RECENT_COMPLETED_LIMIT,
      include: TIMELINE_INCLUDE,
    }),
  ]);
  return [...active, ...recentCompleted]
    .map((t) => toTicketTimelineRow(t as unknown as TicketWithTimelineRelations))
    .filter((r): r is TicketTimelineRow => r !== null);
}
