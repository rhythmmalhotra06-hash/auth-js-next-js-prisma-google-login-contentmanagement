import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/ui/AppShell';
import { TicketStatusBadge, PrioStatusBadge } from '@/components/ui/Badge';
import { TierBadge } from '@/components/ui/TierBadge';
import { BriefText } from '@/components/ui/BriefText';
import { Icon } from '@/components/ui/Icon';
import { getTicketDetail } from '@/lib/tickets/data';
import { getEmployeeForSession } from '@/lib/employee';

export const dynamic = 'force-dynamic';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="field-row">
      <div className="k">{label}</div>
      <div className="v">{value || <span className="subtle">—</span>}</div>
    </div>
  );
}

// Read-only request detail for the person who raised it. Visible to them only —
// a request raised by someone else 404s here (they have no edit surface at all).
export default async function MyRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, me] = await Promise.all([getTicketDetail(id), getEmployeeForSession()]);
  if (!t || !me || t.requesterId !== me.id) notFound();

  return (
    <AppShell title={t.title} subtitle={[t.eventType, t.assetType].filter(Boolean).join(' · ') || undefined}>
      <Link href="/stakeholder" className="btn ghost sm" style={{ textDecoration: 'none', marginBottom: 14 }}>
        <Icon name="arrow" size={14} /> Back to my requests
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
              <Field label="Made by" value={t.assignee} />
              <Field label="Due date" value={t.dueDate} />
              <Field label="Official calendar" value={t.officialCalendar} />
              <Field label="Speakers / authors" value={t.authors.join(', ')} />
            </div>
            {t.notes && <Field label="Notes" value={t.notes} />}
          </div>

          {t.assets.length > 0 && (
            <div className="card pad">
              <div className="sec-head" style={{ margin: '0 0 12px' }}><h3>Deliverables</h3></div>
              <div className="vstack">
                {t.assets.map((a) => (
                  <div key={a.id} className="vrow">
                    <div className="vthumb" style={{ background: a.kind === 'final' ? 'var(--brand)' : 'var(--g500)' }}>{a.kind === 'final' ? 'FIN' : 'RAW'}</div>
                    <div className="meta">
                      <b>{a.kind === 'final' ? 'Final asset' : 'Raw source'}</b>
                      {a.fileUrl && <a href={a.fileUrl} target="_blank" rel="noopener noreferrer">{a.fileUrl}</a>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="stack">
          <div className="card pad">
            <div className="k" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--text-subtle)', marginBottom: 12 }}>Status</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><div className="subtle" style={{ fontSize: 11.5, marginBottom: 4 }}>Production</div><TicketStatusBadge status={t.ticketStatus} /></div>
              <div><div className="subtle" style={{ fontSize: 11.5, marginBottom: 4 }}>Priority</div><PrioStatusBadge status={t.prioStatus} /></div>
              <div><div className="subtle" style={{ fontSize: 11.5, marginBottom: 4 }}>Assigned to</div><span>{t.assignee || <span className="subtle">unassigned</span>}</span></div>
            </div>
          </div>
          <div className="card pad">
            <div className="k" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--text-subtle)', marginBottom: 8 }}>About this view</div>
            <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>Read-only — this is your request. The creative team updates status as it moves through production.</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
