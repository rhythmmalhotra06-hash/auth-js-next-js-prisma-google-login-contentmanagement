'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { TICKET_STATUSES, PRIO_STATUSES, GATED_STATUSES } from '@/lib/tickets/constants';
import { outboxPushOps, enqueueTicketPush } from '@/lib/airtable/outbox';

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

  // Decision lock: gated states require an approved approval.
  if ((GATED_STATUSES as readonly string[]).includes(newStatus)) {
    const approved = await prisma.approval.count({ where: { ticketId, state: 'approved' } });
    if (approved === 0) {
      return { ok: false, error: `Blocked: "${newStatus}" requires an approved approval first` };
    }
  }

  await prisma.$transaction([
    prisma.ticket.update({ where: { id: ticketId }, data: { ticketStatus: newStatus } }),
    prisma.ticketEvent.create({
      data: { ticketId, fromState: current.ticketStatus, toState: newStatus, note: 'Ticket status updated' },
    }),
    ...outboxPushOps(ticketId),
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
  await enqueueTicketPush(ticketId);
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
      ...outboxPushOps(ticketId),
    ]);
  } else {
    await prisma.ticket.update({ where: { id: ticketId }, data: { assigneeId: null } });
    await enqueueTicketPush(ticketId);
  }
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/manager');
  revalidatePath('/editor');
  return { ok: true };
}

// Request an approval from an approver (creates a pending approval).
export async function requestApproval(ticketId: string, approverId: string): Promise<UpdateStatusResult> {
  if (!approverId) return { ok: false, error: 'Pick an approver' };
  const t = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!t) return { ok: false, error: 'Ticket not found' };

  await prisma.approval.create({ data: { ticketId, approverId, state: 'pending' } });
  revalidatePath(`/tickets/${ticketId}`);
  return { ok: true };
}

// Approver decides: approved | changes_requested. Logs a lifecycle event; an
// 'approved' decision unlocks the gated state transition.
export async function decideApproval(
  approvalId: string,
  decision: 'approved' | 'changes_requested',
  feedback: string,
): Promise<UpdateStatusResult> {
  if (decision !== 'approved' && decision !== 'changes_requested') {
    return { ok: false, error: 'Invalid decision' };
  }
  const appr = await prisma.approval.findUnique({ where: { id: approvalId }, select: { ticketId: true } });
  if (!appr) return { ok: false, error: 'Approval not found' };

  await prisma.$transaction([
    prisma.approval.update({
      where: { id: approvalId },
      data: { state: decision, feedback: feedback?.trim() || null, decidedAt: new Date() },
    }),
    prisma.ticketEvent.create({
      data: {
        ticketId: appr.ticketId,
        toState: decision === 'approved' ? 'Approved' : 'Changes requested',
        note: feedback?.trim() ? `Approval: ${feedback.trim()}` : 'Approval decision',
      },
    }),
  ]);
  revalidatePath(`/tickets/${appr.ticketId}`);
  return { ok: true };
}

// Attach a raw/final asset to a ticket (Air-style version stacking). A
// distribution URL marks it as published to the social calendar.
export async function addAsset(
  ticketId: string,
  kind: string,
  fileUrl: string,
  distributionUrl: string,
): Promise<UpdateStatusResult> {
  if (kind !== 'raw' && kind !== 'final') return { ok: false, error: 'Kind must be raw or final' };
  if (!fileUrl?.trim()) return { ok: false, error: 'File URL is required' };
  const t = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (!t) return { ok: false, error: 'Ticket not found' };

  const dist = distributionUrl?.trim() || null;
  await prisma.asset.create({
    data: { ticketId, kind, fileUrl: fileUrl.trim(), distributionUrl: dist, publishedAt: dist ? new Date() : null },
  });
  revalidatePath(`/tickets/${ticketId}`);
  return { ok: true };
}

export async function removeAsset(assetId: string): Promise<UpdateStatusResult> {
  const a = await prisma.asset.findUnique({ where: { id: assetId }, select: { ticketId: true } });
  if (!a) return { ok: false, error: 'Asset not found' };
  await prisma.asset.delete({ where: { id: assetId } });
  if (a.ticketId) revalidatePath(`/tickets/${a.ticketId}`);
  return { ok: true };
}
