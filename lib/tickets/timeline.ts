// Production-timeline math — client-safe, NO server/Prisma imports (mirrors constants.ts).
// Turns a ticket's TicketEvent history (already fetched by data.postgres.ts) into
// per-stage durations and studio-wide bottleneck/average rollups.

import type { TicketEventRow } from './data.postgres';

// Same 4-bucket grouping already used for capacity math (components/ui/FunnelCapacity.tsx)
// — reused here rather than inventing a third taxonomy on top of the raw ticket_status enum.
export const FUNNEL_BUCKETS = [
  { key: 'requested', label: 'Requested', statuses: ['Backlog', 'To Do', 'Request on Hold'] },
  { key: 'production', label: 'In production', statuses: ['In Progress', 'In Revision'] },
  { key: 'review', label: 'In review', statuses: ['Review', 'Approved'] },
  { key: 'published', label: 'Published', statuses: ['Done', 'Shipping'] },
] as const;

export type FunnelBucketKey = (typeof FUNNEL_BUCKETS)[number]['key'];

function bucketOf(status: string | null): FunnelBucketKey | null {
  if (!status) return null;
  const bucket = FUNNEL_BUCKETS.find((b) => (b.statuses as readonly string[]).includes(status));
  return bucket?.key ?? null;
}

const MS_PER_DAY = 86_400_000;
const daysBetween = (from: string, to: string) => (new Date(to).getTime() - new Date(from).getTime()) / MS_PER_DAY;

export interface StageSpan {
  status: string;
  enteredAt: string;
  exitedAt: string | null; // null = still in this stage
  days: number;
  actor: string | null;
  note: string | null;
}

/** Walks a ticket's ordered TicketEvent history into stage spans — how long it sat in
 *  each ticket_status. The creation event (always written, see write.postgres.ts) anchors
 *  span 0; an empty `events` array only happens on legacy pre-audit-trail rows. */
export function buildStageHistory(events: TicketEventRow[]): StageSpan[] {
  const now = new Date().toISOString();
  return events.map((e, i) => {
    const next = events[i + 1];
    const exitedAt = next ? next.createdAt : null;
    return {
      status: e.toState,
      enteredAt: e.createdAt,
      exitedAt,
      days: daysBetween(e.createdAt, exitedAt ?? now),
      actor: e.actor,
      note: e.note,
    };
  });
}

/** "3.2d" for anything ≥ 1 day, "6h" for same-day moves — a duration too short to read
 *  as "0.1d" on a bottleneck list. */
export function formatDays(days: number): string {
  if (days < 1) return `${Math.max(Math.round(days * 24), 0)}h`;
  return `${days.toFixed(1)}d`;
}

export interface TimelineTicket {
  id: string;
  title: string;
  eventType: string | null;
  ticketStatus: string | null;
  createdAt: string;
  events: TicketEventRow[];
}

export interface TicketTimelineRow {
  id: string;
  title: string;
  eventType: string | null;
  ticketStatus: string;
  currentStageEnteredAt: string;
  daysInCurrentStage: number;
  totalDays: number;
  /** Done or Shipping — the two ticket_status values FunnelCapacity buckets as "Published". */
  completed: boolean;
  perBucketDays: Partial<Record<FunnelBucketKey, number>>;
}

/** Turns a ticket + its event history into one timeline row. Returns null for "Won't Do"
 *  tickets — cancelled work shouldn't count toward "how long does production take"
 *  (same exclusion FunnelCapacity already makes for capacity math). */
export function toTimelineRow(t: TimelineTicket): TicketTimelineRow | null {
  if (!t.ticketStatus || t.ticketStatus === "Won't Do") return null;
  const now = new Date().toISOString();
  const spans = buildStageHistory(t.events);
  const last = spans[spans.length - 1];
  const completed = t.ticketStatus === 'Done' || t.ticketStatus === 'Shipping';

  const perBucketDays: Partial<Record<FunnelBucketKey, number>> = {};
  for (const span of spans) {
    const key = bucketOf(span.status);
    if (!key) continue;
    perBucketDays[key] = (perBucketDays[key] ?? 0) + span.days;
  }

  return {
    id: t.id,
    title: t.title,
    eventType: t.eventType,
    ticketStatus: t.ticketStatus,
    currentStageEnteredAt: last?.enteredAt ?? t.createdAt,
    daysInCurrentStage: last ? last.days : daysBetween(t.createdAt, now),
    totalDays: daysBetween(t.createdAt, completed ? (last?.exitedAt ?? now) : now),
    completed,
    perBucketDays,
  };
}

export interface TimelineSummary {
  avgTotalDays: number | null;
  avgDaysByBucket: Partial<Record<FunnelBucketKey, number>>;
  /** Not-yet-complete tickets, most-delayed-in-current-stage first. */
  inFlight: TicketTimelineRow[];
  completedCount: number;
}

/** Aggregates a set of timeline rows into the headline numbers for /studio/timeline:
 *  average Requested→Published, average days per funnel stage, and the bottleneck
 *  ranking of what's currently stuck and for how long. */
export function summarizeTimelines(rows: TicketTimelineRow[]): TimelineSummary {
  const completed = rows.filter((r) => r.completed);
  const inFlight = rows.filter((r) => !r.completed).sort((a, b) => b.daysInCurrentStage - a.daysInCurrentStage);

  const avgTotalDays = completed.length
    ? completed.reduce((sum, r) => sum + r.totalDays, 0) / completed.length
    : null;

  const avgDaysByBucket: Partial<Record<FunnelBucketKey, number>> = {};
  for (const bucket of FUNNEL_BUCKETS) {
    // Only average over tickets that actually passed through this bucket — a ticket
    // that skipped "In Revision" shouldn't drag its average toward 0.
    const withBucket = completed.filter((r) => r.perBucketDays[bucket.key] != null);
    if (!withBucket.length) continue;
    avgDaysByBucket[bucket.key] = withBucket.reduce((sum, r) => sum + (r.perBucketDays[bucket.key] ?? 0), 0) / withBucket.length;
  }

  return { avgTotalDays, avgDaysByBucket, inFlight, completedCount: completed.length };
}
