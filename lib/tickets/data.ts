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

export async function getQueueTickets(): Promise<QueueTicket[]> {
  // Order mirrors v_editor_queue: priority_score DESC NULLS LAST, then queue_rank.
  const rows = await prisma.ticket.findMany({
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
