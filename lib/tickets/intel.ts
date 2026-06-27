// Lightweight, propose-only intelligence over the queue — computed from the
// fields we actually have (due date, status, assignee). No fabricated metrics.
import type { QueueTicket } from '@/lib/tickets/data';

export function dueDays(due: string | null): number | null {
  if (!due) return null;
  const d = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  return Number.isNaN(d) ? null : d;
}

const isActive = (t: QueueTicket) => !['Done', "Won't Do"].includes(t.ticketStatus ?? '');

/** Active-ticket load per editor name. */
export function loadMap(tickets: QueueTicket[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tickets) if (isActive(t) && t.assignee) m.set(t.assignee, (m.get(t.assignee) ?? 0) + 1);
  return m;
}

export interface Risk { level: 'high' | 'med' | null; why: string[] }

export function riskOf(t: QueueTicket, load: Map<string, number>): Risk {
  if (!isActive(t)) return { level: null, why: [] };
  const why: string[] = [];
  let sev = 0;
  const d = dueDays(t.dueDate);
  if (d != null && d >= 0 && d <= 2 && !['Review', 'Approved'].includes(t.ticketStatus ?? '')) {
    why.push(`due in ${d}d, still ${(t.ticketStatus ?? 'open').toLowerCase()}`); sev += 2;
  }
  if (d != null && d < 0) { why.push('overdue'); sev += 2; }
  if (t.assignee && (load.get(t.assignee) ?? 0) >= 4 && (d == null || d <= 4)) {
    why.push(`${t.assignee} is at capacity`); sev += 1;
  }
  if (!t.assignee && d != null && d >= 0 && d <= 6) { why.push(`unassigned with ${d}d left`); sev += 2; }
  return { level: sev >= 2 ? 'high' : sev >= 1 ? 'med' : null, why };
}
