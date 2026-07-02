'use server';

import { createTicketRow } from '@/lib/tickets/write';
import { resolveAutoAssignee } from '@/lib/tickets/auto-assign';
import { notifyAssignment } from '@/lib/notify/triggers';

export interface CreateTicketInput {
  requesterId: string; // Airtable recId (Employees)
  title: string; // Project/Program (≤40)
  teamServiceLevel: string;
  typeOfRequest: string; // Video | Design
  eventTypeId: string; // Airtable recId
  assetTypeId: string; // Airtable recId
  officialCalendarId: string; // Airtable recId (optional)
  authorIds: string[]; // Airtable recIds
  shootIds?: string[]; // Airtable recIds (📺 Shoots & Raw Assets) — optional
  creativeBrief: string;
  cta?: string;
  dueDate: string; // ISO date
  sourceLinks?: string;
  downloadLink?: string; // editor download link (e.g. Dropbox) — E9.1
  notes?: string;
}

export interface CreateTicketResult {
  ok: boolean;
  ticketId?: string;
  error?: string;
  assignedCreativeId?: string; // E9.6: set when auto-assigned to the sole preferred editor (seam for E9.4 DM)
}

const REQUIRED: [keyof CreateTicketInput, string][] = [
  ['requesterId', 'Requested By'],
  ['title', 'Project/Program'],
  ['teamServiceLevel', 'Team/Service Level'],
  ['typeOfRequest', 'Type of Request'],
  ['eventTypeId', 'Event Type'],
  ['assetTypeId', 'Asset Type'],
  // Official Calendar is optional.
  ['creativeBrief', 'Creative Brief'],
  ['dueDate', 'Due date'],
];

// Airtable-direct: write the new request straight to the Prio Requests table. The
// intake form already serves reference options as Airtable recIds, so link fields
// are set directly — no Postgres, no reference resolution, no scoring (Airtable's
// SCORE formula handles ranking).
export async function createTicket(input: CreateTicketInput): Promise<CreateTicketResult> {
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

  // E9.6: auto-assign the sole preferred editor for this asset type (else leave for
  // the manager). Failure to resolve must never block ticket creation.
  let autoAssignee: string | null = null;
  try {
    autoAssignee = await resolveAutoAssignee(input.assetTypeId);
  } catch {
    autoAssignee = null;
  }

  const res = await createTicketRow({
    title: input.title.trim(),
    creativeBrief: input.creativeBrief.trim(),
    cta: input.cta?.trim() || null,
    dueDate: input.dueDate.slice(0, 10),
    typeOfRequest: input.typeOfRequest,
    teamServiceLevel: input.teamServiceLevel,
    notes: input.notes?.trim() || null,
    sourceLinks: input.sourceLinks?.trim() || null,
    downloadLink: input.downloadLink?.trim() || null,
    eventTypeRecId: input.eventTypeId,
    assetTypeRecId: input.assetTypeId,
    requesterRecId: input.requesterId,
    officialCalendarRecId: input.officialCalendarId || null,
    authorRecIds: input.authorIds ?? [],
    shootRecIds: input.shootIds ?? [],
    assignedCreativeRecId: autoAssignee,
    ticketStatus: autoAssignee ? 'To Do' : undefined,
  });

  if (!res.ok) return { ok: false, error: res.error };
  // E9.4 — DM the auto-assigned editor (best-effort; never blocks ticket creation).
  if (autoAssignee) await notifyAssignment(res.id, autoAssignee);
  return { ok: true, ticketId: res.id, assignedCreativeId: autoAssignee ?? undefined };
}
