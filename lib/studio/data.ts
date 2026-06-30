// Studio (founder view) data — pure selectors over the existing Airtable-direct
// data layer. No new Airtable reads beyond loadStudio()'s single parallel fetch;
// everything else derives from the loaded sets. See plans/vishen-studio-founder-view.md.

import { getQueueTickets, getRecentShipped, type QueueTicket } from '@/lib/tickets/data';
import { getTicketMetrics, asOf, type TicketMetrics } from '@/lib/metrics/snapshot';
import { listMediaSources, type MediaSource } from '@/lib/media/repository';
import { listShoots, SHOOT_STATUS, type ShootRow } from '@/lib/shoots/repository';
import { getScoringConfig } from '@/lib/scoring-config/repository';
import type { ScoringConfig } from '@/lib/scoring-config/config';

// Re-export the client-safe display helpers so server callers can import from here.
export { starString, shortDate } from '@/lib/studio/format';

/** Prio Status value that marks a record as waiting on Vishen's review/sign-off. */
export const REVIEW_PRIO = 'To be reviewed by Vishen';

export interface StudioData {
  active: QueueTicket[];
  recentShipped: QueueTicket[];
  metrics: TicketMetrics | null;
  media: MediaSource[];
  shoots: ShootRow[];
  scoringConfig: ScoringConfig;
}

/** Single parallel fetch shared by the landing + every sub-route. */
export async function loadStudio(): Promise<StudioData> {
  const [active, recentShipped, metrics, mediaRes, shootsRes, scoringConfig] = await Promise.all([
    getQueueTickets(),
    getRecentShipped(12),
    getTicketMetrics(),
    listMediaSources(100),
    listShoots(200),
    getScoringConfig(),
  ]);
  return {
    active,
    recentShipped,
    metrics,
    media: mediaRes.ok ? mediaRes.data : [],
    shoots: shootsRes.ok ? shootsRes.data : [],
    scoringConfig,
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

// ── Content review queue (work in Review / In Revision, grouped by status) ────

export interface ContentReviewItem {
  id: string;
  title: string;
  event: string | null;
  assetType: string | null;
  assignee: string | null;
  ticketStatus: string;
  rank: number | null;
  dueDate: string | null;
  folderUrl: string | null;
}

/** Tickets the team has put up for review — Ticket Status = "Review" or "In Revision". */
export function getContentReviewQueue(active: QueueTicket[]): ContentReviewItem[] {
  return active
    .filter((t) => t.ticketStatus === 'Review' || t.ticketStatus === 'In Revision')
    .map((t) => ({
      id: t.id,
      title: t.title,
      event: t.eventType,
      assetType: t.assetType,
      assignee: t.assignee,
      ticketStatus: t.ticketStatus ?? '—',
      rank: t.queueRank,
      dueDate: t.dueDate,
      folderUrl: t.folderUrl,
    }))
    // highest starred priority first
    .sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));
}

// ── Shoots awaiting Vishen's sign-off ────────────────────────────────────────

/** Shoots waiting on Vishen's approval (Filming Status = "Needs Vishen's Review"). */
export function getPendingShoots(shoots: ShootRow[]): ShootRow[] {
  return shoots.filter((s) => s.status === SHOOT_STATUS.needsReview);
}

/** Serializable row for the client shoot sign-off component. */
export interface ShootSignOffItem {
  id: string;
  title: string;
  format: string | null;
  filmingDate: string | null;
  filmingLocation: string | null;
  brief: string | null;
}

export function toShootSignOffItem(s: ShootRow): ShootSignOffItem {
  return {
    id: s.id,
    title: s.title ?? 'Untitled shoot',
    format: s.format,
    filmingDate: s.filmingDate,
    filmingLocation: s.filmingLocation,
    brief: s.brief,
  };
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

// ── Clips (Vishen's own content → suggested clips) ───────────────────────────

export function getVishenMedia(media: MediaSource[]): MediaSource[] {
  // Primary marker: rows synced from / written back to Vishen's Major Videos base carry a
  // Source Record ID. Keep the legacy "vishen" name match as a fallback for older rows.
  return media.filter(
    (m) => m.sourceRecordId != null || `${m.guestShow ?? ''} ${m.title ?? ''}`.toLowerCase().includes('vishen'),
  );
}
