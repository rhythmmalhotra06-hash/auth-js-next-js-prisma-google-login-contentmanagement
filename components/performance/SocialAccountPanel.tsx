import { Icon } from '@/components/ui/Icon';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { formatCount } from '@/lib/metrics/social-metric-types';
import type { AccountPerformance } from '@/lib/metrics/social-perf';

// Account-level social performance — "which posts landed", per account, with no join.
//
// Deliberately not attributed to portal records: Perch reports on the social accounts
// connected in Hootsuite, which today are not the channels VishenVideo tracks, so a
// per-ticket join would match nothing. Rather than show a broken join or nothing at all,
// this reads the numbers at the level they're actually true — the account.

const shortDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

/** One line of caption, tidied — the body arrives with newlines and hashtag tails. */
function trim(caption: string | null, max = 96): string {
  if (!caption) return 'Untitled post';
  const flat = caption.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

export function SocialAccountPanel({ data }: { data: AccountPerformance }) {
  if (data.posts === 0) return null;

  const total = data.accounts.reduce((s, a) => s + a.reach, 0);
  const rated = data.accounts.filter((a) => a.avgEngagement !== null);
  const avg = rated.length
    ? Math.round((rated.reduce((s, a) => s + (a.avgEngagement ?? 0) * a.posts, 0) / rated.reduce((s, a) => s + a.posts, 0)) * 100) / 100
    : null;
  const best = data.top[0] ?? null;

  return (
    <>
      <div className="sec-head">
        <h3>Social performance</h3>
        <span className="hint">
          live from Hootsuite{data.latestCapture ? ` · captured ${shortDate(data.latestCapture)}` : ''}
        </span>
      </div>

      <KpiGrid>
        <Kpi i={0} label="Total reach" value={formatCount(total)} sub={`${data.posts} post${data.posts === 1 ? '' : 's'} tracked`} />
        <Kpi i={1} label="Avg engagement" value={avg !== null ? `${avg}%` : '—'} sub={avg !== null ? 'weighted by posts' : 'not reported'} />
        <Kpi i={2} label="Accounts" value={data.accounts.length} sub={data.accounts.map((a) => a.account).slice(0, 2).join(', ') || '—'} />
        <Kpi i={3} label="Top post" value={best ? formatCount(best.reach) : '—'} sub={best ? `${best.engagementRate ?? '—'}% engagement` : 'no numbers yet'} />
      </KpiGrid>

      {data.accounts.length > 1 && (
        <div className="tw" style={{ marginBottom: 18 }}>
          <div className="tscroll">
            <table className="list">
              <thead><tr><th>Account</th><th style={{ width: 90 }}>Posts</th><th style={{ width: 110 }}>Reach</th><th style={{ width: 130 }}>Avg engagement</th></tr></thead>
              <tbody>
                {data.accounts.map((a) => (
                  <tr key={a.account}>
                    <td><div className="t-title">{a.account}</div></td>
                    <td className="tabular-nums">{a.posts}</td>
                    <td className="tabular-nums">{formatCount(a.reach)}</td>
                    <td className="tabular-nums">{a.avgEngagement !== null ? `${a.avgEngagement}%` : <span className="subtle">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="sec-head"><h3>Top performing posts</h3><span className="hint">by reach</span></div>
      <div className="tw" style={{ marginBottom: 18 }}>
        <div className="tscroll">
          <table className="list">
            <thead>
              <tr>
                <th>Post</th>
                <th style={{ width: 110 }}>Reach</th>
                <th style={{ width: 110 }}>Engagement</th>
                <th style={{ width: 90 }}>Posted</th>
                <th style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {data.top.map((p) => (
                <tr key={p.key}>
                  <td>
                    <div className="t-title">{trim(p.caption)}</div>
                    <div className="t-meta">{p.account ?? '—'}</div>
                  </td>
                  <td className="tabular-nums">{formatCount(p.reach)}</td>
                  <td className="tabular-nums">{p.engagementRate !== null ? `${p.engagementRate}%` : <span className="subtle">—</span>}</td>
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

      {data.attributed === 0 && (
        <p className="t-meta" style={{ marginBottom: 18 }}>
          These are account-level numbers. None are linked to a ticket yet, because Hootsuite is
          reporting on channels the portal doesn&apos;t hold published links for — connect the
          profiles whose work lives here, and each post will attach to the record that made it.
        </p>
      )}
    </>
  );
}
