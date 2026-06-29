import Link from 'next/link';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import type { Pulse as PulseData } from '@/lib/studio/data';

/** Glance-only pulse strip. Cards that drill are wrapped in a link. */
export function Pulse({ pulse }: { pulse: PulseData }) {
  const shipped = pulse.shippedAll != null ? pulse.shippedAll.toLocaleString() : '—';
  return (
    <KpiGrid>
      <Kpi label="In flight" value={pulse.inFlight} sub="active across all teams" i={0} />
      <Link href="/studio/launches" className="st-kpilink">
        <Kpi label="Being made now" value={pulse.inProduction} sub="in production" i={1} />
      </Link>
      <Link href="/studio/sign-off" className="st-kpilink">
        <Kpi label="Awaiting sign-off" value={pulse.awaiting} sub="in review across teams" i={2} />
      </Link>
      <Link href="/studio/shipped" className="st-kpilink">
        <Kpi label="Shipped all-time" value={shipped} sub={pulse.asOf ?? 'awaiting first sync'} i={3} />
      </Link>
    </KpiGrid>
  );
}
