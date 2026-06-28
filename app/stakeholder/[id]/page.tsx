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
              <Field label="Event type" value={t.eventType} />
              <Field label="Asset type" value={t.assetType} />
              <Field label="Project" value={t.project} />
              <Field label="Dimensions" value={t.dimensions} />
              <Field label="Team" value={t.team} />
              <Field label="Service level" value={t.teamServiceLevel} />
              <Field label="Team lead" value={t.teamLead} />
              <Field label="Requested by" value={t.requester} />
              <Field label="Assigned creative" value={t.assignee} />
              <Field label="Type of request" value={t.typeOfRequest} />
              <Field label="Due date" value={t.dueDate} />
              <Field label="Call to action" value={t.cta} />
              <Field label="Official calendar" value={t.officialCalendar} />
              <Field label="Speakers / authors" value={t.authors.join(', ')} />
            </div>
            {t.notes && <Field label="Notes" value={t.notes} />}
          </div>

          <div className="card pad">
            <div className="sec-head" style={{ margin: '0 0 12px' }}><h3>Files</h3><span className="hint">final asset &amp; working files</span></div>
            <Deliverables assets={t.assets} folderUrl={t.folderUrl} />
          </div>
        </div>

        <div className="stack">
          <div className="card pad">
            <div className="k" style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--text-subtle)', marginBottom: 12 }}>Status &amp; priority</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div><div className="subtle" style={{ fontSize: 11.5, marginBottom: 4 }}>Production</div><TicketStatusBadge status={t.ticketStatus} /></div>
              <div><div className="subtle" style={{ fontSize: 11.5, marginBottom: 4 }}>Priority</div><PrioStatusBadge status={t.prioStatus} /></div>
              <div className="grid2" style={{ gap: 10 }}>
                <div><div className="subtle" style={{ fontSize: 11.5, marginBottom: 2 }}>Priority score</div><span className="score">{t.priorityScore ?? '—'}</span></div>
                <div><div className="subtle" style={{ fontSize: 11.5, marginBottom: 2 }}>Ranking</div><span className="score">{t.queueRank ?? '—'}</span></div>
              </div>
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

const FILE_META: Record<string, { label: string; tag: string; bg: string }> = {
  final: { label: 'Final asset', tag: 'FIN', bg: 'var(--brand)' },
  raw: { label: 'Working file', tag: 'RAW', bg: 'var(--g500)' },
  folder: { label: 'Asset folder', tag: 'DIR', bg: 'var(--blue)' },
};

function Deliverables({ assets, folderUrl }: { assets: { id: string; kind: string; fileUrl: string | null }[]; folderUrl: string | null }) {
  const rows = assets.filter((a) => a.fileUrl);
  if (rows.length === 0) {
    return <p className="subtle" style={{ fontSize: 13 }}>No files attached yet — they’ll appear here once the team uploads them.{folderUrl ? '' : ''}</p>;
  }
  return (
    <div className="vstack">
      {rows.map((a) => {
        const m = FILE_META[a.kind] ?? FILE_META.final;
        return (
          <a key={a.id} href={a.fileUrl!} target="_blank" rel="noopener noreferrer" className="vrow" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="vthumb" style={{ background: m.bg }}>{m.tag}</div>
            <div className="meta">
              <b>{m.label}</b>
              <span style={{ wordBreak: 'break-all' }}>{a.fileUrl}</span>
            </div>
            <Icon name="ext" size={15} />
          </a>
        );
      })}
    </div>
  );
}
