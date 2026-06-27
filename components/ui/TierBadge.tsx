import { tierForEvent } from '@/lib/tickets/tiers';

export function TierBadge({ event }: { event: string | null | undefined }) {
  const t = tierForEvent(event);
  return <span className={`tier ${t}`}>{event || '—'}</span>;
}
