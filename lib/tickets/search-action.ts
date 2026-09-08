'use server';

// Server-side ticket search for the queue toolbar.
//
// Every grid drops Done / Won't Do / Published server-side, and QueueTable's search box
// only filters the rows already on the page — so a delivered ticket was findable nowhere
// except /stakeholder?archive=1. Titus hit that on 2026-09-08 ("why can't I find the
// ticket?"; it was Done). This is the escape hatch: status-agnostic, bounded, and read
// only when the on-page filter comes up short.

import { searchTickets, type QueueTicket } from '@/lib/tickets/data';
import { auth } from '@/lib/auth';

export interface TicketSearchResult {
  ok: boolean;
  tickets?: Pick<QueueTicket, 'id' | 'title' | 'ticketStatus' | 'prioStatus' | 'assignee'>[];
  error?: string;
}

export async function searchAllTickets(query: string): Promise<TicketSearchResult> {
  // Signed-in only. Server actions post to the page route, so middleware already covers
  // this, but the check is cheap and makes the boundary explicit.
  const session = await auth();
  if (!session?.user?.email) return { ok: false, error: 'Not signed in' };

  const q = query.trim();
  if (q.length < 3) return { ok: true, tickets: [] };

  try {
    const rows = await searchTickets(q);
    return {
      ok: true,
      tickets: rows.map((t) => ({
        id: t.id,
        title: t.title,
        ticketStatus: t.ticketStatus,
        prioStatus: t.prioStatus,
        assignee: t.assignee,
      })),
    };
  } catch (e) {
    console.error('[tickets] searchAllTickets failed', e);
    return { ok: false, error: 'Search failed' };
  }
}
