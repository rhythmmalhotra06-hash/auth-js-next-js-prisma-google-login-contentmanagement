// Client-safe ticket constants — NO server/Prisma imports, so client components
// can import these without dragging `pg` into the browser bundle.

// Editor-owned ticket_status axis — live enum values (RECONCILIATION.md).
export const TICKET_STATUSES = [
  'Backlog', 'To Do', 'In Progress', 'Review', 'In Revision',
  'Approved', 'Done', "Won't Do", 'Shipping', 'Request on Hold',
] as const;

// Manager-owned prio_status axis — live enum values (RECONCILIATION.md).
export const PRIO_STATUSES = [
  'New Request', 'To be reviewed by Vishen', 'In Queue',
  'Pending Information/Brief Not Clear', 'Rejected - No need to work', 'Assigned',
] as const;

// Decision lock — states that require an approved approval before a ticket may
// enter them (Ziflow pattern). Enforced in updateTicketStatus.
export const GATED_STATUSES = ['Shipping'] as const;

// Asset versions stacked under a ticket (Air pattern: raw → final).
export const ASSET_KINDS = ['raw', 'final'] as const;
