'use server';

import { revalidatePath } from 'next/cache';
import { PRIO_STATUSES, TICKET_STATUSES } from '@/lib/tickets/constants';
import { getTicketDetail } from '@/lib/tickets/data';
import { updateTicket } from '@/lib/tickets/write';
import { getShoot, updateShoot, SHOOT_STATUS } from '@/lib/shoots/repository';
import { SHOOTS as S } from '@/lib/airtable/field-map';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// Studio writes are the propose-only COMMIT boundary: they only ever fire on an
// explicit Vishen tap (Approve / Send back / star). No staged value reaches a live
// field without one of these.
function revalidateStudio(): void {
  for (const p of ['/studio', '/studio/sign-off', '/studio/ranking', '/studio/launches', '/shoots']) {
    revalidatePath(p);
  }
}

const PRIO_IN_QUEUE = 'In Queue';
const REVISION_STATUS = 'In Revision';

/** Approve a reviewed ticket — Prio Status → "In Queue" (signed into the production queue). */
export async function approveReview(ticketId: string): Promise<ActionResult> {
  if (!(PRIO_STATUSES as readonly string[]).includes(PRIO_IN_QUEUE)) return { ok: false, error: 'Config error' };
  const res = await updateTicket(ticketId, { prioStatus: PRIO_IN_QUEUE });
  if (!res.ok) return { ok: false, error: res.error };
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

  const res = await updateTicket(ticketId, { ticketStatus: REVISION_STATUS, prioStatus: PRIO_IN_QUEUE, notes: merged }, { note: entry });
  if (!res.ok) return { ok: false, error: res.error };
  revalidateStudio();
  return { ok: true };
}

// ── Content review (Review queue: approve work or send it back) ───────────────

const APPROVED_STATUS = 'Approved';

/** Content review: approve the work — Ticket Status → "Approved". */
export async function approveContentReview(ticketId: string): Promise<ActionResult> {
  if (!(TICKET_STATUSES as readonly string[]).includes(APPROVED_STATUS)) return { ok: false, error: 'Config error' };
  const res = await updateTicket(ticketId, { ticketStatus: APPROVED_STATUS });
  if (!res.ok) return { ok: false, error: res.error };
  revalidateStudio();
  return { ok: true };
}

/** Content review: send work back — Ticket Status → "In Revision" + append note to V's Notes. */
export async function sendBackContentReview(ticketId: string, note: string): Promise<ActionResult> {
  const trimmed = note?.trim();
  if (!trimmed) return { ok: false, error: 'A note is required when sending back' };
  if (!(TICKET_STATUSES as readonly string[]).includes(REVISION_STATUS)) return { ok: false, error: 'Config error' };

  const detail = await getTicketDetail(ticketId);
  const stamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const entry = `[Vishen · ${stamp}] ${trimmed}`;
  const merged = detail?.notes ? `${detail.notes}\n\n${entry}` : entry;

  const res = await updateTicket(ticketId, { ticketStatus: REVISION_STATUS, notes: merged }, { note: entry });
  if (!res.ok) return { ok: false, error: res.error };
  revalidateStudio();
  return { ok: true };
}

// ── Shoot sign-off (founder approves/declines pending shoot requests) ─────────
// Shoots remain Airtable-direct for now (tickets-first migration); a shoot only
// advances on an explicit Vishen tap.

/** Approve a pending shoot — Filming Status → "Approved by Vishen" + tick the approval checkbox. */
export async function approveShoot(shootId: string): Promise<ActionResult> {
  const res = await updateShoot(shootId, {
    [S.fields.status]: SHOOT_STATUS.approved,
    [S.fields.vishenApproval]: true,
  });
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidateStudio();
  return { ok: true };
}

/**
 * Decline a pending shoot — Filming Status → "Cancelled". The note is optional;
 * when present it's appended to Notes/Brief with a light Vishen attribution stamp.
 */
export async function declineShoot(shootId: string, note?: string): Promise<ActionResult> {
  const fields: Record<string, unknown> = { [S.fields.status]: SHOOT_STATUS.cancelled };

  const trimmed = note?.trim();
  if (trimmed) {
    const detail = await getShoot(shootId);
    const stamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const entry = `[Vishen · ${stamp}] ${trimmed}`;
    const existing = detail.ok ? detail.data.brief : null;
    fields[S.fields.notes] = existing ? `${existing}\n\n${entry}` : entry;
  }

  const res = await updateShoot(shootId, fields);
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidateStudio();
  return { ok: true };
}

/** Set the 2-way-synced manual priority rank (1–5 stars → "Priority ranking (Manual)"). */
export async function setPriorityRank(ticketId: string, rank: number): Promise<ActionResult> {
  if (!Number.isInteger(rank) || rank < 1 || rank > 5) return { ok: false, error: 'Rank must be 1–5' };
  const res = await updateTicket(ticketId, { queueRank: rank });
  if (!res.ok) return { ok: false, error: res.error };
  revalidateStudio();
  return { ok: true };
}
