'use server';

import { revalidatePath } from 'next/cache';
import { requireSocialAccess } from '@/lib/social/guard';
import { setSocialStatus, markSocialTicketRaised, getSocialSuggestion } from '@/lib/social/repository';
import { createTicket } from '@/app/intake/actions';
import { getEmployeeForSession } from '@/lib/employee';

export interface SocialActionResult {
  ok: boolean;
  error?: string;
}

/** Approve a suggestion (status → "2: Approved"). Does not raise a ticket. */
export async function approveSocialSuggestion(id: string): Promise<SocialActionResult> {
  await requireSocialAccess();
  const res = await setSocialStatus(id, 'approved');
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidatePath('/social');
  return { ok: true };
}

/** Reject a suggestion (status → "13: Reject"). Retained for the feedback loop. */
export async function rejectSocialSuggestion(id: string): Promise<SocialActionResult> {
  await requireSocialAccess();
  const res = await setSocialStatus(id, 'reject');
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidatePath('/social');
  return { ok: true };
}

export interface RaiseSocialInput {
  eventTypeId: string;
  assetTypeId: string;
  officialCalendarId?: string;
  dueDate: string; // ISO date
  requesterId?: string; // defaults to the signed-in employee
}

/**
 * Raise a real production ticket from an approved suggestion. The ticket is created
 * in the Creative Services Prio queue via the shared createTicket path (the same one
 * the Clips flow uses) — the Content & Comms Prio table is a read-only sync mirror, so
 * we can't write there. The created ticket's recId is stored back on the Social row.
 */
export async function raiseSocialRequestAction(id: string, input: RaiseSocialInput): Promise<SocialActionResult> {
  await requireSocialAccess();
  if (!input.eventTypeId) return { ok: false, error: 'Pick an event type.' };
  if (!input.assetTypeId) return { ok: false, error: 'Pick an asset type.' };
  if (!input.dueDate) return { ok: false, error: 'Pick a due date.' };

  const sugRes = await getSocialSuggestion(id);
  if (!sugRes.ok) return { ok: false, error: sugRes.error.message };
  const s = sugRes.data;
  if (s.creativeTicketId) return { ok: false, error: 'A ticket was already raised for this clip.' };

  const requesterId = input.requesterId?.trim() || (await getEmployeeForSession())?.airtableId;
  if (!requesterId) return { ok: false, error: 'No requester — pick who is requesting this ticket.' };

  // Project/Program is capped at 40 chars (createTicket invariant).
  const title = (s.title ?? 'Social clip').trim().slice(0, 40);
  const brief = [s.notes, s.captions ? `Caption: ${s.captions}` : '']
    .filter(Boolean)
    .join('\n\n') || 'Social clip from the content portal.';

  const res = await createTicket({
    requesterId,
    title,
    teamServiceLevel: 'Video Team - Non Campaign',
    typeOfRequest: 'Video',
    eventTypeId: input.eventTypeId,
    assetTypeId: input.assetTypeId,
    officialCalendarId: input.officialCalendarId ?? '',
    authorIds: [],
    creativeBrief: brief,
    dueDate: input.dueDate,
    sourceLinks: s.clipSourceUrl ?? undefined,
  });
  if (!res.ok || !res.ticketId) return { ok: false, error: res.error ?? 'Failed to create the ticket.' };

  const stamp = await markSocialTicketRaised(id, res.ticketId);
  if (!stamp.ok) {
    // The ticket exists but we couldn't stamp it back — surface so it isn't silently lost.
    return { ok: false, error: `Ticket created, but couldn't update the clip: ${stamp.error.message}` };
  }

  revalidatePath('/social');
  return { ok: true };
}
