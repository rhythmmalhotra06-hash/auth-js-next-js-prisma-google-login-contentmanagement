import { Suspense } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { getQueueTickets, getRecentShipped, type QueueTicket } from '@/lib/tickets/data';
import { getScoringConfig } from '@/lib/scoring-config/repository';
import { StakeholderRequests } from '@/components/tickets/StakeholderRequests';
import { Icon } from '@/components/ui/Icon';
import { QueueSkeleton } from '@/components/ui/Skeletons';

export const dynamic = 'force-dynamic';

// Default = every active request + the most recent delivered ones (fast). `?archive=1`
// swaps in the full delivered/Done history so people can find older shipped work.
const RECENT_SHIPPED = 50;

async function loadRequests(archive: boolean): Promise<QueueTicket[]> {
  if (archive) return getQueueTickets({ includeCompleted: true });
  const [active, shipped] = await Promise.all([getQueueTickets(), getRecentShipped(RECENT_SHIPPED)]);
  // Active (non-Done) and recent-shipped (Done) sets are disjoint; dedupe by id defensively.
  const byId = new Map<string, QueueTicket>();
  for (const t of [...active, ...shipped]) byId.set(t.id, t);
  return [...byId.values()];
}

async function MyRequestsBody({ archive }: { archive: boolean }) {
  const [tickets, cfg] = await Promise.all([loadRequests(archive), getScoringConfig()]);

  return (
    <>
      {tickets.length === 0 ? (
        <div className="empty">
          No requests yet.<br /><Link href="/intake" style={{ fontWeight: 600 }}>Submit a new request →</Link>
        </div>
      ) : (
        <>
          <div className="sec-head"><h3>All requests</h3><span className="hint">every request across the team</span></div>
          <StakeholderRequests tickets={tickets} scoringConfig={cfg} archive={archive} />
          <div className="legend" style={{ marginTop: 14 }}>
            <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              <Icon name="eye" size={14} /> Read-only · comment access only.
            </span>
            <span className="subtle">Performance (CTR / ROAS) will key to each published asset from Clarisights / Amplitude once connected.</span>
          </div>
        </>
      )}
    </>
  );
}

// "My requests" — the shared stakeholder/agency surface. Everyone sees every request;
// the KPI cards filter by lifecycle stage and the table filters by assignee, status, etc.
export default async function MyRequestsPage({ searchParams }: { searchParams: Promise<{ archive?: string }> }) {
  const { archive } = await searchParams;
  return (
    <AppShell title="My requests" subtitle="Every request across the team — filter by stage, assignee, or status.">
      <Suspense fallback={<QueueSkeleton kpis={3} />}>
        <MyRequestsBody archive={archive === '1'} />
      </Suspense>
    </AppShell>
  );
}
