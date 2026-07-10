// Precomputed aggregate snapshots. Lifetime ticket counts (e.g. all-time Shipped)
// require scanning the whole ~10k-row Airtable ticket table — far too slow for a
// page load and uncomputable cheaply via the REST API (no server-side count). So a
// nightly job (POST /api/metrics/refresh) scans once and persists the tally to
// Postgres; dashboards read one cheap row via getTicketMetrics().

import { prisma } from '@/lib/prisma';
import { TICKETS } from '@/lib/airtable/field-map';
import { listAll } from '@/lib/airtable/rest';
import { TICKETS_BACKEND } from '@/lib/tickets/backend';

const STATUS_FIELD = TICKETS.fields.ticketStatus;
const SNAPSHOT_KEY = 'ticket_status_counts';

export interface TicketMetrics {
  total: number;
  byStatus: Record<string, number>;
  shipped: number; // count of the terminal "Done" status
  computedAt: string; // ISO timestamp of the last refresh
}

const statusName = (v: unknown): string => {
  if (typeof v === 'string') return v || '(none)';
  if (v && typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return '(none)';
};

// Tally status counts from Postgres — a cheap groupBy over the tickets table (used once
// TICKETS_BACKEND=postgres; no ~10k-row Airtable scan needed).
async function byStatusFromPg(): Promise<{ byStatus: Record<string, number>; total: number }> {
  const groups = await prisma.ticket.groupBy({ by: ['ticketStatus'], _count: { _all: true } });
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const g of groups) {
    const s = g.ticketStatus ?? '(none)';
    byStatus[s] = (byStatus[s] ?? 0) + g._count._all;
    total += g._count._all;
  }
  return { byStatus, total };
}

// Tally from the full Airtable ticket table (status field only). Pulls ~10k rows over ~100
// paced requests — background-only.
async function byStatusFromAirtable(): Promise<{ byStatus: Record<string, number>; total: number }> {
  const res = await listAll(TICKETS.baseId, TICKETS.tableId, { fields: [STATUS_FIELD] });
  if (!res.ok) throw new Error(`Airtable read failed: ${res.error.message}`);
  const byStatus: Record<string, number> = {};
  for (const rec of res.data) {
    const s = statusName((rec.fields as Record<string, unknown>)[STATUS_FIELD]);
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }
  return { byStatus, total: res.data.length };
}

/**
 * Tally lifetime ticket counts by status and persist the snapshot. Reads from Postgres
 * when tickets are PG-backed (cheap groupBy), else scans Airtable. Background-only.
 */
export async function refreshTicketMetrics(): Promise<TicketMetrics> {
  const { byStatus, total } = TICKETS_BACKEND === 'postgres' ? await byStatusFromPg() : await byStatusFromAirtable();
  const data = { total, byStatus, shipped: byStatus['Done'] ?? 0 };

  const row = await prisma.metricSnapshot.upsert({
    where: { key: SNAPSHOT_KEY },
    create: { key: SNAPSHOT_KEY, data },
    update: { data },
  });
  return { ...data, computedAt: row.computedAt.toISOString() };
}

/**
 * Cheap read of the latest ticket-status snapshot (one indexed row), or null if it
 * has never been computed / the DB is unreachable — callers hide the lifetime KPI.
 */
export async function getTicketMetrics(): Promise<TicketMetrics | null> {
  try {
    const row = await prisma.metricSnapshot.findUnique({ where: { key: SNAPSHOT_KEY } });
    if (!row) return null;
    const d = row.data as { total: number; byStatus: Record<string, number>; shipped: number };
    return { total: d.total, byStatus: d.byStatus, shipped: d.shipped, computedAt: row.computedAt.toISOString() };
  } catch {
    return null;
  }
}

/** Short "as of" label for KPI subtitles, e.g. "as of Jun 28". */
export function asOf(iso: string): string {
  const d = new Date(iso);
  return `as of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}
