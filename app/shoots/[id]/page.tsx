import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/ui/AppShell';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { getShoot } from '@/lib/shoots/repository';
import { shortStatus, SHOOT_STATUS_TONE } from '@/lib/shoots/constants';
import { listActiveTickets } from '@/lib/repositories/ticket.repository';

export const dynamic = 'force-dynamic';

export default async function ShootDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await getShoot(id);
  if (!res.ok) notFound();
  const s = res.data;

  // Linked production tickets — match the shoot's links against active tickets.
  let linkedTickets: { id: string; title: string; ticketStatus: string | null }[] = [];
  if (s.ticketIds.length) {
    const t = await listActiveTickets(100);
    if (t.ok) linkedTickets = t.data.filter((x) => s.ticketIds.includes(x.id));
  }

  const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
    <div className="row"><span className="k">{k}</span><span>{children}</span></div>
  );

  return (
    <AppShell title={s.title ?? 'Shoot'} subtitle={`Shoot · ${s.format ?? '—'} · ${s.filmingLocation ?? 'location TBD'}`}>
      <Link href="/shoots" className="btn ghost sm" style={{ textDecoration: 'none', marginBottom: 14 }}>← Back to shoots</Link>

      <div className="row-between" style={{ marginBottom: 14 }}>
        <div>
          <div className="eyebrow"><Icon name="video" size={12} /> Shoot request</div>
          <h3 style={{ fontSize: 17, marginTop: 4 }}>{s.title}</h3>
          <div className="t-meta">{s.requesterName ?? '—'} · requested {s.createdTime.slice(0, 10)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge tone={SHOOT_STATUS_TONE[s.status ?? ''] ?? 'neutral'}>{shortStatus(s.status)}</Badge>
          {s.vishenApproved
            ? <Badge tone="success">✓ Vishen approved</Badge>
            : <Badge tone="warning">Vishen review pending</Badge>}
        </div>
      </div>

      <div className="grid2" style={{ gridTemplateColumns: '1.4fr 1fr', alignItems: 'start', gap: 18 }}>
        <div className="card pad">
          <div className="sec-head" style={{ margin: '0 0 12px' }}><h3>Brief</h3></div>
          <p style={{ fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{s.brief || '(no brief provided)'}</p>
          <div className="divider" style={{ margin: '14px 0' }} />
          <div className="autofill">
            <Row k="Format">{s.format ?? '—'}</Row>
            <Row k="📆 Filming date">{s.filmingDate || <span className="subtle">not scheduled</span>}</Row>
            <Row k="📍 Location">{s.filmingLocation || <span className="subtle">TBD</span>}</Row>
            <Row k="Production support">{s.productionSupport || '—'}</Row>
          </div>
        </div>

        <div>
          <div className="sec-head" style={{ margin: '0 0 10px' }}><h3>Linked tickets</h3><span className="hint">post-production</span></div>
          {linkedTickets.length ? (
            <div className="vstack">
              {linkedTickets.map((t) => (
                <Link key={t.id} href={`/tickets/${t.id}`} className="vrow" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="vthumb" style={{ background: 'var(--brand)', fontSize: 11 }}>▦</div>
                  <div className="meta"><b>{t.title}</b><span>{t.ticketStatus ?? '—'}</span></div>
                  <Icon name="arrow" size={16} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty" style={{ padding: 22, textAlign: 'center', fontSize: 13 }}>
              {s.ticketCount
                ? `${s.ticketCount} linked ticket(s), none currently active.`
                : 'No production tickets linked yet. Tickets created from this shoot will appear here.'}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
