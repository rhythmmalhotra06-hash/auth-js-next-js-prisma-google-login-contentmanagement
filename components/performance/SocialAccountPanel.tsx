import { Icon } from '@/components/ui/Icon';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { formatCount } from '@/lib/metrics/social-metric-types';
import type { AccountBoard, AccountPerformance } from '@/lib/metrics/social-perf';

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
  if (!caption) return 'Untitled post';
  const flat = caption.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

function TopPosts({ board }: { board: AccountBoard }) {
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
              <th style={{ width: 110 }}>Engagement</th>
              <th style={{ width: 90 }}>Posted</th>
              <th style={{ width: 56 }} />
            </tr>
          </thead>
          <tbody>
            {board.top.map((p) => (
              <tr key={p.key}>
                <td><div className="t-title">{trim(p.caption)}</div></td>
                <td className="tabular-nums">{formatCount(p.reach)}</td>
                <td className="tabular-nums">
                  {p.engagementRate !== null ? `${p.engagementRate}%` : <span className="subtle">—</span>}
                </td>
                <td>{shortDate(p.postedAt)}</td>
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
export function AccountBoardSection({ board }: { board: AccountBoard }) {
  const best = board.top[0] ?? null;
  return (
    <>
      <div className="sec-head">
        <h3>@{board.account}</h3>
        <span className="hint">{board.posts} post{board.posts === 1 ? '' : 's'} · by reach</span>
      </div>
      <KpiGrid>
        <Kpi i={0} label="Total reach" value={formatCount(board.reach)} sub={`${board.posts} post${board.posts === 1 ? '' : 's'}`} />
        <Kpi i={1} label="Avg engagement" value={board.avgEngagement !== null ? `${board.avgEngagement}%` : '—'} sub={board.avgEngagement !== null ? 'across reported posts' : 'not reported'} />
        <Kpi i={2} label="Top post" value={best ? formatCount(best.reach) : '—'} sub={best && best.engagementRate !== null ? `${best.engagementRate}% engagement` : 'no numbers yet'} />
      </KpiGrid>
      <TopPosts board={board} />
    </>
  );
}

export function SocialAccountPanel({ data }: { data: AccountPerformance }) {
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
            <Kpi i={1} label="Avg engagement" value={data.avgEngagement !== null ? `${data.avgEngagement}%` : '—'} sub="across all reported posts" />
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

      {data.boards.map((board) => <AccountBoardSection key={board.account} board={board} />)}

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
