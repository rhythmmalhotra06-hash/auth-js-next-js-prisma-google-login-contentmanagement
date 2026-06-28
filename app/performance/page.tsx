import { Suspense } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { FunnelCapacity } from '@/components/ui/FunnelCapacity';
import { TierBadge } from '@/components/ui/TierBadge';
import { Icon } from '@/components/ui/Icon';
import { QueueSkeleton } from '@/components/ui/Skeletons';
import { getQueueTickets, getRecentShipped, type QueueTicket } from '@/lib/tickets/data';
import { loadMap, riskOf, dueDays } from '@/lib/tickets/intel';
import { getAdminAccess } from '@/lib/admin/access';
import { getEmployeeForSession } from '@/lib/employee';
import { effectiveRoles } from '@/lib/roles';

export const dynamic = 'force-dynamic';

const IN_PROD = ['In Progress', 'In Revision', 'Review', 'Approved', 'Shipping'];

function RiskList({ tickets }: { tickets: QueueTicket[] }) {
  const load = loadMap(tickets);
  const risky = tickets
    .map((t) => ({ t, r: riskOf(t, load) }))
    .filter((x) => x.r.level)
    .sort((a, b) => (b.r.level === 'high' ? 1 : 0) - (a.r.level === 'high' ? 1 : 0));
  if (!risky.length) return <div className="empty">Nothing at risk — everything is tracking to its due date.</div>;
  return (
    <div className="stack">
      {risky.map(({ t, r }) => (
        <Link key={t.id} href={`/tickets/${t.id}`} className="card pad" style={{ display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: 13.5 }}>{t.title}</b>
            <div className="t-meta"><span className={`risk ${r.level}`}><Icon name="clock" size={11} /> {r.level === 'high' ? 'at risk' : 'watch'}</span> <span>{r.why.join(' · ')}</span></div>
          </div>
          <Icon name="arrow" size={16} />
        </Link>
      ))}
    </div>
  );
}

// Manager / admin → operational insights.
async function ManagerInsights() {
  // Active (628) + capped recent ships — never scan the ~9k Done history.
  const [active, recentShipped] = await Promise.all([getQueueTickets(), getRecentShipped(12)]);
  const load = loadMap(active);
  const inProd = active.filter((t) => IN_PROD.includes(t.ticketStatus ?? '')).length;
  const inReview = active.filter((t) => ['Review', 'Approved'].includes(t.ticketStatus ?? '')).length;
  const unassigned = active.filter((t) => !t.assignee).length;
  const atRisk = active.filter((t) => riskOf(t, load).level).length;
  const eds = [...load.keys()];
  const util = eds.length ? Math.round((eds.reduce((a, n) => a + (load.get(n) ?? 0), 0) / (eds.length * 4)) * 100) : 0;
  return (
    <>
      <KpiGrid>
        <Kpi label="In review" value={inReview} sub="awaiting sign-off" i={0} />
        <Kpi label="In production" value={inProd} sub="moving now" i={1} />
        <Kpi tone="alert" icon={<Icon name="user" size={13} />} label="Unassigned" value={unassigned} sub="need an editor" i={2} />
        <Kpi tone="danger" icon={<Icon name="clock" size={13} />} label="At risk" value={atRisk} sub="likely to slip" i={3} />
        <Kpi label="Team utilization" value={`${util}%`} sub="of capacity" i={4} />
      </KpiGrid>
      <FunnelCapacity tickets={[...active, ...recentShipped]} />
      <div className="sec-head"><h3>At-risk work</h3><span className="hint"><Icon name="sparkle" size={12} /> flagged by the brain</span></div>
      <RiskList tickets={active} />
    </>
  );
}

// Editor / designer → personal insights.
async function EditorInsights() {
  const me = await getEmployeeForSession();
  // Active assigned only — a per-editor lifetime "completed" count would need a full
  // scan of the ~9k Done set (link fields can't be filtered server-side by recId).
  const active = me ? await getQueueTickets({ assigneeId: me.id }) : [];
  const dueSoon = active.filter((t) => { const d = dueDays(t.dueDate); return d != null && d >= 0 && d <= 3; }).length;
  const atRisk = active.filter((t) => riskOf(t, loadMap(active)).level).length;
  const inReview = active.filter((t) => ['Review', 'Approved'].includes(t.ticketStatus ?? '')).length;
  return (
    <>
      <KpiGrid>
        <Kpi label="Active tickets" value={active.length} sub="of 4 capacity" i={0} />
        <Kpi tone="danger" icon={<Icon name="clock" size={13} />} label="Due ≤ 3 days" value={dueSoon} sub="tighten up" i={1} />
        <Kpi tone="alert" label="At risk" value={atRisk} sub="need attention" i={2} />
        <Kpi label="In review" value={inReview} sub="awaiting sign-off" i={3} />
      </KpiGrid>
      <div className="sec-head"><h3>Your work at risk</h3><span className="hint">sorted by urgency</span></div>
      <RiskList tickets={active} />
    </>
  );
}

// Founder / stakeholder → performance (deferred until a metrics source is wired).
async function PerformanceInsights() {
  const [active, published] = await Promise.all([getQueueTickets(), getRecentShipped(10)]);
  const inProd = active.filter((t) => IN_PROD.includes(t.ticketStatus ?? '')).length;
  const inReview = active.filter((t) => ['Review', 'Approved'].includes(t.ticketStatus ?? '')).length;
  return (
    <>
      <div className="banner future" style={{ marginBottom: 16 }}>
        <Icon name="chart" size={18} />
        <div><b>Performance tracking arrives in a later phase.</b> Once published assets carry distribution links and Clarisights / Amplitude are connected, CTR, ROAS and views will surface here per asset. For now, here’s production throughput.</div>
      </div>
      <KpiGrid>
        <Kpi label="In production" value={inProd} sub="moving now" i={0} />
        <Kpi label="In review" value={inReview} sub="awaiting sign-off" i={1} />
      </KpiGrid>
      <div className="sec-head"><h3>Recently shipped</h3><span className="hint">who made it</span></div>
      <div className="tw"><div className="tscroll"><table className="list">
        <thead><tr><th>Title</th><th>Made by</th></tr></thead>
        <tbody>
          {published.length === 0 && <tr><td colSpan={2} className="empty">Nothing shipped yet.</td></tr>}
          {published.slice(0, 10).map((t) => (
            <tr key={t.id}>
              <td><Link href={`/tickets/${t.id}`} style={{ textDecoration: 'none', color: 'inherit' }}><div className="t-title">{t.title}</div><div className="t-meta"><TierBadge event={t.eventType} /></div></Link></td>
              <td style={{ width: 200 }}>{t.assignee ?? <span className="subtle">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table></div></div>
    </>
  );
}

export default async function InsightsPage() {
  const { roles, isAdmin } = await getAdminAccess();
  const r = effectiveRoles(roles);
  const mgr = isAdmin || r.includes('Manager') || r.includes('Approver');
  const editor = !mgr && (r.includes('Editor') || r.includes('Designer'));

  const { title, sub, body, kpis } = mgr
    ? { title: 'Team insights', sub: 'Throughput, capacity and risk across the studio.', body: <ManagerInsights />, kpis: 5 }
    : editor
      ? { title: 'Your insights', sub: 'What’s on you, what’s slipping, and how much you’ve shipped.', body: <EditorInsights />, kpis: 4 }
      : { title: 'Performance insights', sub: 'How content is landing — propose-only, human approves.', body: <PerformanceInsights />, kpis: 2 };

  return (
    <AppShell title={title} subtitle={sub}>
      <Suspense fallback={<QueueSkeleton kpis={kpis} />}>{body}</Suspense>
    </AppShell>
  );
}
