import { Suspense } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { QueueSkeleton } from '@/components/ui/Skeletons';
import { requireStudioAccess } from '@/lib/studio/guard';
import {
  loadStudio, getReviewQueue, toReviewItem, pulseCounts, getLaunches, getVishenMedia,
} from '@/lib/studio/data';
import { SignOffHero } from '@/components/studio/SignOffHero';
import { Pulse } from '@/components/studio/Pulse';
import { LaunchCard } from '@/components/studio/LaunchCard';
import { ClipsList } from '@/components/studio/ClipsList';
import { ProposeFootnote } from '@/components/studio/ProposeFootnote';

export const dynamic = 'force-dynamic';

async function StudioBody() {
  const data = await loadStudio();
  const review = getReviewQueue(data.active).map(toReviewItem);
  const pulse = pulseCounts(data.active, data.metrics);
  const launches = getLaunches(data.active, data.recentShipped);
  const clips = getVishenMedia(data.media);

  return (
    <>
      {/* 1. Sign-off — the hero */}
      <SignOffHero items={review} />

      {/* 2. The pulse */}
      <div className="sec-head"><h3>The pulse</h3>{pulse.asOf && <span className="hint">{pulse.asOf}</span>}</div>
      <Pulse pulse={pulse} />

      {/* 3. Flowing to your launches */}
      <div className="sec-head">
        <h3>Flowing to your launches</h3>
        <span className="hint">work grouped by the event it serves</span>
        {launches.length > 3 && <Link href="/studio/launches" className="st-seeall">See all →</Link>}
      </div>
      {launches.length === 0
        ? <div className="empty">No active launches.</div>
        : launches.slice(0, 3).map((l) => <LaunchCard key={l.slug} launch={l} />)}

      {/* 4. Main Videos → clip ideas */}
      {clips.length > 0 && (
        <>
          <div className="sec-head"><h3>Main Videos → clip ideas</h3><span className="hint">from your talks and podcast appearances</span></div>
          <ClipsList media={clips.slice(0, 3)} />
        </>
      )}

      {/* 6. Recently shipped — thin proof strip */}
      <div className="sec-head" style={{ marginBottom: 8 }}><h3>Recently shipped</h3><span className="hint">who made it</span></div>
      <div className="st-shipstrip">
        <div className="lhs"><b>{data.recentShipped.length} recently shipped</b> · all delivered</div>
        <Link href="/studio/shipped" className="st-seeall">See all →</Link>
      </div>

      <ProposeFootnote />
    </>
  );
}

export default async function StudioPage() {
  await requireStudioAccess();
  return (
    <AppShell title="Studio" subtitle="What's moving, and what needs you">
      <Suspense fallback={<QueueSkeleton kpis={4} />}>
        <StudioBody />
      </Suspense>
    </AppShell>
  );
}
