'use server';

import { revalidatePath } from 'next/cache';
import { TICKET_STATUSES, PRIO_STATUSES } from '@/lib/tickets/constants';
import { updateTicket, type TicketPatch } from '@/lib/tickets/write';
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

// Editor updates the internal Ticket Status axis. Postgres is the system of record;
// the write appends a TicketEvent + enqueues an Airtable push (drained in the background).
export async function updateTicketStatus(ticketId: string, newStatus: string): Promise<UpdateStatusResult> {
  if (!(TICKET_STATUSES as readonly string[]).includes(newStatus)) return { ok: false, error: 'Invalid status' };
  const res = await updateTicket(ticketId, { ticketStatus: newStatus });
  if (!res.ok) return { ok: false, error: res.error };
  return done(ticketId);
}

// Manager sets the externally-facing Prio Status axis.
export async function updatePrioStatus(ticketId: string, newStatus: string): Promise<UpdateStatusResult> {
  if (!(PRIO_STATUSES as readonly string[]).includes(newStatus)) return { ok: false, error: 'Invalid priority status' };
  const res = await updateTicket(ticketId, { prioStatus: newStatus });
  if (!res.ok) return { ok: false, error: res.error };
  return done(ticketId);
}

// Assign an editor (assigneeId is an Airtable Employees recId; empty clears).
export async function assignTicket(ticketId: string, assigneeId: string): Promise<UpdateStatusResult> {
  const res = await updateTicket(ticketId, { assigneeRecId: assigneeId || null });
  if (!res.ok) return { ok: false, error: res.error };
  if (assigneeId) await notifyAssignment(ticketId, assigneeId); // E9.4 — DM the editor (best-effort)
  return done(ticketId);
}

// Approvals are collapsed onto the status axis (per the Airtable-direct pivot):
// "request approval" = move to Review; a decision = Approved / In Revision.
export async function requestApproval(ticketId: string, _approverId?: string): Promise<UpdateStatusResult> {
  const res = await updateTicket(ticketId, { ticketStatus: 'Review' });
  if (!res.ok) return { ok: false, error: res.error };
  return done(ticketId);
}

export async function decideApproval(
  ticketId: string,
  decision: 'approved' | 'changes_requested',
  feedback: string,
): Promise<UpdateStatusResult> {
  const patch: TicketPatch = { ticketStatus: decision === 'approved' ? 'Approved' : 'In Revision' };
  if (feedback?.trim()) patch.notes = feedback.trim();
  const res = await updateTicket(ticketId, patch, { note: feedback?.trim() || undefined });
  if (!res.ok) return { ok: false, error: res.error };
  return done(ticketId);
}

// Editable delivery links on the ticket detail form. Each key is a TicketPatch field
// (1:1 with a Prio field). `url: true` marks Airtable url-typed fields (they reject
// non-URL strings, so we guard before writing). `delivery: true` marks a final-delivery
// link whose arrival is the "asset ready" signal (deduped by asset_ready_notified).
const ASSET_LINK_FIELDS = {
  assetFolderLink: { url: false, delivery: false },
  workingFiles: { url: false, delivery: false },
  final16x9: { url: false, delivery: true },
  folder16x9: { url: true, delivery: false },
  final9x16: { url: false, delivery: true },
  folder9x16: { url: true, delivery: false },
  final4x5: { url: false, delivery: true },
  folder4x5: { url: true, delivery: false },
} as const;

export type AssetLinkKey = keyof typeof ASSET_LINK_FIELDS;

// Write (or clear, with an empty value) a single delivery-link field.
// `isAds` gates the "ready" signal for the folder link: ads tickets deliver via the ratio
// Final Links, so only those notify; non-ads tickets have no ratio links, so the Asset
// Folder Link is their delivery signal instead.
export async function updateTicketLink(ticketId: string, key: string, value: string, isAds = false): Promise<UpdateStatusResult> {
  const spec = ASSET_LINK_FIELDS[key as AssetLinkKey];
  if (!spec) return { ok: false, error: 'Unknown field' };
  const v = value.trim();
  if (v && spec.url && !/^https?:\/\//i.test(v)) return { ok: false, error: 'Enter a full URL (https://…)' };
  const res = await updateTicket(ticketId, { [key as AssetLinkKey]: v } as TicketPatch);
  if (!res.ok) return { ok: false, error: res.error };
  // E9.4 — filling a delivery link DMs the requester + posts to #content-ready (once, best-effort).
  const isDelivery = spec.delivery || (key === 'assetFolderLink' && !isAds);
  if (v && isDelivery) await maybeNotifyAssetReady(ticketId, v);
  return done(ticketId);
}
