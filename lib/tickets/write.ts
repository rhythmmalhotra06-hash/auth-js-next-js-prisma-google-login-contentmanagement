// Ticket write dispatcher — Airtable-direct or Postgres (+ outbox) by TICKETS_BACKEND.
// Both impls expose the same updateTicket / createTicketRow surface, so the action
// files (`app/intake`, `app/tickets/[id]`, `app/studio`) are untouched by the switch.

import { TICKETS_BACKEND } from './backend';
import * as airtable from './write.airtable';
import * as postgres from './write.postgres';

export type { TicketPatch, WriteResult, CreateTicketRowInput } from './write.postgres';

const impl = TICKETS_BACKEND === 'postgres' ? postgres : airtable;

export const updateTicket = impl.updateTicket;
export const createTicketRow = impl.createTicketRow;
