// Resolve a ticket's Airtable recId regardless of the active TICKETS_BACKEND.
//
// createTicket returns the backend's native id: an Airtable recId when
// TICKETS_BACKEND=airtable, or a Postgres UUID when =postgres. Airtable link fields
// only accept recIds, so anything that needs to link a clip/mirror to a ticket must go
// through here. On the Postgres backend the recId only exists once the outbox drainer
// (lib/airtable/push.ts) has mirrored the ticket and stamped ticket.airtableId — until
// then this returns null and the caller should defer (the reconcile retries later).

import { prisma } from '@/lib/prisma';
import { TICKETS_BACKEND } from './backend';

export async function ticketAirtableId(ticketId: string): Promise<string | null> {
  if (!ticketId) return null;
  if (TICKETS_BACKEND !== 'postgres') return ticketId; // already an Airtable recId
  const t = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { airtableId: true } });
  return t?.airtableId ?? null;
}
