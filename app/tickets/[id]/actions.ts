'use server';

import { revalidatePath } from 'next/cache';
import { TICKET_STATUSES, PRIO_STATUSES } from '@/lib/tickets/constants';
import { updateTicketFields, TICKET_FIELD as F, TICKET_LINK as L } from '@/lib/repositories/ticket.repository';
import { maybeNotifyAssetReady, notifyAssignment } from '@/lib/notify/triggers';

export interface UpdateStatusResult {
  ok: boolean;
  error?: string;
}

function done(ticketId: string): UpdateStatusResult {
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/tickets');
  revalidatePath('/manager');
  revalidatePath('/editor');
  return { ok: true };
}

// Editor updates the internal Ticket Status axis (Airtable record). Audit history is
// captured by Airtable's built-in record revision history.
export async function updateTicketStatus(ticketId: string, newStatus: string): Promise<UpdateStatusResult> {
  if (!(TICKET_STATUSES as readonly string[]).includes(newStatus)) return { ok: false, error: 'Invalid status' };
  const res = await updateTicketFields(ticketId, { [F.ticketStatus]: newStatus });
  if (!res.ok) return { ok: false, error: res.error.message };
  return done(ticketId);
}

// Manager sets the externally-facing Prio Status axis.
export async function updatePrioStatus(ticketId: string, newStatus: string): Promise<UpdateStatusResult> {
  if (!(PRIO_STATUSES as readonly string[]).includes(newStatus)) return { ok: false, error: 'Invalid priority status' };
  const res = await updateTicketFields(ticketId, { [F.prioStatus]: newStatus });
  if (!res.ok) return { ok: false, error: res.error.message };
  return done(ticketId);
}

// Assign an editor (assigneeId is an Airtable Employees recId; empty clears).
export async function assignTicket(ticketId: string, assigneeId: string): Promise<UpdateStatusResult> {
  const res = await updateTicketFields(ticketId, { [L.assignedCreative]: assigneeId ? [assigneeId] : [] });
  if (!res.ok) return { ok: false, error: res.error.message };
  if (assigneeId) await notifyAssignment(ticketId, assigneeId); // E9.4 — DM the editor (best-effort)
  return done(ticketId);
}

// Approvals are collapsed onto the status axis (per the Airtable-direct pivot):
// "request approval" = move to Review; a decision = Approved / In Revision.
export async function requestApproval(ticketId: string, _approverId?: string): Promise<UpdateStatusResult> {
  const res = await updateTicketFields(ticketId, { [F.ticketStatus]: 'Review' });
  if (!res.ok) return { ok: false, error: res.error.message };
  return done(ticketId);
}

export async function decideApproval(
  ticketId: string,
  decision: 'approved' | 'changes_requested',
  feedback: string,
): Promise<UpdateStatusResult> {
  const status = decision === 'approved' ? 'Approved' : 'In Revision';
  const fields: Record<string, unknown> = { [F.ticketStatus]: status };
  if (feedback?.trim()) fields[F.notes] = feedback.trim();
  const res = await updateTicketFields(ticketId, fields);
  if (!res.ok) return { ok: false, error: res.error.message };
  return done(ticketId);
}

// Assets are collapsed onto Prio file-URL fields: raw → Raw File/URL, final → Output link.
export async function addAsset(
  ticketId: string,
  kind: string,
  fileUrl: string,
  _distributionUrl: string,
): Promise<UpdateStatusResult> {
  if (kind !== 'raw' && kind !== 'final') return { ok: false, error: 'Kind must be raw or final' };
  if (!fileUrl?.trim()) return { ok: false, error: 'File URL is required' };
  const field = kind === 'raw' ? F.rawFileUrl : F.outputLink;
  const res = await updateTicketFields(ticketId, { [field]: fileUrl.trim() });
  if (!res.ok) return { ok: false, error: res.error.message };
  // E9.4 — a final asset link is the "ready" signal: DM the requester + post to #content-ready (once, best-effort).
  if (kind === 'final') await maybeNotifyAssetReady(ticketId, fileUrl.trim());
  return done(ticketId);
}

// assetId is synthesized as `${ticketId}:${kind}` by getTicketDetail; clear that field.
export async function removeAsset(assetId: string): Promise<UpdateStatusResult> {
  const [ticketId, kind] = assetId.split(':');
  if (!ticketId) return { ok: false, error: 'Invalid asset' };
  const field = kind === 'raw' ? F.rawFileUrl : F.outputLink;
  const res = await updateTicketFields(ticketId, { [field]: '' });
  if (!res.ok) return { ok: false, error: res.error.message };
  return done(ticketId);
}
