import { Suspense } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { QueueSkeleton } from '@/components/ui/Skeletons';
import { requireStudioAccess } from '@/lib/studio/guard';
import {
  loadStudio, getReviewQueue, toReviewItem, pulseCounts, getLaunches, getVishenMedia,
  getPendingShoots, toShootSignOffItem,
} from '@/lib/studio/data';
import { SignOffHero } from '@/components/studio/SignOffHero';
import { ShootSignOff } from '@/components/studio/ShootSignOff';
import { Pulse } from '@/components/studio/Pulse';
import { LaunchCard } from '@/components/studio/LaunchCard';
import { ClipsList, type ClipRow } from '@/components/studio/ClipsList';
import { AddVishenMedia } from '@/components/studio/AddVishenMedia';
import { ProposeFootnote } from '@/components/studio/ProposeFootnote';
import { getClipsByIds } from '@/lib/media/repository';

export const dynamic = 'force-dynamic';

async function StudioBody() {
  const data = await loadStudio();
  const review = getReviewQueue(data.active).map(toReviewItem);
  const pulse = pulseCounts(data.active, data.metrics);
  const launches = getLaunches(data.active, data.recentShipped);
  const pendingShoots = getPendingShoots(data.shoots).map(toShootSignOffItem);

  // Vishen's media + their top clip ideas — pinned to the top (most important to Vishen).
  const vishenMedia = getVishenMedia(data.media).slice(0, 3);
  const clipsByMedia: Record<string, ClipRow[]> = {};
  const clipIds = vishenMedia.flatMap((m) => m.clipSuggestionIds);
  if (clipIds.length) {
    const clipsRes = await getClipsByIds(clipIds);
    if (clipsRes.ok) {
      for (const c of clipsRes.data) {
        if (!c.mediaSourceId) continue;
        (clipsByMedia[c.mediaSourceId] ??= []).push({ id: c.id, name: c.name, viralityScore: c.viralityScore });
      }
      for (const k of Object.keys(clipsByMedia)) {
        clipsByMedia[k] = clipsByMedia[k].sort((a, b) => (b.viralityScore ?? 0) - (a.viralityScore ?? 0)).slice(0, 3);
      }
    }
  }

  return (
    <>
      {/* 0. Your media → clip ideas — pinned top; the work closest to Vishen */}
      <div className="sec-head"><h3>Your media → clip ideas</h3><span className="hint">your films, podcasts and talks — and the clips we can ship from them</span></div>
      <AddVishenMedia />
      {vishenMedia.length > 0 && <div style={{ marginTop: 12 }}><ClipsList media={vishenMedia} clipsByMedia={clipsByMedia} /></div>}

      {/* 1. Sign-off — the hero */}
      <div className="sec-head" style={{ marginTop: 20 }}><h3>Needs your sign-off</h3></div>
      <SignOffHero items={review} />

      {/* 1b. Shoots awaiting sign-off */}
      <ShootSignOff items={pendingShoots} />

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
