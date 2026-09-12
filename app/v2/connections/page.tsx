import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { Badge } from '@/components/ui/Badge';
import { getV2Session } from '@/lib/v2/access';
import { coverage, freshness } from '@/lib/publications/repository';
import { openSignals } from '@/lib/signals/emit';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function pct(a: number, b: number): string {
  if (b === 0) return '—';
  return `${Math.round((a / b) * 100)}%`;
}

export default async function V2ConnectionsPage() {
  const session = await getV2Session();
  if (!session) {
    return (
      <AppShell title="Connections & data health" subtitle="Content Studio v2 preview">
        <div className="card pad">
          <p>Ask Rhythm to add your address to <code>V2_ALLOWLIST_EMAILS</code>.</p>
        </div>
      </AppShell>
    );
  }

  const [cov, signals, exampleTicket] = await Promise.all([
    coverage(),
    openSignals({ limit: 100 }),
    prisma.publication.findFirst({
      where: { ticketAirtableId: { not: null } },
      orderBy: { publishedAt: 'desc' },
      select: { ticketAirtableId: true },
    }),
  ]);
  const fresh = freshness(cov.lastCaptureAt);

  const byKind = signals.reduce<Record<string, number>>((acc, s) => {
    acc[s.kind] = (acc[s.kind] ?? 0) + 1;
    return acc;
  }, {});

  const sources = [
    { name: 'Hootsuite Perch', covers: 'Instagram · Facebook · TikTok', how: 'app-held OAuth, nightly', state: 'flowing' as const,
      note: `${cov.metricsTotal.toLocaleString('en-US')} observations · ${fresh.label}` },
    { name: 'Metabase', covers: 'Leads Q31846 · Revenue Q32044', how: 'session-side — no app credential yet', state: 'session' as const,
      note: 'Revenue must be filtered to organic social and summed on distinct order ids' },
    { name: 'YouTube', covers: 'Vishen Lakhiani Media', how: 'public page today', state: 'session' as const,
      note: 'CTR, average view duration and retention need the Analytics API with channel OAuth' },
    { name: 'LinkedIn', covers: 'VL · Two Comma PR', how: 'not connected', state: 'off' as const,
      note: 'Manual 24h and 7-day entry, with the enterer named, until an API route exists' },
    { name: 'Braze', covers: 'Email', how: 'not connected', state: 'off' as const,
      note: 'The email lane has plans and owners but no results' },
  ];

  return (
    <AppShell
      title="Connections & data health"
      subtitle="Where each number comes from, how fresh it is, and how much of the work we can actually account for"
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <div className="card pad">
          <h2 style={{ margin: '0 0 4px', fontSize: 15 }}>The two numbers this is judged on</h2>
          <p className="subtle" style={{ margin: '0 0 14px', fontSize: 12 }}>
            Baseline taken today, {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })},
            the day the join first existed. Before it, attribution was nought of 1,642 metric rows.
          </p>
          <div className="kpi-grid">
            <div className="kpi">
              <div className="lab">Published posts we can account for</div>
              <div className="val">{pct(cov.linked, cov.publications)}</div>
              <div className="sub">
                {cov.linked.toLocaleString('en-US')} of {cov.publications.toLocaleString('en-US')} publications
                carry a ticket or a video · target 80%
              </div>
            </div>
            <div className="kpi">
              <div className="lab">Linked within 24 hours</div>
              <div className="val">{pct(cov.linkedWithin24h, cov.linkedWithKnownTime)}</div>
              <div className="sub">
                {cov.linkedWithin24h} of {cov.linkedWithKnownTime} with a known publish time.
                Backfilled rows count from when the link was made, so this only becomes meaningful
                for posts published from today.
              </div>
            </div>
            <div className="kpi">
              <div className="lab">Awaiting a human</div>
              <div className="val">{cov.proposed}</div>
              <div className="sub">matches the system will not make on its own</div>
            </div>
            <div className="kpi">
              <div className="lab">Published outside the workflow</div>
              <div className="val">{cov.orphans}</div>
              <div className="sub">real posts with no ticket — they stay in cohorts as peers</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="pad" style={{ borderBottom: '1px solid var(--mv-border)' }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>The mapper fix, in numbers</h2>
            <p className="subtle" style={{ margin: '4px 0 0', fontSize: 12 }}>
              Views and retention were in every payload we stored and in none of the columns we read.
              The key <code>post_views</code> normalises to <code>postviews</code>, which never matched
              the <code>views</code> the extractor was looking for.
            </p>
          </div>
          <div className="pad">
            <table className="list">
              <tbody>
                <tr>
                  <td>Observations carrying a view count</td>
                  <td style={{ textAlign: 'right' }}><b>{cov.metricsWithViews.toLocaleString('en-US')}</b> of {cov.metricsTotal.toLocaleString('en-US')}</td>
                </tr>
                <tr>
                  <td>Observations carrying retention (average watch)</td>
                  <td style={{ textAlign: 'right' }}><b>{cov.metricsWithWatch.toLocaleString('en-US')}</b> of {cov.metricsTotal.toLocaleString('en-US')}</td>
                </tr>
                <tr>
                  <td>Observations now owned by a publication</td>
                  <td style={{ textAlign: 'right' }}><b>{cov.metricsWithPublication.toLocaleString('en-US')}</b> of {cov.metricsTotal.toLocaleString('en-US')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="pad" style={{ borderBottom: '1px solid var(--mv-border)' }}>
            <h2 style={{ margin: 0, fontSize: 15 }}>Sources</h2>
          </div>
          <div className="pad">
            <table className="list">
              <thead>
                <tr><th>Source</th><th>Covers</th><th>How</th><th>State</th></tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.name}>
                    <td><b>{s.name}</b><div className="subtle" style={{ fontSize: 11 }}>{s.note}</div></td>
                    <td className="subtle">{s.covers}</td>
                    <td className="subtle">{s.how}</td>
                    <td>
                      <Badge tone={s.state === 'flowing' ? 'success' : s.state === 'session' ? 'staged' : 'danger'}>
                        {s.state === 'flowing' ? 'flowing' : s.state === 'session' ? 'session-side' : 'not connected'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card pad">
          <h2 style={{ margin: '0 0 4px', fontSize: 15 }}>Signals open right now</h2>
          <p className="subtle" style={{ margin: '0 0 10px', fontSize: 12 }}>
            Every one computed from rows, keyed so a daily re-run updates rather than repeats, and
            closing itself when its condition stops holding.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {Object.entries(byKind).length === 0
              ? <span className="subtle">None — run the checks from the backfill route.</span>
              : Object.entries(byKind).map(([kind, n]) => (
                  <Badge key={kind} tone="neutral">{kind} · {n}</Badge>
                ))}
          </div>
          {exampleTicket?.ticketAirtableId && (
            <p style={{ margin: '14px 0 0', fontSize: 13 }}>
              See one in place on{' '}
              <Link href={`/v2/work-item/${exampleTicket.ticketAirtableId}`}>a work item →</Link>
            </p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
