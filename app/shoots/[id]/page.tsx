import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/ui/AppShell';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { getShoot } from '@/lib/shoots/repository';
import { shortStatus, SHOOT_STATUS_TONE } from '@/lib/shoots/constants';
import { listActiveTickets } from '@/lib/repositories/ticket.repository';
import { getIntakeReferenceData } from '@/lib/intake/data';
import { ShootEditor } from '@/components/shoots/ShootEditor';

export const dynamic = 'force-dynamic';

export default async function ShootDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await getShoot(id);
  if (!res.ok) notFound();
  const s = res.data;

  // Resolve requester name, event-type options, and the ticket pool (for link picker).
  const [ref, ticketsRes] = await Promise.all([getIntakeReferenceData(), listActiveTickets(100)]);
  const requesterName = s.requestedById
    ? ref.employees.find((e) => e.id === s.requestedById)?.name ?? null
    : null;
  const eventTypeOptions = ref.eventTypes.map((e) => ({ value: e.id, label: e.name }));
  const tickets = ticketsRes.ok ? ticketsRes.data.map((t) => ({ id: t.id, title: t.title, ticketStatus: t.ticketStatus })) : [];

  return (
    <AppShell title={s.title ?? 'Shoot'} subtitle={`Shoot · ${s.format ?? '—'} · ${s.filmingLocation ?? 'location TBD'}`}>
      <Link href="/shoots" className="btn ghost sm" style={{ textDecoration: 'none', marginBottom: 14 }}>← Back to shoots</Link>

      <div className="row-between" style={{ marginBottom: 14 }}>
        <div>
          <div className="eyebrow"><Icon name="video" size={12} /> Shoot request</div>
          <h3 style={{ fontSize: 17, marginTop: 4 }}>{s.title}</h3>
          <div className="t-meta">{requesterName ?? '—'} · requested {s.createdTime.slice(0, 10)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge tone={SHOOT_STATUS_TONE[s.status ?? ''] ?? 'neutral'}>{shortStatus(s.status)}</Badge>
          {s.vishenApproved
            ? <Badge tone="success">✓ Vishen approved</Badge>
            : <Badge tone="warning">Vishen review pending</Badge>}
        </div>
      </div>

      <ShootEditor shoot={s} eventTypeOptions={eventTypeOptions} tickets={tickets} />
    </AppShell>
  );
}
