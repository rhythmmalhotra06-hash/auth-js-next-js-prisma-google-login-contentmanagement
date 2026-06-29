// Lightweight, propose-only intelligence over the queue — computed from the
// fields we actually have (due date, status, assignee). No fabricated metrics.
// Capacity thresholds come from the admin-editable scoring config (lib/scoring-config);
// when no config is passed, DEFAULTS reproduce the original hardcoded behaviour.
import type { QueueTicket } from '@/lib/tickets/data';
import { type ScoringConfig, DEFAULTS, capacityFor, loadWeightFor } from '@/lib/scoring-config/config';

export function dueDays(due: string | null): number | null {
  if (!due) return null;
  const d = Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
  return Number.isNaN(d) ? null : d;
}

const isActive = (t: QueueTicket) => !['Done', "Won't Do"].includes(t.ticketStatus ?? '');

/** Active-ticket load per editor name. Weighted by event/asset type when a config is given. */
export function loadMap(tickets: QueueTicket[], cfg?: ScoringConfig): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tickets) {
    if (!isActive(t) || !t.assignee) continue;
    const w = cfg ? loadWeightFor(cfg, t.eventType, t.assetType) : 1;
    m.set(t.assignee, (m.get(t.assignee) ?? 0) + w);
  }
  return m;
}

export interface Risk { level: 'high' | 'med' | null; why: string[] }

export function riskOf(t: QueueTicket, load: Map<string, number>, cfg?: ScoringConfig): Risk {
  if (!isActive(t)) return { level: null, why: [] };
  const why: string[] = [];
  let sev = 0;
  const d = dueDays(t.dueDate);
  const capDays = cfg?.riskCapacityDays ?? DEFAULTS.riskCapacityDays;
  const cap = cfg ? capacityFor(cfg, t.assignee) : DEFAULTS.defaultCapacity;
  if (d != null && d >= 0 && d <= 2 && !['Review', 'Approved'].includes(t.ticketStatus ?? '')) {
    why.push(`due in ${d}d, still ${(t.ticketStatus ?? 'open').toLowerCase()}`); sev += 2;
  }
  if (d != null && d < 0) { why.push('overdue'); sev += 2; }
  if (t.assignee && (load.get(t.assignee) ?? 0) >= cap && (d == null || d <= capDays)) {
    why.push(`${t.assignee} is at capacity`); sev += 1;
  }
  if (!t.assignee && d != null && d >= 0 && d <= 6) { why.push(`unassigned with ${d}d left`); sev += 2; }
  return { level: sev >= 2 ? 'high' : sev >= 1 ? 'med' : null, why };
}
