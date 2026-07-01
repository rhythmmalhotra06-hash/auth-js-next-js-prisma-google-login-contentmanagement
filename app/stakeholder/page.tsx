import { Suspense } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { getRequestsForScope, type RequestScope } from '@/lib/tickets/data';
import { getScoringConfig } from '@/lib/scoring-config/repository';
import { getLiveIntakeReference } from '@/lib/airtable/reference-live';
import { getAdminAccess } from '@/lib/admin/access';
import { hasRole } from '@/lib/roles';
import { QueueTable } from '@/components/tickets/QueueTable';
import { ScopeSwitch } from '@/components/tickets/ScopeSwitch';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { Icon } from '@/components/ui/Icon';
import { QueueSkeleton } from '@/components/ui/Skeletons';
import { getEmployeeForSession } from '@/lib/employee';

export const dynamic = 'force-dynamic';

const DONE = (s: string | null) => ['Done', 'Shipping'].includes(s ?? '');
const IN_PROD = (s: string | null) => ['In Progress', 'In Revision', 'Review', 'Approved'].includes(s ?? '');

const SCOPES: RequestScope[] = ['mine', 'team', 'campaign', 'all'];
function parseScope(v: string | undefined): RequestScope {
  return SCOPES.includes(v as RequestScope) ? (v as RequestScope) : 'mine';
}

const SCOPE_HEADING: Record<RequestScope, { title: string; hint: string }> = {
  mine: { title: 'Your requests', hint: 'status of everything you’ve raised' },
  team: { title: 'Your team’s requests', hint: 'everything your team has raised' },
  campaign: { title: 'Campaign requests', hint: 'everything raised for the selected campaign' },
  all: { title: 'All requests', hint: 'every active request across the org' },
};

async function MyRequestsBody({ scope, calendarId }: { scope: RequestScope; calendarId?: string }) {
  const employee = await getEmployeeForSession();
  if (!employee) {
    return (
      <div className="empty">
        We couldn’t match your account to an employee record, so there are no requests to show.
        <br />Raise one from <Link href="/intake" style={{ fontWeight: 600 }}>New request</Link>.
      </div>
    );
  }

  // "All" is gated to managers/approvers/admins; non-eligible users fall back to "mine".
  const access = await getAdminAccess();
  const canViewAll = access.isAdmin || hasRole(access.roles, 'Manager') || hasRole(access.roles, 'Approver');
  const effectiveScope: RequestScope = scope === 'all' && !canViewAll ? 'mine' : scope;

  const [tickets, cfg, ref] = await Promise.all([
    getRequestsForScope({ id: employee.id, name: employee.name, team: employee.team }, effectiveScope, { calendarId }),
    getScoringConfig(),
    getLiveIntakeReference().catch(() => null),
  ]);
  const calendars = (ref?.officialCalendars ?? []).map((c) => ({ value: c.id, label: c.name }));

  const open = tickets.filter((t) => !DONE(t.ticketStatus)).length;
  const inProd = tickets.filter((t) => IN_PROD(t.ticketStatus)).length;
  const done = tickets.filter((t) => DONE(t.ticketStatus)).length;
  const heading = SCOPE_HEADING[effectiveScope];

  return (
    <>
      <ScopeSwitch
        scope={effectiveScope}
        canViewAll={canViewAll}
        hasTeam={!!employee.team}
        calendars={calendars}
        calendarId={calendarId}
      />

      <KpiGrid>
        <Kpi label="Open requests" value={open} sub="in flight" i={0} />
        <Kpi label="In production" value={inProd} sub="being made now" i={1} />
        <Kpi label="Delivered" value={done} sub={effectiveScope === 'mine' ? 'all-time' : 'in this view'} i={2} />
      </KpiGrid>

      {tickets.length === 0 ? (
        <div className="empty">
          {effectiveScope === 'mine' ? (
            <>You haven’t raised any requests yet.<br /><Link href="/intake" style={{ fontWeight: 600 }}>Submit a new request →</Link></>
          ) : effectiveScope === 'campaign' && !calendarId ? (
            'Pick a campaign above to see its requests.'
          ) : (
            'No requests in this view.'
          )}
        </div>
      ) : (
        <>
          <div className="sec-head"><h3>{heading.title}</h3><span className="hint">{heading.hint}</span></div>
          <QueueTable tickets={tickets} basePath="/stakeholder" storageKey="stakeholder-queue" scoringConfig={cfg} />
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

// "My requests" — the stakeholder/agency surface. Defaults to the requests you raised;
// a scope switch widens to your team, a campaign, or (for managers/admins) everything.
export default async function MyRequestsPage({ searchParams }: { searchParams: Promise<{ scope?: string; cal?: string }> }) {
  const { scope, cal } = await searchParams;
  return (
    <AppShell title="My requests" subtitle="Every request you’ve raised — switch scope to see your team or a campaign.">
      <Suspense fallback={<QueueSkeleton kpis={3} />}>
        <MyRequestsBody scope={parseScope(scope)} calendarId={cal} />
      </Suspense>
    </AppShell>
  );
}
