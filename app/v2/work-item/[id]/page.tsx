import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/ui/AppShell';
import { Badge, TicketStatusBadge, PrioStatusBadge } from '@/components/ui/Badge';
import { BriefText } from '@/components/ui/BriefText';
import { PerformanceBand } from '@/components/v2/PerformanceBand';
import { getV2Session } from '@/lib/v2/access';
import { getTicketDetail } from '@/lib/tickets/data';
import { publicationsForTicket, readoutsFor, goalMetric, freshness, type Readout } from '@/lib/publications/repository';
import { openSignals, AGENT_LABEL, type AgentId } from '@/lib/signals/emit';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const KIND_TONE = {
  learning: 'brand', anomaly: 'info', blocker: 'warning',
  chore: 'neutral', watch: 'staged', gap: 'staged', suggestion: 'staged',
} as const;

export default async function V2WorkItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getV2Session();
  if (!session) {
    return (
      <AppShell title="Content Studio v2" subtitle="Preview">
        <div className="card pad">
          <p>
            These pages show real names beside real numbers, so they are open to the walkthrough
            group rather than the whole domain. Ask Rhythm to add your address to{' '}
            <code>V2_ALLOWLIST_EMAILS</code>.
          </p>
        </div>
      </AppShell>
    );
  }

  const t = await getTicketDetail(id);
  if (!t) notFound();

  const pubs = await publicationsForTicket(id);
  const readouts: Array<{ pub: (typeof pubs)[number]; readouts: Readout[] }> = [];
  for (const p of pubs) {
    const r = await readoutsFor(p.id);
    readouts.push({ pub: p, readouts: r?.readouts ?? [] });
  }

  const signals = await openSignals({ subjectType: 'publication', limit: 20 });
  const mine = signals.filter((s) => pubs.some((p) => p.id === s.publicationId));
  const last = await prisma.socialMetric.findFirst({ orderBy: { capturedAt: 'desc' }, select: { capturedAt: true } });
  const fresh = freshness(last?.capturedAt ?? null);

  return (
    <AppShell
      title={t.title}
      subtitle={`${t.assetType ?? 'Asset type not set'} · ${t.eventType ?? 'no event type'} · v2 preview`}
      actions={<Link className="btn" href={`/tickets/${id}`}>Open the live ticket →</Link>}
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="card pad">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {t.ticketStatus && <TicketStatusBadge status={t.ticketStatus} />}
            {t.prioStatus && <PrioStatusBadge status={t.prioStatus} />}
            <span className="subtle">Editor: {t.assignee ?? 'unassigned'}</span>
            <Badge tone={fresh.state === 'fresh' ? 'neutral' : fresh.state === 'stale' ? 'warning' : 'danger'}>
              Hootsuite Perch · {fresh.label}
            </Badge>
          </div>
        </div>

        <div className="card">
          <div className="pad" style={{ borderBottom: '1px solid var(--mv-border)' }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>Publications</h2>
            <p className="subtle" style={{ margin: '4px 0 0', fontSize: 12 }}>
              One row per account and post — a cross-post to Facebook is its own publication, because
              Instagram reports reach, Facebook clicks and TikTok views, and adding them together
              would inflate this by about five times.
            </p>
          </div>
          {pubs.length === 0 ? (
            <div className="pad">
              <p className="subtle" style={{ margin: 0 }}>
                Nothing linked to this ticket yet. When the post goes live the matcher links it by
                URL or caption, and the first reading follows the next nightly pull.
              </p>
            </div>
          ) : (
            readouts.map(({ pub, readouts: rs }) => (
              <div key={pub.id} className="pad" style={{ borderBottom: '1px solid var(--mv-border)' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                  <b>{pub.channel ?? 'post'} · {pub.accountRef}</b>
                  <span className="subtle" style={{ fontSize: 12 }}>
                    {pub.postType ?? 'type unknown'}
                    {pub.publishedAt && ` · live ${pub.publishedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                  </span>
                  {pub.publishedUrl && (
                    <a href={`https://${pub.publishedUrl}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                      {pub.publishedUrl}
                    </a>
                  )}
                  <Badge tone={pub.confirmed ? 'success' : 'staged'}>
                    {pub.confirmed ? `linked · ${pub.linkTier}` : 'likely — needs confirming'}
                  </Badge>
                  {pub.tags.length > 0 && pub.tags.map((tag) => <Badge key={tag} tone="neutral">{tag}</Badge>)}
                </div>
                <PerformanceBand
                  readouts={rs}
                  goalMetric={goalMetric(pub.goal, null)}
                  source="Hootsuite Perch"
                />
              </div>
            ))
          )}
        </div>

        <div className="card">
          <div className="pad" style={{ borderBottom: '1px solid var(--mv-border)' }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>What the agents noticed</h2>
            <p className="subtle" style={{ margin: '4px 0 0', fontSize: 12 }}>
              Computed from the rows, not written by a model. Each one names its evidence and who it
              is for; none of them changes anything on its own.
            </p>
          </div>
          <div className="pad">
            {mine.length === 0 ? (
              <p className="subtle" style={{ margin: 0 }}>
                Nothing to report on this one — which is itself a reading, not an absence of checks.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {mine.map((s) => (
                  <div key={s.id} style={{ display: 'grid', gap: 4, paddingBottom: 10, borderBottom: '1px solid var(--mv-border)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Badge tone={KIND_TONE[s.kind as keyof typeof KIND_TONE] ?? 'neutral'}>{s.kind}</Badge>
                      <b style={{ fontSize: 13 }}>{s.title}</b>
                      <span className="subtle" style={{ fontSize: 11 }}>
                        {AGENT_LABEL[s.agent as AgentId] ?? s.agent}{s.ownerHint && ` → ${s.ownerHint}`}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13 }}>{s.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {t.creativeBrief && (
          <div className="card">
            <div className="pad" style={{ borderBottom: '1px solid var(--mv-border)' }}>
              <h2 style={{ margin: 0, fontSize: 15 }}>Brief</h2>
            </div>
            <div className="pad"><BriefText text={t.creativeBrief} /></div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
