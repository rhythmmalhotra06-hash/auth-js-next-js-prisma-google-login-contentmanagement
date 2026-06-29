import { Suspense } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { getMyRequests } from '@/lib/tickets/data';
import { getScoringConfig } from '@/lib/scoring-config/repository';
import { QueueTable } from '@/components/tickets/QueueTable';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { QueueSkeleton } from '@/components/ui/Skeletons';
import { getEmployeeForSession } from '@/lib/employee';

export const dynamic = 'force-dynamic';

const DONE = (s: string | null) => ['Done', 'Shipping'].includes(s ?? '');
const IN_PROD = (s: string | null) => ['In Progress', 'In Revision', 'Review', 'Approved'].includes(s ?? '');

async function MyRequestsBody() {
  const employee = await getEmployeeForSession();
  if (!employee) {
    return (
      <div className="empty">
        We couldn’t match your account to an employee record, so there are no requests to show.
        <br />Raise one from <Link href="/intake" style={{ fontWeight: 600 }}>New request</Link>.
      </div>
    );
  }
  const [mine, cfg] = await Promise.all([getMyRequests({ id: employee.id, name: employee.name }), getScoringConfig()]);
  const open = mine.filter((t) => !DONE(t.ticketStatus)).length;
  const inProd = mine.filter((t) => IN_PROD(t.ticketStatus)).length;
  const done = mine.filter((t) => DONE(t.ticketStatus)).length;

  return (
    <>
      <KpiGrid>
        <Kpi label="Open requests" value={open} sub="in flight" i={0} />
        <Kpi label="In production" value={inProd} sub="being made now" i={1} />
        <Kpi label="Delivered" value={done} sub="all-time" i={2} />
      </KpiGrid>

      {mine.length === 0 ? (
        <div className="empty">
          You haven’t raised any requests yet.
          <br /><Link href="/intake" style={{ fontWeight: 600 }}>Submit a new request →</Link>
        </div>
      ) : (
        <>
          <div className="sec-head"><h3>Your requests</h3><span className="hint">status of everything you’ve raised</span></div>
          <QueueTable tickets={mine} basePath="/stakeholder" storageKey="stakeholder-queue" scoringConfig={cfg} />
        </>
      )}
    </>
  );
}

// "My requests" — the read-only stakeholder/agency surface. A person sees only the
// requests they raised, their status, and a read-only detail per request.
export default async function MyRequestsPage() {
  return (
    <AppShell title="My requests" subtitle="Read-only · every request you’ve raised and where it stands.">
      <Suspense fallback={<QueueSkeleton kpis={3} />}>
        <MyRequestsBody />
      </Suspense>
    </AppShell>
  );
}
