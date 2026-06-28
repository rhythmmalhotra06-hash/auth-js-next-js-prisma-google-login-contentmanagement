// Queue/list data for the role views — Airtable-direct (Prio Requests table).
// The first five columns are mandated identical across ALL views: Title, Priority,
// Assigned, Ticket Status, Priority Status (CLAUDE.md §7).
//
// Reads come straight from Airtable; linked names (assignee/event/asset/...) are
// resolved via cached reference maps. No Postgres.

import { TICKETS } from '@/lib/airtable/field-map';
import { listAll, getRecord } from '@/lib/airtable/rest';
import { nameMap, firstLinkedName, firstLinkedId } from '@/lib/repositories/reference.repository';
import { listActiveEmployeeRecords } from '@/lib/repositories/employee.repository';
import { cleanBrief } from '@/lib/tickets/brief';

const F = TICKETS.fields;
const L = TICKETS.links;

export interface QueueTicket {
  id: string;
  title: string;
  priorityScore: string | null;
  queueRank: number | null;
  assignee: string | null;
  ticketStatus: string | null;
  prioStatus: string | null;
  eventType: string | null;
  assetType: string | null;
  requester: string | null;
  requesterId: string | null;
  typeOfRequest: string | null;
  dueDate: string | null;
  /** Live performance metrics — not wired to a source yet (Clarisights/Amplitude). Undefined today. */
  perf?: { ctr: number; roas: number; views: string; series: number[] } | null;
}

export interface EmployeeOption { id: string; name: string }

const str = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return String(v);
};
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
// Lookup / multipleSelects fields arrive as arrays of strings or {name} objects.
const arr = (v: unknown): string | null => {
  if (Array.isArray(v)) {
    const parts = v
      .map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' && 'name' in x ? String((x as { name: unknown }).name) : null))
      .filter((s): s is string => !!s);
    return parts.length ? [...new Set(parts)].join(', ') : null;
  }
  return str(v);
};

// Active = everything except terminal states; keeps us well under the 10k table size.
const ACTIVE_FILTER = `NOT(OR({Ticket Status} = 'Done', {Ticket Status} = "Won't Do"))`;
// Shipped = the terminal Done state. The full set is ~9k rows (mostly migrated
// history), so never scan it — read only the newest few (getRecentShipped).
const SHIPPED_FILTER = `{Ticket Status} = 'Done'`;

const QUEUE_FIELDS = [F.name, F.score, F.queueRank, F.ticketStatus, F.prioStatus, F.typeOfRequest, F.dueDate,
  L.assignedCreative, L.requestedBy, L.eventTypes, L.assetTypes];

// Maps a raw Prio Requests record to a QueueTicket (+ assigneeId for filtering).
function mapTicketRow(
  rec: { id: string; fields: unknown },
  employees: Map<string, string>, eventTypes: Map<string, string>, assetTypes: Map<string, string>,
): QueueTicket & { assigneeId: string | null } {
  const f = rec.fields as Record<string, unknown>;
  return {
    id: rec.id,
    title: str(f[F.name]) ?? '(untitled)',
    priorityScore: num(f[F.score]) != null ? String(num(f[F.score])) : null,
    queueRank: num(f[F.queueRank]),
    assignee: firstLinkedName(f[L.assignedCreative], employees),
    assigneeId: firstLinkedId(f[L.assignedCreative]),
    ticketStatus: str(f[F.ticketStatus]),
    prioStatus: str(f[F.prioStatus]),
    eventType: firstLinkedName(f[L.eventTypes], eventTypes),
    assetType: firstLinkedName(f[L.assetTypes], assetTypes),
    requester: firstLinkedName(f[L.requestedBy], employees),
    requesterId: firstLinkedId(f[L.requestedBy]),
    typeOfRequest: str(f[F.typeOfRequest]),
    dueDate: typeof f[F.dueDate] === 'string' ? (f[F.dueDate] as string) : null,
  };
}

/** Active employees for assignment pickers (recId → name) — excludes retired/inactive staff. */
export async function getActiveEmployees(): Promise<EmployeeOption[]> {
  const rows = await listActiveEmployeeRecords();
  return rows.map((r) => ({ id: r.id, name: r.name })).sort((a, b) => a.name.localeCompare(b.name));
}

export async function getQueueTickets(opts: { assigneeId?: string; includeCompleted?: boolean } = {}): Promise<QueueTicket[]> {
  const [res, employees, eventTypes, assetTypes] = await Promise.all([
    listAll(TICKETS.baseId, TICKETS.tableId, {
      // Stakeholder/post-prod views pass includeCompleted to also surface Done/Won't Do.
      ...(opts.includeCompleted ? {} : { filterByFormula: ACTIVE_FILTER }),
      fields: QUEUE_FIELDS,
    }),
    nameMap('employees'), nameMap('eventTypes'), nameMap('assetTypes'),
  ]);
  if (!res.ok) return [];

  let rows = res.data.map((rec) => mapTicketRow(rec, employees, eventTypes, assetTypes));

  if (opts.assigneeId) rows = rows.filter((r) => r.assigneeId === opts.assigneeId);

  // queue_rank (manual) overrides score; unranked fall back to score desc.
  rows.sort((a, b) => {
    const ar = a.queueRank, br = b.queueRank;
    if (ar != null && br != null) return ar - br;
    if (ar != null) return -1;
    if (br != null) return 1;
    return (Number(b.priorityScore) || 0) - (Number(a.priorityScore) || 0);
  });

  return rows.map(({ assigneeId: _drop, ...rest }) => rest);
}

/**
 * The newest shipped (Done) tickets, capped. Sorted by "Created" desc (the Done set
 * has no reliable published-date), so the founder overview reads ~1 page instead of
 * scanning all ~9k Done rows via the includeCompleted path.
 */
export async function getRecentShipped(limit = 12): Promise<QueueTicket[]> {
  const [res, employees, eventTypes, assetTypes] = await Promise.all([
    listAll(TICKETS.baseId, TICKETS.tableId, {
      filterByFormula: SHIPPED_FILTER,
      sort: [{ field: 'Created', direction: 'desc' }],
      maxRecords: limit,
      fields: QUEUE_FIELDS,
    }),
    nameMap('employees'), nameMap('eventTypes'), nameMap('assetTypes'),
  ]);
  if (!res.ok) return [];
  return res.data.map((rec) => {
    const { assigneeId: _drop, ...rest } = mapTicketRow(rec, employees, eventTypes, assetTypes);
    return rest;
  });
}

/**
 * The full archive of requests a person raised — every status, including the ~9k
 * Done history. The "Requested By" link can't be filtered by recId server-side, but
 * it resolves to the requester's Name in a formula, so we filter by name in Airtable
 * (scans only their records, not the whole table) and then re-filter by requesterId
 * client-side to drop any name collisions — so the result is exact.
 */
export async function getMyRequests(employee: { id: string; name: string }): Promise<QueueTicket[]> {
  if (!employee?.name) return [];
  const safe = employee.name.replace(/["\\]/g, '\\$&');
  const formula = `FIND(LOWER("${safe}"), LOWER(ARRAYJOIN({Requested By}))) > 0`;
  const [res, employees, eventTypes, assetTypes] = await Promise.all([
    listAll(TICKETS.baseId, TICKETS.tableId, {
      filterByFormula: formula,
      sort: [{ field: 'Created', direction: 'desc' }],
      maxRecords: 1000,
      fields: QUEUE_FIELDS,
    }),
    nameMap('employees'), nameMap('eventTypes'), nameMap('assetTypes'),
  ]);
  if (!res.ok) return [];
  return res.data
    .map((rec) => mapTicketRow(rec, employees, eventTypes, assetTypes))
    .filter((t) => t.requesterId === employee.id) // exact: drop same-name collisions
    .map(({ assigneeId: _drop, ...rest }) => rest);
}

export interface TicketEventRow { id: string; fromState: string | null; toState: string; actor: string | null; note: string | null; createdAt: string }
export interface ApprovalRow { id: string; approver: string | null; state: string; feedback: string | null; decidedAt: string | null; createdAt: string }
export interface AssetRow { id: string; kind: string; fileUrl: string | null; distributionUrl: string | null; publishedAt: string | null; createdAt: string }

export interface TicketDetail {
  id: string;
  title: string;
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
  notes: string | null;
  priorityScore: string | null;
  eventType: string | null;
  assetType: string | null;
  requester: string | null;
  requesterId: string | null;
  assignee: string | null;
  assigneeId: string | null;
  officialCalendar: string | null;
  authors: string[];
  events: TicketEventRow[];
  approvals: ApprovalRow[];
  assets: AssetRow[];
}

export async function getTicketDetail(id: string): Promise<TicketDetail | null> {
  const [res, employees, eventTypes, assetTypes, authorsMap, calendars] = await Promise.all([
    getRecord(TICKETS.baseId, TICKETS.tableId, id),
    nameMap('employees'), nameMap('eventTypes'), nameMap('assetTypes'), nameMap('authors'), nameMap('officialCalendars'),
  ]);
  if (!res.ok) return null;
  const f = res.data.fields as Record<string, unknown>;

  // Assets are collapsed onto the Prio file-URL fields (raw/final/output).
  const assets: AssetRow[] = [];
  const pushAsset = (kind: string, url: unknown) => {
    const u = typeof url === 'string' && url.trim() ? url.trim() : null;
    if (u) assets.push({ id: `${id}:${kind}`, kind, fileUrl: u, distributionUrl: null, publishedAt: null, createdAt: res.data.createdTime });
  };
  pushAsset('raw', f[F.rawFileUrl]);
  pushAsset('final', f[F.final16x9]);
  pushAsset('final', f[F.final9x16]);
  pushAsset('final', f[F.final4x5]);
  pushAsset('final', f[F.outputLink]);
  pushAsset('folder', f[F.assetFolderLink]);

  const speakerNames = Array.isArray(f[L.speakers])
    ? (f[L.speakers] as unknown[]).map((rid) => (typeof rid === 'string' ? authorsMap.get(rid) : null)).filter((n): n is string => !!n)
    : [];

  return {
    id: res.data.id,
    title: str(f[F.name]) ?? '(untitled)',
    creativeBrief: cleanBrief(str(f[F.creativeBrief])),
    cta: str(f[F.cta]),
    dueDate: typeof f[F.dueDate] === 'string' ? (f[F.dueDate] as string) : null,
    ticketStatus: str(f[F.ticketStatus]),
    prioStatus: str(f[F.prioStatus]),
    typeOfRequest: str(f[F.typeOfRequest]),
    teamServiceLevel: str(f[F.teamServiceLevel]),
    team: arr(f[F.creativeServiceType]),
    project: str(f[F.projectProgram]),
    dimensions: arr(f[F.dimensionsLookup]),
    teamLead: arr(f[F.teamLeadLookup]),
    queueRank: num(f[F.queueRank]),
    folderUrl: str(f[F.assetFolderLink]),
    sourceLinks: str(f[F.rawFileUrl]),
    notes: cleanBrief(str(f[F.notes])),
    priorityScore: num(f[F.score]) != null ? String(num(f[F.score])) : null,
    eventType: firstLinkedName(f[L.eventTypes], eventTypes),
    assetType: firstLinkedName(f[L.assetTypes], assetTypes),
    requester: firstLinkedName(f[L.requestedBy], employees),
    requesterId: firstLinkedId(f[L.requestedBy]),
    assignee: firstLinkedName(f[L.assignedCreative], employees),
    assigneeId: firstLinkedId(f[L.assignedCreative]),
    officialCalendar: firstLinkedName(f[L.officialCalendar], calendars),
    authors: speakerNames,
    // Audit trail + approval history live in Airtable's record revision history now.
    events: [],
    approvals: [],
    assets,
  };
}
