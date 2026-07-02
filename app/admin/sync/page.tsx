import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/ui/AppShell';
import { getAdminAccess } from '@/lib/admin/access';
import { homeRouteForRoles } from '@/lib/roles';
import { getSyncHealth } from '@/lib/sync/health';

export const dynamic = 'force-dynamic';

function ago(iso: string | null): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' | 'ok' }) {
  const color = tone === 'warn' ? 'text-brand' : tone === 'ok' ? 'text-text' : 'text-text';
  return (
    <div className="card pad">
      <div className="text-2xs text-text-muted" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>
      <div className={`font-display ${color}`} style={{ fontSize: 26, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export default async function SyncHealthPage() {
  const access = await getAdminAccess();
  if (!access.isAdmin) redirect(homeRouteForRoles(access.roles)); // admin-only surface

  const h = await getSyncHealth();

  return (
    <AppShell
      title="Sync health"
      subtitle="Is Airtable in step with Postgres? Outbox depth, last push, inbound-pull cursor, and recent failures."
    >
      <Link href="/settings/team" className="btn ghost sm" style={{ textDecoration: 'none', marginBottom: 14 }}>← Admin panel</Link>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Stat label="Tickets in Postgres" value={h.ticketsInPg.toLocaleString()} />
        <Stat label="Outbox pending" value={String(h.outboxPending)} tone={h.outboxPending > 50 ? 'warn' : undefined} />
        <Stat label="Outbox failed" value={String(h.outboxError)} tone={h.outboxError > 0 ? 'warn' : 'ok'} />
        <Stat label="Last push → Airtable" value={ago(h.lastPushedAt)} />
        <Stat label="Inbound pull cursor" value={ago(h.pullCursorUpdatedAt)} />
      </div>

      <div className="card pad" style={{ marginBottom: 16 }}>
        <div className="text-sm">
          <div><span className="text-text-muted">Push drainer:</span> {h.pushEnabled ? 'enabled' : 'disabled (AIRTABLE_PUSH_ENABLED not set)'}</div>
          <div style={{ marginTop: 4 }}><span className="text-text-muted">Pull watermark:</span> {h.pullCursor ?? 'not seeded yet'}</div>
        </div>
      </div>

      {h.recentErrors.length > 0 && (
        <div className="card pad">
          <div className="font-display text-lg" style={{ marginBottom: 8 }}>Recent push failures</div>
          <table className="list">
            <thead>
              <tr><th>Ticket</th><th>Attempts</th><th>Last error</th><th>Enqueued</th></tr>
            </thead>
            <tbody>
              {h.recentErrors.map((e) => (
                <tr key={e.ticketId + e.enqueuedAt}>
                  <td><Link href={`/tickets/${e.ticketId}`}>{e.ticketId.slice(0, 8)}…</Link></td>
                  <td>{e.attempts}</td>
                  <td className="text-text-muted">{e.lastError ?? '—'}</td>
                  <td className="text-text-muted">{ago(e.enqueuedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
