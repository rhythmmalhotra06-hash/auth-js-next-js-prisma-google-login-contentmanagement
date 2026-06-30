import { cn } from '@/lib/cn';

export type Tone = 'neutral' | 'brand' | 'success' | 'info' | 'warning' | 'danger';

const TONE: Record<Tone, { wrap: string; dot: string }> = {
  neutral: { wrap: 'bg-bg-subtle text-text-muted', dot: 'bg-text-subtle' },
  brand: { wrap: 'bg-brand-soft text-brand-content', dot: 'bg-brand' },
  success: { wrap: 'bg-success-soft text-success-content', dot: 'bg-success' },
  info: { wrap: 'bg-info-soft text-info-content', dot: 'bg-info' },
  warning: { wrap: 'bg-warning-soft text-warning-content', dot: 'bg-warning' },
  danger: { wrap: 'bg-danger-soft text-danger-content', dot: 'bg-danger' },
};

export function Badge({ tone = 'neutral', dot = true, children, className }: {
  tone?: Tone; dot?: boolean; children: React.ReactNode; className?: string;
}) {
  const t = TONE[tone];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-sm px-2.5 py-0.5 text-xs font-medium', t.wrap, className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} />}
      {children}
    </span>
  );
}

// Canonical status → tone maps, keyed to the LIVE Airtable enums
// (plans/airtable-direct-pivot.md). Never color alone — always dot + text.
const TICKET_STATUS_TONE: Record<string, Tone> = {
  'Backlog': 'neutral',
  'To Do': 'info',
  'In Progress': 'info',
  'Review': 'warning',
  'In Revision': 'warning',
  'Approved': 'success',
  'Done': 'success',
  "Won't Do": 'danger',
  'Shipping': 'success',
  'Request on Hold': 'neutral',
};

const PRIO_STATUS_TONE: Record<string, Tone> = {
  'New Request': 'brand',
  'To be reviewed by Vishen': 'warning',
  'In Queue': 'info',
  'Pending Information/Brief Not Clear': 'warning',
  'Rejected - No need to work': 'danger',
  'Assigned': 'success',
};

/** Ticket Status badge (internal/editor axis — neutral-leaning tones). */
export function TicketStatusBadge({ status, className }: { status: string | null; className?: string }) {
  if (!status) return <span className="text-text-subtle text-xs">—</span>;
  return <Badge tone={TICKET_STATUS_TONE[status] ?? 'neutral'} className={className}>{status}</Badge>;
}

/** Prio Status badge (manager/external axis — brand-leaning tones). */
export function PrioStatusBadge({ status, className }: { status: string | null; className?: string }) {
  if (!status) return <span className="text-text-subtle text-xs">—</span>;
  return <Badge tone={PRIO_STATUS_TONE[status] ?? 'brand'} className={className}>{status}</Badge>;
}
