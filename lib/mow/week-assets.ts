// What each owner delivered this week — artboard `4a`, `/performance/week/assets`.
//
// Decision U6: this lists EVERY owner's work, grouped by owner, with no personalisation. It is
// the meeting's roll-up, not a personal queue — "who made what this week" is the question Vision
// could never answer, and it is the whole reason the surface exists.
//
// It IS a ticket list, so the mandated five columns apply in full (DESIGN_SYSTEM §0.3):
// Title · Priority · Assigned · Ticket Status · Priority Status. The day-by-day table on the pack
// is a calendar and is deliberately exempt; this one is not.
//
// ── The honest bit: "delivered this week" is an approximation, and the UI says so ──────────────
//
// There is no completion timestamp in Postgres. `publishedAt` exists as an Airtable field but was
// never mirrored into a column, so the closest available signal is "the ticket is in a terminal
// status AND our sync last wrote it during the week". `updatedAt` moves on ANY edit, so a ticket
// finished in August whose brief was tweaked on Tuesday appears here.
//
// That is a real limitation and it is surfaced rather than hidden. Mirroring `publishedAt` is the
// fix; it needs a migration and a sync-map change, which is not a thing to do three days before a
// founder demo.

import { prisma } from '@/lib/prisma';
import { weekBounds, weekStartOf, toYmd } from './week';

/**
 * Statuses that count as delivered.
 *
 * `Review` is deliberately EXCLUDED: 94 tickets sit there, and counting work as delivered while a
 * reviewer still has it is exactly the kind of flattery that makes a report untrustworthy.
 */
const DELIVERED_STATUSES = ['Done', 'Approved', 'Published', 'Shipping'];

export interface DeliveredAsset {
  id: string;
  title: string;
  /** The mandated Priority column. Null renders as a gap, never as 0. */
  priorityScore: number | null;
  assignee: string | null;
  /** The credited person has left the roster — the credit stands, it is just marked. */
  assigneeExTeam: boolean;
  ticketStatus: string | null;
  prioStatus: string | null;
  assetType: string | null;
  eventType: string | null;
  /** Where the output actually is. Null on ~half of them — a named gap, not a blank (U8). */
  deliveryUrl: string | null;
  deliveryLabel: string | null;
}

export interface OwnerGroup {
  owner: string;
  exTeam: boolean;
  assets: DeliveredAsset[];
  /** The pillar-ish label for the group row: the asset types this owner worked in. */
  pillars: string[];
}

export interface WeekAssets {
  weekStart: string;
  weekEnd: string;
  groups: OwnerGroup[];
  total: number;
  /** Delivered items with nowhere recorded to find the output. The nag on this page. */
  missingDelivery: number;
  /**
   * Distinct Priority Status values present.
   *
   * The design handoff flagged this column as possibly "122px of chrome" because the export
   * showed `In queue` on every row. On live data it has real variance — and 11 of 55 delivered
   * tickets still read `New Request`, meaning work shipped while the manager axis never moved.
   * That is worth seeing, so the column stays and the page says what it found.
   */
  prioStatusSpread: { value: string; count: number }[];
  asOf: string;
}

/** First non-empty delivery link, with a label saying which kind it is. */
function delivery(t: {
  final16x9: string | null;
  folder16x9: string | null;
  final9x16: string | null;
  final4x5: string | null;
  assetFolderLink: string | null;
  downloadLink: string | null;
}): { url: string | null; label: string | null } {
  const candidates: [string | null, string][] = [
    [t.final16x9, 'Final 16:9'],
    [t.final9x16, 'Final 9:16'],
    [t.final4x5, 'Final 4:5'],
    [t.folder16x9, 'Folder 16:9'],
    [t.assetFolderLink, 'Asset folder'],
    [t.downloadLink, 'Download'],
  ];
  for (const [url, label] of candidates) {
    if (url && url.trim()) return { url: url.trim(), label };
  }
  return { url: null, label: null };
}

export async function getWeekAssets(anchor: Date): Promise<WeekAssets> {
  const { start, end } = weekBounds(weekStartOf(anchor));
  // `end` is the Sunday at 00:00; the week runs to the end of that day.
  const endExclusive = new Date(end.getTime() + 86_400_000);

  const rows = await prisma.ticket.findMany({
    where: {
      ticketStatus: { in: DELIVERED_STATUSES },
      updatedAt: { gte: start, lt: endExclusive },
    },
    select: {
      id: true, title: true, priorityScore: true, ticketStatus: true, prioStatus: true,
      assigneeName: true,
      assignee: { select: { name: true, active: true } },
      assetType: { select: { name: true } },
      eventType: { select: { name: true } },
      final16x9: true, folder16x9: true, final9x16: true, final4x5: true,
      assetFolderLink: true, downloadLink: true,
    },
    orderBy: [{ priorityScore: 'desc' }, { title: 'asc' }],
  });

  const byOwner = new Map<string, { exTeam: boolean; assets: DeliveredAsset[] }>();
  let missingDelivery = 0;
  const prioCounts = new Map<string, number>();

  for (const t of rows) {
    // Same credit rule as the queue: prefer the live employee row, fall back to the snapshot so a
    // ticket still names its creative after the person leaves.
    const name = t.assignee?.name ?? t.assigneeName ?? null;
    const exTeam = !t.assignee && !!t.assigneeName ? true : t.assignee ? !t.assignee.active : false;
    const key = name ?? '(unassigned)';

    const d = delivery(t);
    if (!d.url) missingDelivery++;
    prioCounts.set(t.prioStatus ?? '(not set)', (prioCounts.get(t.prioStatus ?? '(not set)') ?? 0) + 1);

    const bucket = byOwner.get(key) ?? { exTeam, assets: [] };
    bucket.assets.push({
      id: t.id,
      title: t.title || '(untitled)',
      priorityScore: t.priorityScore === null ? null : Number(t.priorityScore),
      assignee: name,
      assigneeExTeam: exTeam,
      ticketStatus: t.ticketStatus,
      prioStatus: t.prioStatus,
      assetType: t.assetType?.name ?? null,
      eventType: t.eventType?.name ?? null,
      deliveryUrl: d.url,
      deliveryLabel: d.label,
    });
    byOwner.set(key, bucket);
  }

  const groups: OwnerGroup[] = [...byOwner.entries()]
    .map(([owner, v]) => ({
      owner,
      exTeam: v.exTeam,
      assets: v.assets,
      pillars: [...new Set(v.assets.map((a) => a.assetType).filter((x): x is string => !!x))].slice(0, 3),
    }))
    // Busiest first, but unassigned always last: it is a bucket, not a person, and leading with it
    // would read as the team's biggest contributor.
    .sort((a, b) =>
      a.owner === '(unassigned)' ? 1 : b.owner === '(unassigned)' ? -1 : b.assets.length - a.assets.length,
    );

  return {
    weekStart: toYmd(start),
    weekEnd: toYmd(end),
    groups,
    total: rows.length,
    missingDelivery,
    prioStatusSpread: [...prioCounts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count),
    asOf: new Date().toISOString(),
  };
}
