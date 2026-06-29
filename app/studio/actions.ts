'use server';

import { revalidatePath } from 'next/cache';
import { PRIO_STATUSES, TICKET_STATUSES } from '@/lib/tickets/constants';
import { getTicketDetail } from '@/lib/tickets/data';
import { updateTicketFields, TICKET_FIELD as F } from '@/lib/repositories/ticket.repository';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// Studio writes are the propose-only COMMIT boundary: they only ever fire on an
// explicit Vishen tap (Approve / Send back / star). No staged value reaches a live
// field without one of these.
function revalidateStudio(): void {
  for (const p of ['/studio', '/studio/sign-off', '/studio/ranking', '/studio/launches', '/studio/at-risk']) {
    revalidatePath(p);
  }
}

const PRIO_IN_QUEUE = 'In Queue';
const REVISION_STATUS = 'In Revision';

/** Approve a reviewed ticket — Prio Status → "In Queue" (signed into the production queue). */
export async function approveReview(ticketId: string): Promise<ActionResult> {
  if (!(PRIO_STATUSES as readonly string[]).includes(PRIO_IN_QUEUE)) return { ok: false, error: 'Config error' };
  const res = await updateTicketFields(ticketId, { [F.prioStatus]: PRIO_IN_QUEUE });
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidateStudio();
  return { ok: true };
}

/**
 * Send a reviewed ticket back for changes — append Vishen's note to V's Notes,
 * set Ticket Status → "In Revision", and clear it from his review queue by moving
 * Prio Status → "In Queue".
 */
export async function sendBackForRevision(ticketId: string, note: string): Promise<ActionResult> {
  const trimmed = note?.trim();
  if (!trimmed) return { ok: false, error: 'A note is required when sending back' };
  if (!(TICKET_STATUSES as readonly string[]).includes(REVISION_STATUS)) return { ok: false, error: 'Config error' };

  // Append to existing V's Notes rather than overwrite, with a light attribution stamp.
  const detail = await getTicketDetail(ticketId);
  const stamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const entry = `[Vishen · ${stamp}] ${trimmed}`;
  const merged = detail?.notes ? `${detail.notes}\n\n${entry}` : entry;

  const res = await updateTicketFields(ticketId, {
    [F.ticketStatus]: REVISION_STATUS,
    [F.prioStatus]: PRIO_IN_QUEUE,
    [F.notes]: merged,
  });
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidateStudio();
  return { ok: true };
}

/** Set the 2-way-synced manual priority rank (1–5 stars → "Priority ranking (Manual)"). */
export async function setPriorityRank(ticketId: string, rank: number): Promise<ActionResult> {
  if (!Number.isInteger(rank) || rank < 1 || rank > 5) return { ok: false, error: 'Rank must be 1–5' };
  const res = await updateTicketFields(ticketId, { [F.queueRank]: rank });
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidateStudio();
  return { ok: true };
}
