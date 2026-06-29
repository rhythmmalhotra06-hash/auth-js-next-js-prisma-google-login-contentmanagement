// Studio (founder view) data — pure selectors over the existing Airtable-direct
// data layer. No new Airtable reads beyond loadStudio()'s single parallel fetch;
// everything else derives from the loaded sets. See plans/vishen-studio-founder-view.md.

import { getQueueTickets, getRecentShipped, type QueueTicket } from '@/lib/tickets/data';
import { getTicketMetrics, asOf, type TicketMetrics } from '@/lib/metrics/snapshot';
import { listShoots, SHOOT_STATUS, type ShootRow } from '@/lib/shoots/repository';
import { listMediaSources, type MediaSource } from '@/lib/media/repository';

// Re-export the client-safe display helpers so server callers can import from here.
export { starString, shortDate } from '@/lib/studio/format';

/** Prio Status value that marks a record as waiting on Vishen's review/sign-off. */
export const REVIEW_PRIO = 'To be reviewed by Vishen';

export interface StudioData {
  active: QueueTicket[];
  recentShipped: QueueTicket[];
  metrics: TicketMetrics | null;
  shoots: ShootRow[];
  media: MediaSource[];
}

/** Single parallel fetch shared by the landing + every sub-route. */
export async function loadStudio(): Promise<StudioData> {
  const [active, recentShipped, metrics, shootsRes, mediaRes] = await Promise.all([
    getQueueTickets(),
    getRecentShipped(12),
    getTicketMetrics(),
    listShoots(200),
    listMediaSources(100),
  ]);
  return {
    active,
    recentShipped,
    metrics,
    shoots: shootsRes.ok ? shootsRes.data : [],
    media: mediaRes.ok ? mediaRes.data : [],
  };
}

// ── Review queue (the sign-off hero) ─────────────────────────────────────────

/** Records waiting on Vishen's sign-off (Prio Status = "To be reviewed by Vishen"). */
export function getReviewQueue(active: QueueTicket[]): QueueTicket[] {
  return active.filter((t) => t.prioStatus === REVIEW_PRIO);
}

/** Serializable row for the client review components (sign-off hero + table). */
export interface ReviewItem {
  id: string;
  title: string;
  event: string | null;
  score: string | null; // priority score (formula)
  rank: number | null; // manual priority rank (stars)
}

export function toReviewItem(t: QueueTicket): ReviewItem {
  return { id: t.id, title: t.title, event: t.eventType, score: t.priorityScore, rank: t.queueRank };
}

/** Serializable row for the priority-ranking client component. */
export interface RankItem {
  id: string;
  title: string;
  event: string | null;
  assetType: string | null;
  score: string | null;
  rank: number | null;
}

export function toRankItem(t: QueueTicket): RankItem {
  return { id: t.id, title: t.title, event: t.eventType, assetType: t.assetType, score: t.priorityScore, rank: t.queueRank };
}

// ── Pulse ────────────────────────────────────────────────────────────────────

export interface Pulse {
  inFlight: number;
  inProduction: number;
  awaiting: number;
  shippedAll: number | null;
  asOf: string | null;
}

/** Glance-only rollups over the active set + the nightly all-time Shipped snapshot. */
export function pulseCounts(active: QueueTicket[], metrics: TicketMetrics | null): Pulse {
  return {
    // In flight = everything active except items already in the Shipping handoff.
    inFlight: active.filter((t) => t.ticketStatus !== 'Shipping').length,
    inProduction: active.filter((t) => t.ticketStatus === 'In Progress').length,
    awaiting: active.filter((t) => t.ticketStatus === 'Review' || t.ticketStatus === 'In Revision').length,
    shippedAll: metrics ? metrics.shipped : null,
    asOf: metrics ? asOf(metrics.computedAt) : null,
  };
}

// ── Launches (grouped by the event each ticket serves) ───────────────────────

export type Bucket = 'ship' | 'rev' | 'prod' | 'todo';

/** Map a ticket's status into one of the four launch-meter buckets. */
export function statusBucket(status: string | null): Bucket {
  if (status === 'Done' || status === 'Shipping') return 'ship';
  if (status === 'Review' || status === 'In Revision' || status === 'Approved') return 'rev';
  if (status === 'In Progress') return 'prod';
  return 'todo'; // Backlog, To Do, Request on Hold, or unset
}

export interface Launch {
  event: string;
  slug: string;
  total: number;
  ship: number;
  rev: number;
  prod: number;
  todo: number;
  due: string | null; // soonest upcoming due date among the launch's active work
}

/** URL-safe slug for the launch drill route. */
export function launchSlug(event: string): string {
  return event.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'launch';
}

/**
 * Group active work by event. Shipped-per-launch is augmented from the loaded
 * recent-shipped set only (we never scan the ~9k Done history) — so the "shipped"
 * bar reflects recent ships, not the full lifetime. Untagged tickets (no event)
 * are intentionally excluded here and surfaced in At Risk instead.
 */
export function getLaunches(active: QueueTicket[], recentShipped: QueueTicket[] = []): Launch[] {
  const map = new Map<string, Launch>();
  const ensure = (event: string): Launch => {
    let l = map.get(event);
    if (!l) {
      l = { event, slug: launchSlug(event), total: 0, ship: 0, rev: 0, prod: 0, todo: 0, due: null };
      map.set(event, l);
    }
    return l;
  };

  for (const t of active) {
    if (!t.eventType) continue;
    const l = ensure(t.eventType);
    l.total++;
    l[statusBucket(t.ticketStatus)]++;
    if (t.dueDate && (!l.due || t.dueDate < l.due)) l.due = t.dueDate;
  }
  // Augment shipped only for launches that already have active work.
  for (const t of recentShipped) {
    if (!t.eventType || !map.has(t.eventType)) continue;
    const l = ensure(t.eventType);
    l.total++;
    l.ship++;
  }

  // Most live work first (review + production + todo), ties broken by soonest due.
  return [...map.values()].sort((a, b) => {
    const live = (b.rev + b.prod + b.todo) - (a.rev + a.prod + a.todo);
    if (live !== 0) return live;
    return (a.due ?? '9999').localeCompare(b.due ?? '9999');
  });
}

/** Active + recent-shipped tickets for one launch, by slug (for the drill-down). */
export function launchTickets(slug: string, active: QueueTicket[], recentShipped: QueueTicket[] = []): {
  launch: Launch | null;
  tickets: QueueTicket[];
} {
  const launches = getLaunches(active, recentShipped);
  const launch = launches.find((l) => l.slug === slug) ?? null;
  if (!launch) return { launch: null, tickets: [] };
  const match = (t: QueueTicket) => t.eventType === launch.event;
  const tickets = [...active.filter(match), ...recentShipped.filter(match)];
  return { launch, tickets };
}

// ── At risk (founder-decision items only) ────────────────────────────────────

export type RiskKind = 'shoot' | 'untagged' | 'aged';

export interface RiskItem {
  id: string;
  kind: RiskKind;
  icon: 'video' | 'calendar' | 'clock';
  text: string;
  age: string;
  fixLabel: string;
  href: string;
}

const DAY = 86_400_000;

/** Whole days between an ISO date and now (negative = in the future). */
function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY);
}

/**
 * Founder-decision items only (not every stalled ticket — the team clears those):
 *  1. a filmed/to-film shoot with no post-production ticket,
 *  2. an untagged ticket the priority score can't read (no event link),
 *  3. active work aged past its due date.
 * Capped so the founder view stays a short decision list, not a backlog dump.
 */
export function getAtRisk(active: QueueTicket[], shoots: ShootRow[], cap = 50): RiskItem[] {
  const items: RiskItem[] = [];

  // 1. Shoots with no post-production ticket.
  for (const s of shoots) {
    if (s.ticketCount > 0) continue;
    if (s.status !== SHOOT_STATUS.toFilm && s.status !== SHOOT_STATUS.filmed) continue;
    const d = daysAgo(s.filmingDate ?? s.createdTime);
    items.push({
      id: s.id,
      kind: 'shoot',
      icon: 'video',
      text: `${s.title ?? 'Shoot'} — no post-production ticket`,
      age: d != null && d >= 0 ? `${d} days idle` : 'awaiting edit',
      fixLabel: 'Assign',
      href: `/shoots/${s.id}`,
    });
  }

  // 2. Untagged — no event link, so it can't be grouped or scored.
  for (const t of active) {
    if (t.eventType) continue;
    items.push({
      id: t.id,
      kind: 'untagged',
      icon: 'calendar',
      text: `${t.title} — no event link, the score can't read it`,
      age: 'untagged',
      fixLabel: 'Tag',
      href: `/tickets/${t.id}`,
    });
  }

  // 3. Aged past its due date.
  for (const t of active) {
    if (!t.eventType) continue; // already surfaced as untagged
    const overdue = daysAgo(t.dueDate);
    if (overdue == null || overdue <= 0) continue;
    items.push({
      id: t.id,
      kind: 'aged',
      icon: 'clock',
      text: `${t.title} — past its due date`,
      age: `${overdue} days overdue`,
      fixLabel: 'Review',
      href: `/tickets/${t.id}`,
    });
  }

  // Shoots first, then most-overdue, then untagged; cap for the founder view.
  const order: Record<RiskKind, number> = { shoot: 0, aged: 1, untagged: 2 };
  items.sort((a, b) => order[a.kind] - order[b.kind]);
  return items.slice(0, cap);
}

// ── Clips (Vishen's own content → suggested clips) ───────────────────────────

export function getVishenMedia(media: MediaSource[]): MediaSource[] {
  return media.filter((m) => `${m.guestShow ?? ''} ${m.title ?? ''}`.toLowerCase().includes('vishen'));
}
