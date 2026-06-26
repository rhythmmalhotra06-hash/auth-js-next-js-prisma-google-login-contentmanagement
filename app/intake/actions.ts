'use server';

import { prisma } from '@/lib/prisma';
import { scoreTicketById } from '@/lib/tickets/score-service';
import { ensureReferenceRows } from '@/lib/airtable/resolve-reference';
import { enqueueTicketPush } from '@/lib/airtable/outbox';
import { enqueueBlinklifePush } from '@/lib/blinklife/outbox';
import { pushBriefMemory } from '@/lib/blinklife/push';

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
  // Official Calendar is optional — not every request maps to a campaign on the calendar.
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

  // TEMP DIAGNOSTIC — what DB does the app's own connection use, and does it see
  // the column? Logged on every submit so it surfaces in runtime logs.
  try {
    const diag = await prisma.$queryRaw`SELECT current_database()::text AS db, current_user::text AS usr,
      (SELECT count(*) FROM information_schema.columns WHERE table_name='tickets' AND column_name='airtable_pushed_at')::int AS has_pushed_at,
      (SELECT count(*) FROM information_schema.columns WHERE table_name='tickets')::int AS ticket_col_count`;
    console.error('[DBDIAG2]', JSON.stringify(diag));
  } catch (e) {
    console.error('[DBDIAG2] err', e instanceof Error ? e.message : String(e));
  }

  // The intake form serves option values as Airtable recIds (live reference).
  // Resolve them to our UUIDs, lazily mirroring any row not yet synced, so the
  // ticket's foreign keys hold.
  let ref: Awaited<ReturnType<typeof ensureReferenceRows>>;
  try {
    ref = await ensureReferenceRows({
      eventTypeRecId: input.eventTypeId,
      assetTypeRecId: input.assetTypeId,
      requesterRecId: input.requesterId,
      officialCalendarRecId: input.officialCalendarId || null,
      authorRecIds: input.authorIds,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? `Could not resolve taxonomy: ${err.message}` : 'Could not resolve taxonomy' };
  }

  try {
    const ticket = await prisma.ticket.create({
      data: {
        title: input.title.trim(),
        creativeBrief: input.creativeBrief.trim(),
        cta: input.cta?.trim() || null,
        dueDate: due,
        eventTypeId: ref.eventTypeId,
        assetTypeId: ref.assetTypeId,
        requesterId: ref.requesterId,
        officialCalendarId: ref.officialCalendarId,
        teamServiceLevel: input.teamServiceLevel,
        typeOfRequest: input.typeOfRequest,
        sourceLinks: input.sourceLinks?.trim() || null,
        notes: input.notes?.trim() || null,
        // Priority + assignee are NOT set here — handled by the backend (E4).
        prioStatus: 'New Request', // live enum default
        ticketStatus: 'Backlog', // live enum default
        source: 'app',
        authors: ref.authorIds.length
          ? { create: ref.authorIds.map((authorId) => ({ authorId })) }
          : undefined,
        // Lifecycle: first state transition is logged.
        events: {
          create: { toState: 'Requested', actorId: ref.requesterId, note: 'Submitted via intake form' },
        },
      },
    });
    // Auto-assign the unambiguous ~20–30%: asset type with exactly one preferred editor.
    try {
      const editors = await prisma.assetTypePreferredEditor.findMany({
        where: { assetTypeId: ref.assetTypeId },
        select: { employeeId: true },
      });
      if (editors.length === 1) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { assigneeId: editors[0].employeeId, prioStatus: 'Assigned' },
        });
        await prisma.ticketEvent.create({
          data: { ticketId: ticket.id, toState: 'Assigned', note: 'Auto-assigned (single preferred editor)' },
        });
      }
    } catch { /* non-fatal — manager can assign */ }
    // Score on create so the new request enters the queue ranked (best-effort).
    try { await scoreTicketById(ticket.id); } catch { /* manager can recompute */ }
    // Mirror the new ticket to Airtable (best-effort; no-op unless push is enabled).
    await enqueueTicketPush(ticket.id);
    // Mirror to BlinkLife: enqueue the editor task + capture the brief as memory
    // (both best-effort; no-op unless BlinkLife push is enabled).
    await enqueueBlinklifePush(ticket.id);
    void pushBriefMemory(ticket.id);
    return { ok: true, ticketId: ticket.id };
  } catch (err) {
    // TEMP DIAGNOSTIC — full error so we can see the real Postgres detail (which
    // the returned message hides as "(not available)").
    console.error('[CREATE_FAIL]', JSON.stringify({
      message: err instanceof Error ? err.message : String(err),
      code: (err as { code?: string })?.code,
      meta: (err as { meta?: unknown })?.meta,
    }));
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create request' };
  }
}
