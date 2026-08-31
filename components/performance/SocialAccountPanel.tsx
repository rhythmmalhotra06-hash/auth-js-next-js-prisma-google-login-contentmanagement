import { Icon } from '@/components/ui/Icon';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { Sparkline } from '@/components/ui/Sparkline';
import { formatCount, formatPct, formatDelta } from '@/lib/metrics/social-metric-types';
import type { AccountBoard, AccountPerformance, SocialPostRow } from '@/lib/metrics/social-perf';
import { PostRowActions, type TicketOption } from '@/components/performance/PostRowActions';

// Social performance, one board per account.
//
// Per-account rather than per-ticket because that's the level the numbers are true at:
// Perch reports on the profiles connected in Hootsuite, and those aren't always channels
// the portal holds published links for. A board appears for every account that reports
// data, so connecting another profile in Hootsuite adds its board with no code change.

const shortDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

/** One tidy line of caption — bodies arrive with newlines and long hashtag tails. */
function trim(caption: string | null, max = 96): string {
  const flat = (caption ?? '').replace(/\s+/g, ' ').trim();
  // Many posts carry no caption text (53 of 92 on the first real pull), so say so plainly
  // rather than inventing a title.
  if (!flat) return '(no caption)';
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

/**
 * How a post did relative to its account's own median. This is the difference between
 * reporting and insight: "158k" is a number, "3.1x median" is a judgement you can act on.
 */
function VsMedian({ x }: { x: number | null }) {
  if (x === null) return <span className="subtle">—</span>;
  const tone = x >= 2 ? 'var(--green)' : x >= 1 ? 'var(--text-muted)' : 'var(--gold-content)';
  return (
    <span className="tabular-nums" style={{ color: tone, fontWeight: x >= 2 ? 700 : 500 }}>
      {x}×{x >= 2 ? ' ▲' : x < 0.5 ? ' ▼' : ''}
    </span>
  );
}

function TopPosts({ board, tickets }: { board: AccountBoard; tickets: TicketOption[] }) {
  if (board.top.length === 0) {
    return <div className="empty">No numbers reported for this account yet.</div>;
  }
  return (
    <div className="tw" style={{ marginBottom: 18 }}>
      <div className="tscroll">
        <table className="list">
          <thead>
            <tr>
              <th>Post</th>
              <th style={{ width: 110 }}>Reach</th>
              <th style={{ width: 96 }}>vs median</th>
              <th style={{ width: 84 }}>Rank</th>
              <th style={{ width: 110 }}>Engagement</th>
              <th style={{ width: 90 }}>Posted</th>
              <th style={{ width: 260 }}>Actions</th>
              <th style={{ width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {board.top.map((p) => (
              <tr key={p.key}>
                <td>
                  <div className="t-title">{trim(p.caption)}</div>
                  {p.kind === 'story' && <div className="t-meta">story</div>}
                </td>
                <td className="tabular-nums">{formatCount(p.reach)}</td>
                <td><VsMedian x={p.vsMedian} /></td>
                <td className="tabular-nums">
                  {p.percentile !== null ? `top ${Math.max(1, 100 - p.percentile)}%` : <span className="subtle">—</span>}
                </td>
                <td className="tabular-nums">{formatPct(p.engagementRate)}</td>
                <td>{shortDate(p.postedAt)}</td>
                <td><PostRowActions post={p} tickets={tickets} /></td>
                <td>
                  {p.url
                    ? <a href={p.url} target="_blank" rel="noopener" style={{ textDecoration: 'none' }} aria-label="Open post"><Icon name="arrow" size={14} /></a>
                    : <span className="subtle">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** A single account's board: its own totals, then its own best posts. */
export function AccountBoardSection({ board, tickets }: { board: AccountBoard; tickets: TicketOption[] }) {
  const best = board.top[0] ?? null;
  const series = board.weekly.map((w) => w.reach);
  const trend = board.trendPct;

  return (
    <>
      <div className="sec-head">
        <h3>@{board.account}</h3>
        <span className="hint">
          {board.posts} post{board.posts === 1 ? '' : 's'}
          {trend !== null && ` · ${formatDelta(trend)} reach vs the week before`}
        </span>
      </div>
      <KpiGrid>
        <Kpi i={0} label="Total reach" value={formatCount(board.reach)} sub={`${board.posts} post${board.posts === 1 ? '' : 's'}`} />
        <Kpi i={1} label="Typical post" value={formatCount(board.medianReach)}
          sub={board.kinds.story > 0 ? `median of ${board.kinds.post} posts · ${board.kinds.story} stories judged separately` : 'median reach · the baseline'} />
        <Kpi i={2} label="Avg engagement" value={formatPct(board.avgEngagement)} sub={board.avgEngagement !== null ? 'across reported posts' : 'not reported'} />
        <Kpi i={3}
          tone={trend !== null && trend < 0 ? 'alert' : undefined}
          label="Last 7 days"
          value={formatDelta(trend)}
          sub={trend !== null ? 'reach vs prior 7 days' : 'not enough history'} />
      </KpiGrid>

      {series.length >= 2 && (
        <div className="card pad" style={{ marginBottom: 18 }}>
          <div className="t-meta" style={{ marginBottom: 6 }}>Weekly reach · last {series.length} weeks</div>
          <Sparkline series={series} w={520} h={54} />
        </div>
      )}

      <TopPosts board={board} tickets={tickets} />

      {board.underperformers.length > 0 && (
        <>
          <div className="sec-head">
            <h4 style={{ margin: 0, fontSize: 14 }}>Below half the baseline</h4>
            <span className="hint">worth asking why</span>
          </div>
          <div className="tw" style={{ marginBottom: 18 }}>
            <div className="tscroll">
              <table className="list">
                <thead><tr><th>Post</th><th style={{ width: 110 }}>Reach</th><th style={{ width: 96 }}>vs median</th><th style={{ width: 90 }}>Posted</th></tr></thead>
                <tbody>
                  {board.underperformers.map((p: SocialPostRow) => (
                    <tr key={p.key}>
                      <td><div className="t-title">{trim(p.caption)}</div></td>
                      <td className="tabular-nums">{formatCount(p.reach)}</td>
                      <td><VsMedian x={p.vsMedian} /></td>
                      <td>{shortDate(p.postedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export function SocialAccountPanel({ data, tickets }: { data: AccountPerformance; tickets: TicketOption[] }) {
  if (data.posts === 0) return null;
  const multi = data.boards.length > 1;

  return (
    <>
      {multi && (
        <>
          <div className="sec-head">
            <h3>All accounts</h3>
            <span className="hint">
              live from Hootsuite{data.latestCapture ? ` · captured ${shortDate(data.latestCapture)}` : ''}
            </span>
          </div>
          <KpiGrid>
            <Kpi i={0} label="Total reach" value={formatCount(data.reach)} sub={`${data.posts} posts · ${data.boards.length} accounts`} />
            <Kpi i={1} label="Avg engagement" value={formatPct(data.avgEngagement)} sub="across all reported posts" />
            <Kpi i={2} label="Best account" value={data.boards[0] ? formatCount(data.boards[0].reach) : '—'} sub={data.boards[0] ? `@${data.boards[0].account}` : '—'} />
          </KpiGrid>
        </>
      )}

      {!multi && (
        <div className="sec-head">
          <h3>Social performance</h3>
          <span className="hint">
            live from Hootsuite{data.latestCapture ? ` · captured ${shortDate(data.latestCapture)}` : ''}
          </span>
        </div>
      )}

      {data.boards.map((board) => <AccountBoardSection key={board.account} board={board} tickets={tickets} />)}

      {data.attributed === 0 && (
        <p className="t-meta" style={{ marginBottom: 18 }}>
          These are account-level numbers — none are linked to a ticket yet, because Hootsuite is
          reporting on channels the portal doesn&apos;t hold published links for. Connect the
          profiles whose work lives here and each post will attach to the record that made it.
        </p>
      )}
    </>
  );
}
