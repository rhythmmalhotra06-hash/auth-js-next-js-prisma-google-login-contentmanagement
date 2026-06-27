import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/ui/AppShell';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { FunnelCapacity } from '@/components/ui/FunnelCapacity';
import { TierBadge } from '@/components/ui/TierBadge';
import { TicketStatusBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { getQueueTickets } from '@/lib/tickets/data';
import { listMediaSources } from '@/lib/media/repository';
import { getAdminAccess } from '@/lib/admin/access';
import { isFounder, homeRouteForRoles } from '@/lib/roles';

export const dynamic = 'force-dynamic';

const IN_PROD = ['In Progress', 'In Revision', 'Review', 'Approved', 'Shipping'];

export default async function StudioPage() {
  const { roles, isAdmin } = await getAdminAccess();
  if (!isAdmin && !isFounder(roles)) redirect(homeRouteForRoles(roles));

  const [all, mediaRes] = await Promise.all([
    getQueueTickets({ includeCompleted: true }),
    listMediaSources(100),
  ]);
  const media = mediaRes.ok ? mediaRes.data : [];

  const active = all.filter((t) => !['Done', "Won't Do"].includes(t.ticketStatus ?? ''));
  const inProd = active.filter((t) => IN_PROD.includes(t.ticketStatus ?? '')).length;
  const shipped = all.filter((t) => t.ticketStatus === 'Done');
  const awaiting = all.filter((t) => t.prioStatus === 'To be reviewed by Vishen');
  const vishenMedia = media.filter(
    (m) => `${m.guestShow ?? ''} ${m.title ?? ''}`.toLowerCase().includes('vishen'),
  );

  return (
    <AppShell title="Studio" subtitle="Founder overview — what the team is producing for you">
      <KpiGrid>
        <Kpi label="Active requests" value={active.length} sub="in flight" i={0} />
        <Kpi label="In production" value={inProd} sub="being made now" i={1} />
        <Kpi label="Shipped" value={shipped.length} sub="delivered" i={2} />
        <Kpi tone="alert" icon={<Icon name="check" size={13} />} label="Awaiting you" value={awaiting.length} sub="need your sign-off" i={3} />
      </KpiGrid>

      {awaiting.length > 0 && (
        <>
          <div className="sec-head"><h3>Awaiting your approval</h3><span className="hint">flagged “to be reviewed by Vishen”</span></div>
          <div className="stack">
            {awaiting.map((t) => (
              <Link key={t.id} href={`/tickets/${t.id}`} className="card pad" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <b style={{ fontSize: 13.5 }}>{t.title}</b>
                  <div className="t-meta"><TierBadge event={t.eventType} /> <span>{t.assetType ?? '—'} · {t.assignee ?? 'unassigned'}</span></div>
                </div>
                <span className="btn sm">Review <Icon name="arrow" size={14} /></span>
              </Link>
            ))}
          </div>
        </>
      )}

      <FunnelCapacity tickets={all} />

      <div className="sec-head"><h3>Recently shipped</h3><span className="hint">who made it</span></div>
      <div className="tw"><div className="tscroll"><table className="list">
        <thead><tr><th>Title</th><th>Made by</th><th>Status</th></tr></thead>
        <tbody>
          {shipped.length === 0 && <tr><td colSpan={3} className="empty">Nothing shipped yet.</td></tr>}
          {shipped.slice(0, 8).map((t) => (
            <tr key={t.id} style={{ cursor: 'pointer' }}>
              <td><Link href={`/tickets/${t.id}`} style={{ textDecoration: 'none', color: 'inherit' }}><div className="t-title">{t.title}</div><div className="t-meta"><TierBadge event={t.eventType} /></div></Link></td>
              <td style={{ width: 180 }}>{t.assignee ?? <span className="subtle">—</span>}</td>
              <td style={{ width: 120 }}><TicketStatusBadge status={t.ticketStatus} /></td>
            </tr>
          ))}
        </tbody>
      </table></div></div>

      {vishenMedia.length > 0 && (
        <>
          <div className="sec-head"><h3>Your content</h3><span className="hint">your talks → clip ideas</span></div>
          <div className="stack">
            {vishenMedia.map((m) => (
              <Link key={m.id} href={`/media/${m.id}`} className="card pad" style={{ display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="play" size={18} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 13 }}>{m.title || m.sourceUrl}</b>
                  <div className="t-meta">{m.status}{m.clipCount ? ` · ${m.clipCount} clip ideas` : ''}</div>
                </div>
                <Icon name="arrow" size={16} />
              </Link>
            ))}
          </div>
        </>
      )}

      <div className="sec-head"><h3>Performance</h3></div>
      <div className="banner future">
        <Icon name="chart" size={18} />
        <div><b>Performance tracking arrives in a later phase.</b> Once published assets carry distribution links and Clarisights / Amplitude are connected, CTR, ROAS and views will show here per asset — answering “how did it perform?” beside “who made it.” v1 focuses on production status &amp; approvals.</div>
      </div>
    </AppShell>
  );
}
