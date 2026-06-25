import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTicketDetail, getActiveEmployees } from '@/lib/tickets/data';
import { StatusUpdater } from '@/components/tickets/StatusUpdater';
import { PrioStatusUpdater } from '@/components/tickets/PrioStatusUpdater';
import { AssigneeUpdater } from '@/components/tickets/AssigneeUpdater';

export const dynamic = 'force-dynamic';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-neutral-100 py-2.5 sm:flex-row sm:gap-4">
      <dt className="w-48 shrink-0 text-sm text-neutral-500">{label}</dt>
      <dd className="text-sm text-neutral-900">{value || <span className="text-neutral-400">—</span>}</dd>
    </div>
  );
}

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTicketDetail(id);
  if (!t) notFound();
  const employees = await getActiveEmployees();

  return (
    <main className="min-h-screen bg-neutral-50 py-10">
      <div className="mx-auto max-w-3xl px-4">
        <Link href="/tickets" className="text-sm text-[#572280] hover:underline">← Back to queue</Link>

        <div className="mt-3 flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-neutral-900">{t.title}</h1>
          <span className="rounded-full bg-[#572280]/10 px-3 py-1 text-xs font-medium text-[#572280]">{t.prioStatus ?? '—'}</span>
        </div>

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Ticket Status <span className="font-normal lowercase text-neutral-400">· editor</span></p>
              <StatusUpdater ticketId={t.id} current={t.ticketStatus} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Priority Status <span className="font-normal lowercase text-neutral-400">· manager</span></p>
              <PrioStatusUpdater ticketId={t.id} current={t.prioStatus} />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Assigned <span className="font-normal lowercase text-neutral-400">· manager</span></p>
              <AssigneeUpdater ticketId={t.id} current={t.assigneeId} employees={employees} />
            </div>
          </div>
          <dl>
            <Row label="Event Type" value={t.eventType} />
            <Row label="Asset Type" value={t.assetType} />
            <Row label="Type of Request" value={t.typeOfRequest} />
            <Row label="Team/Service Level" value={t.teamServiceLevel} />
            <Row label="Requested By" value={t.requester} />
            <Row label="Assigned" value={t.assignee} />
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

        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Lifecycle history</h2>
          <ol className="mt-4 space-y-3">
            {t.events.map((e) => (
              <li key={e.id} className="flex gap-3 text-sm">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#572280]" />
                <div>
                  <span className="font-medium text-neutral-900">
                    {e.fromState ? `${e.fromState} → ${e.toState}` : e.toState}
                  </span>
                  <span className="ml-2 text-xs text-neutral-400">{new Date(e.createdAt).toLocaleString()}</span>
                  {e.note && <p className="text-xs text-neutral-500">{e.note}{e.actor ? ` · ${e.actor}` : ''}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </main>
  );
}
