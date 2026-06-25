import { prisma } from '@/lib/prisma';

// Queue/list data for the role views. The first five columns are mandated to be
// identical across ALL views: Title, Priority, Assigned, Ticket Status,
// Priority Status (decision log / CLAUDE.md §7).

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
  typeOfRequest: string | null;
  dueDate: string | null;
}

export interface EmployeeOption {
  id: string;
  name: string;
}

/** Active employees, for the editor-view picker and (later) manager assignment. */
export async function getActiveEmployees(): Promise<EmployeeOption[]> {
  return prisma.employee.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
}

export async function getQueueTickets(opts: { assigneeId?: string } = {}): Promise<QueueTicket[]> {
  // Order mirrors v_editor_queue: priority_score DESC NULLS LAST, then queue_rank.
  const rows = await prisma.ticket.findMany({
    where: opts.assigneeId ? { assigneeId: opts.assigneeId } : undefined,
    orderBy: [{ priorityScore: { sort: 'desc', nulls: 'last' } }, { queueRank: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      priorityScore: true,
      queueRank: true,
      ticketStatus: true,
      prioStatus: true,
      typeOfRequest: true,
      dueDate: true,
      assignee: { select: { name: true } },
      requester: { select: { name: true } },
      eventType: { select: { name: true } },
      assetType: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    priorityScore: r.priorityScore != null ? r.priorityScore.toString() : null,
    queueRank: r.queueRank,
    assignee: r.assignee?.name ?? null,
    ticketStatus: r.ticketStatus,
    prioStatus: r.prioStatus,
    eventType: r.eventType?.name ?? null,
    assetType: r.assetType?.name ?? null,
    requester: r.requester?.name ?? null,
    typeOfRequest: r.typeOfRequest,
    dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
  }));
}

export interface TicketEventRow {
  id: string;
  fromState: string | null;
  toState: string;
  actor: string | null;
  note: string | null;
  createdAt: string;
}

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
  sourceLinks: string | null;
  notes: string | null;
  priorityScore: string | null;
  eventType: string | null;
  assetType: string | null;
  requester: string | null;
  assignee: string | null;
  officialCalendar: string | null;
  authors: string[];
  events: TicketEventRow[];
}

export async function getTicketDetail(id: string): Promise<TicketDetail | null> {
  const t = await prisma.ticket.findUnique({
    where: { id },
    select: {
      id: true, title: true, creativeBrief: true, cta: true, dueDate: true,
      ticketStatus: true, prioStatus: true, typeOfRequest: true, teamServiceLevel: true,
      sourceLinks: true, notes: true, priorityScore: true,
      eventType: { select: { name: true } },
      assetType: { select: { name: true } },
      requester: { select: { name: true } },
      assignee: { select: { name: true } },
      officialCalendar: { select: { name: true } },
      authors: { select: { author: { select: { name: true } } } },
      events: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, fromState: true, toState: true, note: true, createdAt: true, actor: { select: { name: true } } },
      },
    },
  });
  if (!t) return null;
  return {
    id: t.id, title: t.title, creativeBrief: t.creativeBrief, cta: t.cta,
    dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    ticketStatus: t.ticketStatus, prioStatus: t.prioStatus, typeOfRequest: t.typeOfRequest,
    teamServiceLevel: t.teamServiceLevel, sourceLinks: t.sourceLinks, notes: t.notes,
    priorityScore: t.priorityScore != null ? t.priorityScore.toString() : null,
    eventType: t.eventType?.name ?? null,
    assetType: t.assetType?.name ?? null,
    requester: t.requester?.name ?? null,
    assignee: t.assignee?.name ?? null,
    officialCalendar: t.officialCalendar?.name ?? null,
    authors: t.authors.map((a) => a.author.name),
    events: t.events.map((e) => ({
      id: e.id, fromState: e.fromState, toState: e.toState, note: e.note,
      actor: e.actor?.name ?? null, createdAt: e.createdAt.toISOString(),
    })),
  };
}
