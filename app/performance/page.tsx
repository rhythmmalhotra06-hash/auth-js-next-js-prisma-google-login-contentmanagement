import { Suspense } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { Icon } from '@/components/ui/Icon';
import { QueueSkeleton } from '@/components/ui/Skeletons';
import { getAdminAccess } from '@/lib/admin/access';
import { getAccountPerformance } from '@/lib/metrics/social-perf';
import { getQueueTickets, getRecentShipped } from '@/lib/tickets/data';
import { SocialAccountPanel } from '@/components/performance/SocialAccountPanel';
import type { TicketOption } from '@/components/performance/PostRowActions';

// Performance — THE NUMBERS. How published work actually landed: reach and engagement per
// post, one board per connected account, pulled nightly from Hootsuite Perch.
//
// Split from capacity/throughput (now /performance/capacity) because they answer different
// questions for different people: this page is "how did it do", that page is "can we take
// more work". They were fighting for the same screen.

export const dynamic = 'force-dynamic';

async function Numbers({ isAdmin }: { isAdmin: boolean }) {
  const social = await getAccountPerformance({ limit: 10 });

  if (social.posts === 0) {
    return (
      <>
        <div className="banner future" style={{ marginBottom: 16 }}>
          <Icon name="chart" size={18} />
          <div>
            <b>No published numbers yet.</b>{' '}
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
      <SocialAccountPanel data={social} tickets={tickets} />
      <p className="t-meta">
        Capacity, throughput and at-risk work live on{' '}
        <Link href="/performance/capacity">Capacity &amp; risk</Link>.
      </p>
    </>
  );
}

export default async function PerformancePage() {
  const { isAdmin } = await getAdminAccess();
  return (
    <AppShell title="Performance" subtitle="How published work landed — reach and engagement per post, by account">
      <Suspense fallback={<QueueSkeleton kpis={3} />}>
        <Numbers isAdmin={isAdmin} />
      </Suspense>
    </AppShell>
  );
}
