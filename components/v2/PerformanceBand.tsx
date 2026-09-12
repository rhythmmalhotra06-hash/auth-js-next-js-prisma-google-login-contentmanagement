import { METRIC_LABEL, type Readout, type MetricKey } from '@/lib/publications/repository';
import { Badge } from '@/components/ui/Badge';

/**
 * A publication's readout against its peers.
 *
 * Three rules hold this together, and all three exist because a number without them has
 * already misled someone on this team:
 *   · every figure states its source, the age of the capture, and how many peers it was
 *     measured against — "3,725 views" alone is not information;
 *   · the goal metric leads, because a gated-CTA post judged on views is judged on the wrong
 *     thing [D36];
 *   · under three peers there is no median at all — not a faint one, not a fallback [D105].
 */

function fmt(n: number | null, metric: MetricKey): string {
  if (n === null) return '—';
  if (metric === 'engagementRate') return `${n.toFixed(2)}%`;
  if (metric === 'avgWatchSeconds') return `${Math.round(n)}s`;
  return Math.round(n).toLocaleString('en-US');
}

function Position({ rank, n }: { rank: number | null; n: number }) {
  if (!rank || n < 3) return <span className="subtle">—</span>;
  const quartile = Math.ceil(n / 4);
  const where = rank <= quartile ? 'top quartile' : rank > n - quartile ? 'bottom quartile' : 'mid';
  return (
    <span>
      <b>{rank}</b><span className="subtle">/{n + 1}</span>{' '}
      <span className="subtle">· {where}</span>
    </span>
  );
}

export function PerformanceBand({
  readouts, goalMetric, source,
}: { readouts: Readout[]; goalMetric: MetricKey; source: string }) {
  if (readouts.length === 0) {
    return (
      <p className="subtle" style={{ margin: 0 }}>
        No capture yet. Perch pulls nightly, so the first reading arrives the morning after this
        goes live — nothing is read before then, because a number from the first few hours says
        more about the hour than the post.
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {readouts.map((r) => {
        const ordered = [...r.readings].sort((a, b) =>
          a.metric === goalMetric ? -1 : b.metric === goalMetric ? 1 : 0);
        return (
          <div key={r.window}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <b>{r.window === 'day1' ? 'First day' : 'Day seven'}</b>
              <Badge tone="neutral">{source} · captured {r.snapshot.ageHours}h after publish</Badge>
              <span className="subtle" style={{ fontSize: 12 }}>
                {r.belowFloor
                  ? `only ${r.n} comparable post${r.n === 1 ? '' : 's'} — too few for a median, so none is shown`
                  : `${r.cohortLabel} · n = ${r.n}`}
              </span>
            </div>
            <table className="list">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th style={{ textAlign: 'right' }}>This post</th>
                  <th style={{ textAlign: 'right' }}>Cohort median</th>
                  <th>Position</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((reading) => (
                  <tr key={reading.metric}>
                    <td>
                      {METRIC_LABEL[reading.metric]}
                      {reading.metric === goalMetric && <> <Badge tone="brand">goal</Badge></>}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      <b>{fmt(reading.value, reading.metric)}</b>
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} className="subtle">
                      {reading.cohortMedian === null && reading.n < 3
                        ? <span title="fewer than three comparable posts">not enough peers</span>
                        : fmt(reading.cohortMedian, reading.metric)}
                    </td>
                    <td><Position rank={reading.rank} n={reading.n} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
