import { Suspense } from 'react';
import { AppShell } from '@/components/ui/AppShell';
import { getQueueTickets } from '@/lib/tickets/data';
import { QueueTable } from '@/components/tickets/QueueTable';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { Icon } from '@/components/ui/Icon';
import { QueueSkeleton } from '@/components/ui/Skeletons';
import { guardRoute } from '@/lib/auth/route-guard';
import { getEmployeeForSession } from '@/lib/employee';

export const dynamic = 'force-dynamic';

// Statuses a stakeholder sees in the main board: work that's in flight or finished —
// in progress / in review / approved / published / done. Early intake stages
// (Requested, Prioritized, Assigned) and Won't Do are hidden. Matched case-insensitively
// so it tolerates the base's exact enum spelling (In Production vs In Progress, etc.).
const STAKEHOLDER_VISIBLE = new Set([
  'in progress',
  'in production',
  'in review',
  'review',
  'in revision',
  'approved',
  'published',
  'done',
]);
const stakeholderVisible = (s: string | null) => !!s && STAKEHOLDER_VISIBLE.has(s.trim().toLowerCase());

async function StakeholderBody() {
  const [allTickets, employee] = await Promise.all([
    getQueueTickets({ includeCompleted: true }),
    getEmployeeForSession(),
  ]);

  const visible = allTickets.filter((t) => stakeholderVisible(t.ticketStatus));
  const published = allTickets.filter((t) => t.ticketStatus === 'Done').length;
  const inProd = visible.filter((t) => ['In Progress', 'In Revision', 'Review', 'Approved'].includes(t.ticketStatus ?? '')).length;
  // "My requests": everything this person raised, at any stage (matched by their
  // Google email → Employees record → requester link on the ticket).
  const mine = employee ? allTickets.filter((t) => t.requesterId === employee.id) : [];

  return (
    <>
      <div className="banner future" style={{ marginBottom: 16 }}>
        <Icon name="eye" size={18} />
        <div>The surface Vision asked for — <b>who edited each asset and where it went</b>, in one place. Live CTR/ROAS performance arrives in a later phase.</div>
      </div>
      <KpiGrid>
        <Kpi label="Published" value={published} sub="delivered" i={0} />
        <Kpi label="In production" value={inProd} sub="moving now" i={1} />
        <Kpi label="Visible to you" value={visible.length} sub="in flight → done" i={2} />
      </KpiGrid>

      {mine.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold text-text">
            Requests you raised <span className="font-normal text-text-muted">· {mine.length}</span>
          </h2>
          <QueueTable tickets={mine} />
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-text">All work — in progress → done</h2>
        <QueueTable tickets={visible} />
      </section>
    </>
  );
}

// Read-only view — the free, unlimited stakeholder/agency surface (Ziflow pattern).
// Distribution links + live performance metrics arrive with the Performance Loop (E7).
export default async function StakeholderPage() {
  await guardRoute('/stakeholder');

  return (
    <AppShell
      title="Shares"
      subtitle="Read-only · who made each asset and where it shipped. No paid seat."
    >
      <Suspense fallback={<QueueSkeleton kpis={3} />}>
        <StakeholderBody />
      </Suspense>
    </AppShell>
  );
}
