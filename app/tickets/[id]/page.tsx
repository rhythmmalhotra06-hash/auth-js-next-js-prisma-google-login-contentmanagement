import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/ui/AppShell';
import { PrioStatusBadge } from '@/components/ui/Badge';
import { getTicketDetail, getActiveEmployees } from '@/lib/tickets/data';
import { StatusUpdater } from '@/components/tickets/StatusUpdater';
import { PrioStatusUpdater } from '@/components/tickets/PrioStatusUpdater';
import { AssigneeUpdater } from '@/components/tickets/AssigneeUpdater';
import { AssetPanel } from '@/components/tickets/AssetPanel';

export const dynamic = 'force-dynamic';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border-muted py-2.5 last:border-0 sm:flex-row sm:gap-4">
      <dt className="w-48 shrink-0 text-sm text-text-muted">{label}</dt>
      <dd className="text-sm text-text">{value || <span className="text-text-subtle">—</span>}</dd>
    </div>
  );
}

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTicketDetail(id);
  if (!t) notFound();
  const employees = await getActiveEmployees();

  return (
    <AppShell title={t.title} subtitle={[t.eventType, t.assetType].filter(Boolean).join(' · ') || undefined}
      actions={<PrioStatusBadge status={t.prioStatus} />}>
      <Link href="/manager" className="text-sm text-brand hover:underline">← Back to queue</Link>

      <div className="mt-3 rounded-[12px] border border-border-default bg-surface p-6 shadow-[var(--mv-shadow-light)]">
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-subtle">Ticket Status <span className="font-normal lowercase text-text-subtle">· editor</span></p>
            <StatusUpdater ticketId={t.id} current={t.ticketStatus} />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-subtle">Priority Status <span className="font-normal lowercase text-text-subtle">· manager</span></p>
            <PrioStatusUpdater ticketId={t.id} current={t.prioStatus} />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-subtle">Assigned <span className="font-normal lowercase text-text-subtle">· manager</span></p>
            <AssigneeUpdater ticketId={t.id} current={t.assigneeId} employees={employees} />
          </div>
        </div>
        <dl>
          <Row label="Event Type" value={t.eventType} />
          <Row label="Asset Type" value={t.assetType} />
          <Row label="Type of Request" value={t.typeOfRequest} />
          <Row label="Team/Service Level" value={t.teamServiceLevel} />
          <Row label="Requested By" value={t.requester} />
          <Row label="Official Calendar" value={t.officialCalendar} />
          <Row label="Speakers/Authors" value={t.authors.join(', ')} />
          <Row label="Due date" value={t.dueDate} />
          <Row label="Priority score" value={t.priorityScore ?? 'unscored'} />
          <Row label="Creative Brief" value={t.creativeBrief} />
          <Row label="Call to action" value={t.cta} />
          <Row label="Source links" value={t.sourceLinks} />
          <Row label="Notes" value={t.notes} />
        </dl>
      </div>

      <AssetPanel ticketId={t.id} assets={t.assets} />

      <p className="mt-6 text-xs text-text-subtle">Change history is tracked in the Airtable record (revision history). Approvals are handled via Ticket Status (Review → Approved / In Revision).</p>
    </AppShell>
  );
}
