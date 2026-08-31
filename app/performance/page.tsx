import { Suspense } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { Icon } from '@/components/ui/Icon';
import { QueueSkeleton } from '@/components/ui/Skeletons';
import { getAdminAccess } from '@/lib/admin/access';
import { isStudioAllowlisted } from '@/lib/studio/access';
import { getAccountPerformance, getAccountPerformanceForRange, type AccountPerformance } from '@/lib/metrics/social-perf';
import { getQueueTickets, getRecentShipped } from '@/lib/tickets/data';
import { SocialAccountPanel } from '@/components/performance/SocialAccountPanel';
import { PerformanceRangeFilter, type PerformanceRange } from '@/components/performance/PerformanceRangeFilter';
import type { TicketOption } from '@/components/performance/PostRowActions';

// Performance — THE NUMBERS. How published work actually landed: reach and engagement per
// post, one board per connected account, pulled nightly from Hootsuite Perch.
//
// Split from capacity/throughput (now /performance/capacity) because they answer different
// questions for different people: this page is "how did it do", that page is "can we take
// more work". They were fighting for the same screen.
//
// Date filter: 7/30 days are free (cached nightly Perch windows — see
// PerformanceRangeFilter's doc). Custom is a live Hootsuite call every time, so it's
// gated to admins + the Studio allowlist (Vishen, Titus) rather than every viewer.

export const dynamic = 'force-dynamic';

const isoToday = (): string => new Date().toISOString().slice(0, 10);
const isoDaysAgo = (n: number): string => new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);

async function Numbers({ isAdmin, canCustom, range, from, to }: {
  isAdmin: boolean;
  canCustom: boolean;
  range: PerformanceRange;
  from: string;
  to: string;
}) {
  let social: AccountPerformance;
  let rangeError: string | null = null;

  if (range === 'custom' && canCustom) {
    try {
      social = await getAccountPerformanceForRange(from, to, { limit: 10 });
    } catch (err) {
      // Hootsuite failed live — fall back to the standing 30-day cache rather than an
      // empty page, and say what happened instead of pretending it was quiet.
      rangeError = err instanceof Error ? err.message : String(err);
      social = await getAccountPerformance({ limit: 10, windowDays: 30 });
    }
  } else {
    social = await getAccountPerformance({ limit: 10, windowDays: range === '30' ? 30 : 7 });
  }

  const filter = <PerformanceRangeFilter range={range} from={from} to={to} canCustom={canCustom} />;

  if (social.posts === 0) {
    return (
      <>
        {filter}
        <div className="banner future" style={{ marginTop: 16, marginBottom: 16 }}>
          <Icon name="chart" size={18} />
          <div>
            <b>No published numbers yet{range === 'custom' ? ' for this range' : ''}.</b>{' '}
            {isAdmin
              ? <>Connect Hootsuite at <Link href="/admin/hootsuite">/admin/hootsuite</Link> — after that the nightly pull fills this page on its own.</>
              : <>An admin needs to connect Hootsuite. Once that&apos;s done the numbers arrive nightly.</>}
          </div>
        </div>
        <p className="t-meta">
          Looking for throughput, capacity or at-risk work? That&apos;s on{' '}
          <Link href="/performance/capacity">Capacity &amp; risk</Link>.
        </p>
      </>
    );
  }

  // Ticket options for "attach to ticket" — active work plus recent ships, since a
  // published post is usually attached AFTER its ticket was completed.
  const [active, shipped] = await Promise.all([getQueueTickets(), getRecentShipped(60)]);
  const tickets: TicketOption[] = [...active, ...shipped]
    .filter((t, i, a) => a.findIndex((x) => x.id === t.id) === i)
    .map((t) => ({ id: t.id, label: t.assignee ? `${t.title} — ${t.assignee}` : t.title }));

  return (
    <>
      {filter}
      {rangeError && (
        <p className="t-meta" style={{ color: 'var(--danger)', marginTop: 8 }}>
          Couldn&apos;t reach Hootsuite for that range ({rangeError}) — showing the last 30 days instead.
        </p>
      )}
      <div style={{ marginTop: 16 }}>
        <SocialAccountPanel data={social} tickets={tickets} />
      </div>
      <p className="t-meta">
        Capacity, throughput and at-risk work live on{' '}
        <Link href="/performance/capacity">Capacity &amp; risk</Link>.
      </p>
    </>
  );
}

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const { isAdmin, email } = await getAdminAccess();
  const canCustom = isAdmin || isStudioAllowlisted(email);

  const sp = await searchParams;
  const range: PerformanceRange = sp.range === '30' ? '30' : sp.range === 'custom' && canCustom ? 'custom' : '7';
  let from = range === 'custom' ? (sp.from || isoDaysAgo(30)) : isoDaysAgo(range === '30' ? 30 : 7);
  let to = range === 'custom' ? (sp.to || isoToday()) : isoToday();
  if (range === 'custom' && from > to) [from, to] = [to, from]; // a swapped picker shouldn't error, just flip

  return (
    <AppShell title="Performance" subtitle="How published work landed — reach and engagement per post, by account">
      <Suspense fallback={<QueueSkeleton kpis={3} />}>
        <Numbers isAdmin={isAdmin} canCustom={canCustom} range={range} from={from} to={to} />
      </Suspense>
    </AppShell>
  );
}
