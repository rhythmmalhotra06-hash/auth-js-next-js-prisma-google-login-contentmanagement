'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { TICKET_STATUSES, PRIO_STATUSES } from '@/lib/tickets/constants';

export interface UpdateStatusResult {
  ok: boolean;
  error?: string;
}

// Editor updates the ticket_status axis. Every transition writes a ticket_events
// row (the lifecycle audit trail). prio_status is manager-owned, set elsewhere.
export async function updateTicketStatus(ticketId: string, newStatus: string): Promise<UpdateStatusResult> {
  if (!(TICKET_STATUSES as readonly string[]).includes(newStatus)) {
    return { ok: false, error: 'Invalid status' };
  }
  const current = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { ticketStatus: true } });
  if (!current) return { ok: false, error: 'Ticket not found' };
  if (current.ticketStatus === newStatus) return { ok: true };

  await prisma.$transaction([
    prisma.ticket.update({ where: { id: ticketId }, data: { ticketStatus: newStatus } }),
    prisma.ticketEvent.create({
      data: { ticketId, fromState: current.ticketStatus, toState: newStatus, note: 'Ticket status updated' },
    }),
  ]);

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/tickets');
  return { ok: true };
}

// Manager sets the externally-facing prio_status axis (field-only; the lifecycle
// audit trail tracks the production ticket_status axis).
export async function updatePrioStatus(ticketId: string, newStatus: string): Promise<UpdateStatusResult> {
  if (!(PRIO_STATUSES as readonly string[]).includes(newStatus)) {
    return { ok: false, error: 'Invalid priority status' };
  }
  const t = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!t) return { ok: false, error: 'Ticket not found' };

  await prisma.ticket.update({ where: { id: ticketId }, data: { prioStatus: newStatus } });
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/manager');
  return { ok: true };
}

// Manager assigns an editor. A new assignment logs an 'Assigned' lifecycle event.
export async function assignTicket(ticketId: string, assigneeId: string): Promise<UpdateStatusResult> {
  const current = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { assigneeId: true } });
  if (!current) return { ok: false, error: 'Ticket not found' };
  const next = assigneeId || null;
  if (current.assigneeId === next) return { ok: true };

  if (next) {
    const emp = await prisma.employee.findUnique({ where: { id: next }, select: { name: true } });
    await prisma.$transaction([
      prisma.ticket.update({ where: { id: ticketId }, data: { assigneeId: next } }),
      prisma.ticketEvent.create({ data: { ticketId, toState: 'Assigned', note: `Assigned to ${emp?.name ?? 'editor'}` } }),
    ]);
  } else {
    await prisma.ticket.update({ where: { id: ticketId }, data: { assigneeId: null } });
  }
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/manager');
  revalidatePath('/editor');
  return { ok: true };
}
