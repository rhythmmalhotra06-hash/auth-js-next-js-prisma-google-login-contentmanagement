import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { getQueueTickets, getActiveEmployees } from '@/lib/tickets/data';
import { QueueTable } from '@/components/tickets/QueueTable';
import { EmployeePicker } from '@/components/tickets/EmployeePicker';
import { ApprovedClipsPanel } from '@/components/clips/ApprovedClipsPanel';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { TierBadge } from '@/components/ui/TierBadge';
import { TicketStatusBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { listClipsByStatus, listMediaSources } from '@/lib/media/repository';
import { getIntakeReferenceData } from '@/lib/intake/data';
import { guardRoute } from '@/lib/auth/route-guard';

export const dynamic = 'force-dynamic';

const days = (due: string | null) => (due ? Math.ceil((new Date(due).getTime() - Date.now()) / 86400000) : null);

export default async function EditorPage({ searchParams }: { searchParams: Promise<{ assignee?: string }> }) {
  await guardRoute('/editor');
  const { assignee } = await searchParams;
  const [tickets, employees, approvedRes, sourcesRes, reference] = await Promise.all([
    getQueueTickets({ assigneeId: assignee }),
    getActiveEmployees(),
    listClipsByStatus('Approved'),
    listMediaSources(100),
    getIntakeReferenceData(),
  ]);
  const dueSoon = tickets.filter((t) => { const d = days(t.dueDate); return d != null && d >= 0 && d <= 3; }).length;
  const inReview = tickets.filter((t) => t.ticketStatus === 'Review').length;
  const nextUp = tickets[0];
  const approved = approvedRes.ok ? approvedRes.data : [];
  const sources = sourcesRes.ok ? sourcesRes.data : [];
  const sourceNames: Record<string, string> = Object.fromEntries(
    sources.map((s) => [s.id, s.title || s.sourceUrl || 'Untitled source']),
  );
  const sourceUrls: Record<string, string> = Object.fromEntries(
    sources.filter((s) => s.sourceUrl).map((s) => [s.id, s.sourceUrl as string]),
  );

  return (
    <AppShell
      title="Editor — My Queue"
      subtitle={assignee ? `${tickets.length} assigned · next up first` : 'Pick an editor to see their assigned work'}
      actions={<EmployeePicker employees={employees} value={assignee ?? ''} />}
    >
      <KpiGrid>
        <Kpi label="Assigned to you" value={tickets.length} sub="active tickets" i={0} />
        <Kpi tone="danger" icon={<Icon name="clock" size={13} />} label="Due ≤ 3 days" value={dueSoon} sub="tighten up" i={1} />
        <Kpi label="In review" value={inReview} sub="awaiting sign-off" i={2} />
      </KpiGrid>

      {nextUp && (
        <div className="card pad" style={{ borderColor: 'var(--brand-border)', background: 'linear-gradient(180deg, var(--brand-soft), transparent 60%)', marginBottom: 18 }}>
          <div className="eyebrow">Next up</div>
          <div className="row-between" style={{ marginTop: 6 }}>
            <div>
              <h3 style={{ fontSize: 18 }}>{nextUp.title}</h3>
              <div className="t-meta" style={{ marginTop: 6 }}><TierBadge event={nextUp.eventType} /> <span>{nextUp.assetType ?? '—'}</span></div>
            </div>
            <TicketStatusBadge status={nextUp.ticketStatus} />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            <Link href={`/tickets/${nextUp.id}`} className="btn primary" style={{ textDecoration: 'none' }}><Icon name="doc" size={15} /> Open brief</Link>
            <Link href={`/tickets/${nextUp.id}`} className="btn" style={{ textDecoration: 'none' }}><Icon name="upload" size={15} /> Upload asset</Link>
          </div>
        </div>
      )}

      <ApprovedClipsPanel approved={approved} sourceNames={sourceNames} sourceUrls={sourceUrls} reference={reference} />
      <div className="sec-head"><h3>Up next in your queue</h3><span className="hint">pulled in priority order</span></div>
      <QueueTable tickets={tickets} />
    </AppShell>
  );
}
