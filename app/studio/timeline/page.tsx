import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { BackLink } from '@/components/studio/BackLink';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { MetricCard, MetricGrid } from '@/components/ui/MetricCard';
import { TicketStatusBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { requireStudioAccess } from '@/lib/studio/guard';
import { getTicketTimelines } from '@/lib/tickets/data';
import { FUNNEL_BUCKETS, summarizeTimelines, formatDays } from '@/lib/tickets/timeline';

export const dynamic = 'force-dynamic';

// Where time is actually going, stage by stage — answers "why is this taking 20 days"
// with the TicketEvent history that's been captured all along but never surfaced.
export default async function StudioTimelinePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireStudioAccess();
  const sp = await searchParams;
  const eventType = typeof sp.eventType === 'string' ? sp.eventType : undefined;

  const allRows = await getTicketTimelines();
  const eventTypes = [...new Set(allRows.map((r) => r.eventType).filter((n): n is string => !!n))].sort();
  const rows = eventType ? allRows.filter((r) => r.eventType === eventType) : allRows;
  const summary = summarizeTimelines(rows);
  const worst = summary.inFlight[0];

  return (
    <AppShell title="Production timeline" subtitle="Elapsed wall-clock days per stage — not working days.">
      <BackLink />

      <div className="t-meta" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
        <Link href="/studio/timeline" className={`chipbtn${!eventType ? ' on' : ''}`} style={{ textDecoration: 'none' }}>All event types</Link>
        {eventTypes.map((et) => (
          <Link key={et} href={`/studio/timeline?eventType=${encodeURIComponent(et)}`} className={`chipbtn${eventType === et ? ' on' : ''}`} style={{ textDecoration: 'none' }}>{et}</Link>
        ))}
      </div>

      <KpiGrid>
        <Kpi
          icon={<Icon name="chart" size={13} />}
          label="Avg. Requested → Published"
          value={summary.avgTotalDays != null ? formatDays(summary.avgTotalDays) : '—'}
          sub={summary.completedCount ? `${summary.completedCount} recently completed` : 'no completed tickets yet'}
          i={0}
        />
        <Kpi label="In flight" value={summary.inFlight.length} sub="not yet published" i={1} />
        <Kpi
          tone={worst ? 'danger' : undefined}
          icon={<Icon name="clock" size={13} />}
          label="Most stuck"
          value={worst ? formatDays(worst.daysInCurrentStage) : '—'}
          sub={worst ? `in ${worst.ticketStatus}` : 'nothing in flight'}
          i={2}
        />
      </KpiGrid>

      <div className="sec-head"><h3>Average days per stage</h3><span className="hint">recently completed tickets only</span></div>
      <MetricGrid className="mb-6">
        {FUNNEL_BUCKETS.map((b) => {
          const avg = summary.avgDaysByBucket[b.key];
          return <MetricCard key={b.key} label={b.label} value={avg != null ? formatDays(avg) : '—'} />;
        })}
      </MetricGrid>

      <div className="sec-head"><h3>Most delayed</h3><span className="hint">sorted by days stuck in the current stage</span></div>
      <div className="stack">
        {summary.inFlight.length === 0 && (
          <div className="empty">Nothing in flight{eventType ? ` for ${eventType}` : ''}.</div>
        )}
        {summary.inFlight.slice(0, 25).map((r) => (
          <Link key={r.id} href={`/tickets/${r.id}`} className="card pad" style={{ display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 13.5 }}>{r.title}</b>
              <div className="t-meta">
                <TicketStatusBadge status={r.ticketStatus} />
                <span className="risk high"><Icon name="clock" size={11} /> stuck {formatDays(r.daysInCurrentStage)}</span>
                {r.eventType && <span>{r.eventType}</span>}
              </div>
            </div>
            <Icon name="arrow" size={16} />
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
