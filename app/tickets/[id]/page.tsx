import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/ui/AppShell';
import { TicketStatusBadge, PrioStatusBadge } from '@/components/ui/Badge';
import { TierBadge } from '@/components/ui/TierBadge';
import { BriefText } from '@/components/ui/BriefText';
import { Icon } from '@/components/ui/Icon';
import { getTicketDetail, getActiveEmployees } from '@/lib/tickets/data';
import { StatusUpdater } from '@/components/tickets/StatusUpdater';
import { PrioStatusUpdater } from '@/components/tickets/PrioStatusUpdater';
import { AssigneeUpdater } from '@/components/tickets/AssigneeUpdater';
import { AssetPanel } from '@/components/tickets/AssetPanel';
import { ApprovalRows } from '@/components/tickets/ApprovalRows';

export const dynamic = 'force-dynamic';

function Field({ label, value, lookup }: { label: string; value: React.ReactNode; lookup?: boolean }) {
  return (
    <div className="field-row">
      <div className="k">{label}{lookup && <span className="lock"><Icon name="lock" size={11} /> lookup</span>}</div>
      <div className="v">{value || <span className="subtle">—</span>}</div>
    </div>
  );
}

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTicketDetail(id);
  if (!t) notFound();
  const employees = await getActiveEmployees();

  return (
    <AppShell title={t.title} subtitle={[t.eventType, t.assetType].filter(Boolean).join(' · ') || undefined}>
      <Link href="/manager" className="btn ghost sm" style={{ textDecoration: 'none', marginBottom: 14 }}>
        <Icon name="arrow" size={14} /> Back to queue
      </Link>

      <div className="detail">
        <div className="stack">
          <div className="card pad">
            <div className="row-between" style={{ marginBottom: 6 }}>
              <div className="t-meta"><TierBadge event={t.eventType} /> <span>{t.assetType ?? '—'}</span></div>
              <div style={{ display: 'flex', gap: 7 }}><TicketStatusBadge status={t.ticketStatus} /><PrioStatusBadge status={t.prioStatus} /></div>
            </div>
            <h3 style={{ fontSize: 18, margin: '4px 0 12px' }}>{t.title}</h3>
            <div className="field-row">
              <div className="k">Creative brief</div>
              <div className="v"><BriefText text={t.creativeBrief} /></div>
            </div>
            <div className="grid2">
              <Field label="Call to action" value={t.cta} />
              <Field label="Type of request" value={t.typeOfRequest} />
              <Field label="Team / service level" value={t.teamServiceLevel} />
              <Field label="Due date" value={t.dueDate} />
              <Field label="Requested by" value={t.requester} lookup />
              <Field label="Official calendar" value={t.officialCalendar} lookup />
              <Field label="Speakers / authors" value={t.authors.join(', ')} />
              <Field label="Priority score" value={t.priorityScore ?? 'unscored'} />
            </div>
            {t.notes && <Field label="Notes" value={t.notes} />}
          </div>

          <div className="card pad">
            <div className="sec-head" style={{ margin: '0 0 12px' }}><h3>Assets</h3><span className="hint">raw &amp; final stack under one asset</span></div>
            <AssetPanel ticketId={t.id} assets={t.assets} />
          </div>
        </div>

        <div className="stack">
          <div className="card pad">
            <div className="k" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--text-subtle)', marginBottom: 10 }}>Two status axes</div>
            <label>Ticket status <span className="subtle">· editor-owned</span></label>
            <StatusUpdater ticketId={t.id} current={t.ticketStatus} />
            <label style={{ marginTop: 12 }}>Priority status <span className="subtle">· manager-owned</span></label>
            <PrioStatusUpdater ticketId={t.id} current={t.prioStatus} />
            <label style={{ marginTop: 12 }}>Assignee</label>
            <AssigneeUpdater ticketId={t.id} current={t.assigneeId} employees={employees} />
          </div>

          <div className="card pad">
            <div className="k" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--text-subtle)', marginBottom: 10 }}>Review &amp; approval</div>
            <ApprovalRows approvals={t.approvals} />
          </div>

          <div className="card pad">
            <div className="k" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--text-subtle)', marginBottom: 8 }}>Lifecycle</div>
            <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
              Change history is tracked in the Airtable record revision history. Approvals run through Ticket Status (Review → Approved / In Revision).
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
