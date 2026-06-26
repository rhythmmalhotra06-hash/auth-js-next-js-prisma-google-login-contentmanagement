// Pure mappers: Content-Management ticket → BlinkLife payloads. No DB or network
// here (mirrors lib/airtable/push-map.ts) so the shapes are unit-testable and the
// drainer stays thin.

import { ticketUrl } from './identity';

/** The ticket fields the task mapper needs (loaded by the drainer). */
export interface TicketForTask {
  id: string;
  title: string;
  creativeBrief: string | null;
  cta: string | null;
  dueDate: Date | null;
  prioStatus: string | null;
  queueRank: number | null;
  typeOfRequest: string | null;
  assigneeName: string | null;
  eventTypeName: string | null;
  assetTypeName: string | null;
}

export interface BlinkLifeTask {
  title: string;
  description: string;
  priority?: number; // 1=Critical … 4=Low (omitted when we have no confident signal)
  due_date?: string; // full ISO datetime — BlinkLife validates this as a datetime, not a date
}

// BlinkLife's create_task validates due_date as an ISO *datetime*, so send the
// full timestamp (ticket.dueDate is a date, i.e. midnight UTC) rather than YYYY-MM-DD.
const isoDate = (d: Date | null): string | undefined => (d ? d.toISOString() : undefined);

/**
 * Map manager intent → BlinkLife priority (1=Critical … 4=Low). We lead with
 * queueRank (the manager's explicit ordering); fall back to prioStatus; otherwise
 * omit priority entirely ("no priority is fine" per the BlinkLife API). Thresholds
 * are deliberately coarse and easy to retune.
 */
export function mapPriority(t: Pick<TicketForTask, 'queueRank' | 'prioStatus'>): number | undefined {
  if (t.queueRank != null) {
    if (t.queueRank <= 3) return 1;
    if (t.queueRank <= 10) return 2;
    if (t.queueRank <= 25) return 3;
    return 4;
  }
  if (t.prioStatus === 'To be reviewed by Vishen') return 2;
  return undefined;
}

/** Build the BlinkLife task payload for a ticket (shared-project MVP). */
export function ticketToTask(t: TicketForTask): BlinkLifeTask {
  // Prefix with the editor so the shared project stays readable without per-user routing.
  const title = t.assigneeName ? `[${t.assigneeName}] ${t.title}` : t.title;

  const lines: string[] = [];
  if (t.creativeBrief) lines.push(t.creativeBrief.trim());
  const meta: string[] = [];
  if (t.eventTypeName) meta.push(`Event: ${t.eventTypeName}`);
  if (t.assetTypeName) meta.push(`Asset: ${t.assetTypeName}`);
  if (t.typeOfRequest) meta.push(`Type: ${t.typeOfRequest}`);
  if (t.cta) meta.push(`CTA: ${t.cta}`);
  if (meta.length) lines.push(meta.join(' · '));
  lines.push(`↗ Open in portal: ${ticketUrl(t.id)}`);

  const priority = mapPriority(t);
  return {
    title,
    description: lines.join('\n\n'),
    ...(priority != null ? { priority } : {}),
    ...(isoDate(t.dueDate) ? { due_date: isoDate(t.dueDate) } : {}),
  };
}

/** Editor ticket_status values that mean "the task is finished" in BlinkLife. */
export const DONE_TICKET_STATUSES = new Set(['Done', 'Shipping', 'Published']);
/** ticket_status / prio_status values that mean "don't mirror this at all". */
export const SKIP_PRIO_STATUSES = new Set(['New Request', 'Rejected - No need to work']);
export const SKIP_TICKET_STATUSES = new Set(["Won't Do"]);

// ── Vishen weekly review ─────────────────────────────────────────────────────

export interface ShippedAsset {
  editor: string;
  title: string;
  assetType: string | null;
  distributionUrl: string | null;
  metrics: { metric: string; value: string | null }[];
}

/** Render the "Content Review" page markdown from this week's shipped assets. */
export function renderReviewPage(weekLabel: string, shipped: ShippedAsset[]): string {
  const byEditor = new Map<string, ShippedAsset[]>();
  for (const a of shipped) {
    const list = byEditor.get(a.editor) ?? [];
    list.push(a);
    byEditor.set(a.editor, list);
  }

  const out: string[] = [`# Content Review — ${weekLabel}`, ''];
  out.push(`**${shipped.length}** asset${shipped.length === 1 ? '' : 's'} shipped across **${byEditor.size}** editor${byEditor.size === 1 ? '' : 's'}.`, '');

  if (shipped.length === 0) {
    out.push('_No assets were published this week._');
    return out.join('\n');
  }

  for (const [editor, items] of byEditor) {
    out.push(`## ${editor} (${items.length})`, '');
    for (const a of items) {
      const link = a.distributionUrl ? `[${a.title}](${a.distributionUrl})` : a.title;
      const type = a.assetType ? ` — _${a.assetType}_` : '';
      out.push(`- ${link}${type}`);
      for (const m of a.metrics) {
        out.push(`  - ${m.metric}: ${m.value ?? '—'}`);
      }
    }
    out.push('');
  }
  return out.join('\n');
}

// ── Brief → memory ───────────────────────────────────────────────────────────

export interface TicketForMemory {
  title: string;
  creativeBrief: string | null;
  cta: string | null;
  positioning: string | null;
  audience: string | null;
  eventTypeName: string | null;
  assetTypeName: string | null;
}

/** Structured markdown for import_profile — splits into granular memories. */
export function briefToMemoryContent(t: TicketForMemory): string {
  const out: string[] = [`# Content brief: ${t.title}`, ''];
  if (t.eventTypeName) out.push(`- Event type: ${t.eventTypeName}`);
  if (t.assetTypeName) out.push(`- Asset type: ${t.assetTypeName}`);
  if (t.audience) out.push(`- Audience: ${t.audience}`);
  if (t.positioning) out.push(`- Positioning: ${t.positioning}`);
  if (t.cta) out.push(`- CTA: ${t.cta}`);
  if (t.creativeBrief) out.push('', '## Brief', t.creativeBrief.trim());
  return out.join('\n');
}
