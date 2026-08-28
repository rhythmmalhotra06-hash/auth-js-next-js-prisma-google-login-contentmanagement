import { redirect } from 'next/navigation';
import { AppShell } from '@/components/ui/AppShell';
import { getAdminAccess } from '@/lib/admin/access';
import { homeRouteForRoles } from '@/lib/roles';
import { getStatus } from '@/lib/hootsuite/oauth';
import { prisma } from '@/lib/prisma';
import { HootsuiteControls } from '@/components/admin/HootsuiteControls';

// Admin surface for the Hootsuite Perch integration — the automated source for the
// performance loop. One consent here replaces "someone runs a pull in a chat session".

export const dynamic = 'force-dynamic';

async function metricCounts(): Promise<{ total: number; fromPerch: number; latest: string | null }> {
  try {
    const [total, fromPerch, latest] = await Promise.all([
      prisma.socialMetric.count(),
      prisma.socialMetric.count({ where: { source: 'hootsuite:perch' } }),
      prisma.socialMetric.findFirst({ orderBy: { capturedAt: 'desc' }, select: { capturedAt: true } }),
    ]);
    return { total, fromPerch, latest: latest?.capturedAt.toISOString() ?? null };
  } catch {
    return { total: 0, fromPerch: 0, latest: null };
  }
}

export default async function HootsuitePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await getAdminAccess();
  if (!access.isAdmin) redirect(homeRouteForRoles(access.roles)); // admin-only surface

  const [status, counts, params] = await Promise.all([getStatus(), metricCounts(), searchParams]);

  return (
    <AppShell title="Hootsuite" subtitle="Perch analytics → the performance numbers on published work">
      <div className="space-y-4">
        {params.connected === '1' && (
          <div className="card pad border-success">
            <div className="text-xs font-semibold text-success-content">
              Connected. Run &ldquo;Inspect available tools&rdquo; to see what Perch exposes, then pull metrics.
            </div>
          </div>
        )}
        {params.error && (
          <div className="card pad border-danger">
            <div className="text-xs font-semibold text-danger-content">Could not connect: {params.error}</div>
          </div>
        )}

        <div className="card pad">
          <div className="text-2xs font-bold uppercase tracking-wide text-text-subtle">Connection</div>
          <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[13px]">
            <dt className="font-semibold text-text-subtle">Status</dt>
            <dd className={status.connected ? 'text-success-content' : 'text-text-muted'}>
              {status.connected ? 'Connected' : status.unreadable ? 'Stored token unreadable — reconnect' : 'Not connected'}
            </dd>
            <dt className="font-semibold text-text-subtle">Scope</dt>
            <dd className="text-text">{status.scope ?? '—'}</dd>
            <dt className="font-semibold text-text-subtle">Access token expires</dt>
            <dd className="text-text">{status.expiresAt ? new Date(status.expiresAt).toLocaleString() : '—'}</dd>
            <dt className="font-semibold text-text-subtle">Connected by</dt>
            <dd className="text-text">{status.connectedBy ?? '—'}{status.connectedAt ? ` · ${new Date(status.connectedAt).toLocaleDateString()}` : ''}</dd>
            <dt className="font-semibold text-text-subtle">Metrics stored</dt>
            <dd className="text-text tabular-nums">
              {counts.total} total · {counts.fromPerch} from Perch
              {counts.latest ? ` · newest ${new Date(counts.latest).toLocaleDateString()}` : ''}
            </dd>
          </dl>
          {status.lastError && (
            <p className="mt-2.5 text-2xs text-danger-content">Last error: {status.lastError}</p>
          )}
        </div>

        <HootsuiteControls connected={status.connected} />

        <div className="card pad">
          <div className="text-2xs font-bold uppercase tracking-wide text-text-subtle">How this works</div>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-text-muted">
            <li>· Read-only. The grant requests <b>analytics:read</b> plus <b>offline</b> — nothing here can publish or change a post.</li>
            <li>· <b>offline</b> is what makes the schedule possible: the app keeps a refresh token and renews access on its own, so numbers arrive without anyone starting a session.</li>
            <li>· The nightly job is <code>.github/workflows/perch-metrics.yml</code> → <code>POST /api/metrics/perch-pull</code>. Pulls are idempotent, so re-running is safe.</li>
            <li>· Numbers land in <code>social_metrics</code> and surface in Studio&apos;s &ldquo;Live &amp; performing&rdquo; band. Manual entry writes the same table.</li>
            <li>· A post is matched to your records by its <b>published URL</b>. Unmatched rows are still stored and counted, so a drifted link is visible rather than lost.</li>
            <li>· <b>The connection sees exactly what the person who pressed Connect sees.</b> If a profile is missing, it&apos;s a Hootsuite permission on that account, not a bug here — check with &ldquo;Which accounts can we read?&rdquo;, then either grant that user analytics access to the profile or reconnect as someone who already has it.</li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
