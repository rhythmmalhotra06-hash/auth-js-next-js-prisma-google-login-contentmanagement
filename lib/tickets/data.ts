// Ticket read dispatcher — picks the Airtable-direct or Postgres implementation by
// TICKETS_BACKEND. Both modules export identical shapes/signatures, so every caller
// (`@/lib/tickets/data`) is untouched by the switch. See lib/tickets/backend.ts.

import { TICKETS_BACKEND } from './backend';
import * as airtable from './data.airtable';
import * as postgres from './data.postgres';

// Types are structurally identical in both impls; re-export from the Postgres one.
export type {
  QueueTicket,
  EmployeeOption,
  AssigneeOption,
  RequestScope,
  TicketEventRow,
  ApprovalRow,
  AssetRow,
  TicketDetail,
} from './data.postgres';

const impl = TICKETS_BACKEND === 'postgres' ? postgres : airtable;

export const getActiveEmployees = impl.getActiveEmployees;
export const getEligibleAssignees = impl.getEligibleAssignees;
export const getQueueTickets = impl.getQueueTickets;
export const getRecentShipped = impl.getRecentShipped;
export const getMyRequests = impl.getMyRequests;
export const getRequestsForScope = impl.getRequestsForScope;
export const getTicketDetail = impl.getTicketDetail;
