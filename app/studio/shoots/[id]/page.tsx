import { notFound } from 'next/navigation';
import { AppShell } from '@/components/ui/AppShell';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { BackLink } from '@/components/studio/BackLink';
import { ShootDecision } from '@/components/studio/ShootDecision';
import { requireStudioAccess } from '@/lib/studio/guard';
import { getShoot } from '@/lib/shoots/repository';
import { shortStatus, SHOOT_STATUS_TONE, SHOOT_STATUS } from '@/lib/shoots/constants';
import { getIntakeReferenceData } from '@/lib/intake/data';

export const dynamic = 'force-dynamic';

// Founder-facing shoot detail (not the team /shoots/[id]). Reached from Studio.
export default async function StudioShootDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireStudioAccess();
  const { id } = await params;
  const res = await getShoot(id);
  if (!res.ok) notFound();
  const s = res.data;

  const ref = await getIntakeReferenceData();
  const requesterName = s.requestedById
    ? ref.employees.find((e) => e.id === s.requestedById)?.name ?? null
    : null;
  const pending = s.status === SHOOT_STATUS.needsReview;

  return (
    <AppShell title={s.title ?? 'Shoot'} subtitle={`Shoot · ${s.format ?? '—'} · ${s.filmingLocation ?? 'location TBD'}`}>
      <BackLink href="/studio/shoots" label="Back to shoots" />

      <div className="row-between" style={{ marginBottom: 14 }}>
        <div>
          <div className="eyebrow"><Icon name="video" size={12} /> Shoot request</div>
          <h3 style={{ fontSize: 17, marginTop: 4 }}>{s.title}</h3>
          <div className="t-meta">{requesterName ?? '—'} · requested {s.createdTime.slice(0, 10)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Badge tone={SHOOT_STATUS_TONE[s.status ?? ''] ?? 'neutral'}>{shortStatus(s.status)}</Badge>
          {s.vishenApproved
            ? <Badge tone="success">✓ Approved</Badge>
            : <Badge tone="warning">Review pending</Badge>}
        </div>
      </div>

      {pending && <div style={{ marginBottom: 16 }}><ShootDecision id={s.id} /></div>}

      <div className="card pad">
        <div className="sec-head" style={{ margin: '0 0 12px' }}><h3>Brief</h3></div>
        <p style={{ fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{s.brief || '(no brief provided)'}</p>
        <div className="divider" style={{ margin: '14px 0' }} />
        <div className="autofill">
          <div className="row"><span className="k">Format</span><span>{s.format ?? '—'}</span></div>
          <div className="row"><span className="k">📆 Filming date</span><span>{s.filmingDate || <span className="subtle">not scheduled</span>}</span></div>
          <div className="row"><span className="k">📍 Location</span><span>{s.filmingLocation || <span className="subtle">TBD</span>}</span></div>
          <div className="row"><span className="k">Production support</span><span>{s.productionSupport || '—'}</span></div>
        </div>
      </div>
    </AppShell>
  );
}
