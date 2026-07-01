'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { QueueTable, type StageKey, STAGE_MATCH } from '@/components/tickets/QueueTable';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { Icon } from '@/components/ui/Icon';
import type { QueueTicket } from '@/lib/tickets/data';
import type { ScoringConfig } from '@/lib/scoring-config/config';

// The stakeholder "My requests" surface. Everyone sees every request; the three KPI
// cards double as one-click lifecycle filters (Open / In production / Delivered) that
// drive the shared QueueTable's stageFilter. Counts come from the full loaded set, so
// they always show the totals you're filtering *into*.
export function StakeholderRequests({ tickets, scoringConfig, archive }: {
  tickets: QueueTicket[]; scoringConfig?: ScoringConfig; archive: boolean;
}) {
  const [stage, setStage] = useState<StageKey | null>(null);
  const toggle = (s: StageKey) => setStage((cur) => (cur === s ? null : s));

  const counts = useMemo(() => ({
    open: tickets.filter((t) => STAGE_MATCH.open(t.ticketStatus)).length,
    prod: tickets.filter((t) => STAGE_MATCH.prod(t.ticketStatus)).length,
    delivered: tickets.filter((t) => STAGE_MATCH.delivered(t.ticketStatus)).length,
  }), [tickets]);

  return (
    <>
      <KpiGrid>
        <Kpi label="Open requests" value={counts.open} sub="in flight" i={0}
          onClick={() => toggle('open')} active={stage === 'open'} />
        <Kpi label="In production" value={counts.prod} sub="being made now" i={1}
          onClick={() => toggle('prod')} active={stage === 'prod'} />
        <Kpi label="Delivered" value={counts.delivered} sub={archive ? 'all-time' : 'recent'} i={2}
          onClick={() => toggle('delivered')} active={stage === 'delivered'} />
      </KpiGrid>

      <QueueTable tickets={tickets} basePath="/stakeholder" storageKey="stakeholder-queue"
        scoringConfig={scoringConfig} stageFilter={stage ?? undefined} />

      {/* Delivered defaults to recently-shipped only (fast). Offer the full archive on demand. */}
      {stage === 'delivered' && !archive && (
        <div className="legend" style={{ marginTop: 14 }}>
          <Link href="/stakeholder?archive=1" style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontWeight: 600 }}>
            <Icon name="clock" size={14} /> Load full delivered history →
          </Link>
        </div>
      )}
    </>
  );
}
