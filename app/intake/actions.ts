'use server';

import { prisma } from '@/lib/prisma';
import { scoreTicketById } from '@/lib/tickets/score-service';

export interface CreateTicketInput {
  requesterId: string;
  title: string; // Project/Program (≤40)
  teamServiceLevel: string;
  typeOfRequest: string; // Video | Design
  eventTypeId: string;
  assetTypeId: string;
  officialCalendarId: string;
  authorIds: string[];
  creativeBrief: string;
  cta?: string;
  dueDate: string; // ISO date
  sourceLinks?: string;
  notes?: string;
}

export interface CreateTicketResult {
  ok: boolean;
  ticketId?: string;
  error?: string;
}

const REQUIRED: [keyof CreateTicketInput, string][] = [
  ['requesterId', 'Requested By'],
  ['title', 'Project/Program'],
  ['teamServiceLevel', 'Team/Service Level'],
  ['typeOfRequest', 'Type of Request'],
  ['eventTypeId', 'Event Type'],
  ['assetTypeId', 'Asset Type'],
  ['officialCalendarId', 'Official Calendar'],
  ['creativeBrief', 'Creative Brief'],
  ['dueDate', 'Due date'],
];

export async function createTicket(input: CreateTicketInput): Promise<CreateTicketResult> {
  // Enforce required taxonomy at submit (missing tags break the priority score).
  for (const [key, label] of REQUIRED) {
    const v = input[key];
    if (!v || (typeof v === 'string' && !v.trim())) {
      return { ok: false, error: `${label} is required` };
    }
  }
  if (input.title.trim().length > 40) {
    return { ok: false, error: 'Project/Program must be 40 characters or fewer' };
  }
  const due = new Date(input.dueDate);
  if (Number.isNaN(due.getTime())) {
    return { ok: false, error: 'Invalid due date' };
  }

  try {
    const ticket = await prisma.ticket.create({
      data: {
        title: input.title.trim(),
        creativeBrief: input.creativeBrief.trim(),
        cta: input.cta?.trim() || null,
        dueDate: due,
        eventTypeId: input.eventTypeId,
        assetTypeId: input.assetTypeId,
        requesterId: input.requesterId,
        officialCalendarId: input.officialCalendarId,
        teamServiceLevel: input.teamServiceLevel,
        typeOfRequest: input.typeOfRequest,
        sourceLinks: input.sourceLinks?.trim() || null,
        notes: input.notes?.trim() || null,
        // Priority + assignee are NOT set here — handled by the backend (E4).
        prioStatus: 'New Request', // live enum default
        ticketStatus: 'Backlog', // live enum default
        source: 'app',
        authors: input.authorIds?.length
          ? { create: input.authorIds.map((authorId) => ({ authorId })) }
          : undefined,
        // Lifecycle: first state transition is logged.
        events: {
          create: { toState: 'Requested', actorId: input.requesterId, note: 'Submitted via intake form' },
        },
      },
    });
    // Score on create so the new request enters the queue ranked (best-effort).
    try { await scoreTicketById(ticket.id); } catch { /* manager can recompute */ }
    return { ok: true, ticketId: ticket.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create request' };
  }
}
