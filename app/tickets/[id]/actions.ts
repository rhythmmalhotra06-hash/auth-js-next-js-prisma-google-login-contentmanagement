'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { TICKET_STATUSES } from '@/lib/tickets/constants';

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
