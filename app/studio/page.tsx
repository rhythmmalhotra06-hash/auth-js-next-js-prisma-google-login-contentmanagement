import { Suspense } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { QueueSkeleton } from '@/components/ui/Skeletons';
import { requireStudioAccess } from '@/lib/studio/guard';
import {
  loadStudio, pulseCounts, getLaunches, getVishenMedia,
  getPendingShoots, getShootsToFilm, toShootSignOffItem,
} from '@/lib/studio/data';
import { ShootSignOff } from '@/components/studio/ShootSignOff';
import { ShootsToFilm } from '@/components/studio/ShootsToFilm';
import { LaunchesSection } from '@/components/studio/LaunchesSection';
import { ClipsList } from '@/components/studio/ClipsList';
import { AddVishenMedia } from '@/components/studio/AddVishenMedia';
import { PipelineFunnel, type FunnelStage } from '@/components/studio/PipelineFunnel';

export const dynamic = 'force-dynamic';

async function StudioBody() {
  const data = await loadStudio();
  const pulse = pulseCounts(data.active, data.metrics);
  const launches = getLaunches(data.active, data.recentShipped);
  const pendingShoots = getPendingShoots(data.shoots).map(toShootSignOffItem);
  // Fallback for the shoots box when nothing needs review: next shoots lined up to film.
  const shootsToFilm = getShootsToFilm(data.shoots).map(toShootSignOffItem);

  // Vishen's media — pinned to the top (most important to Vishen). The per-clip
  // ideas live in the "Clips awaiting you" card below, so the list stays at the source level.
  const allVishenMedia = getVishenMedia(data.media);
  const vishenMedia = allVishenMedia.slice(0, 3);
  const clipIds = vishenMedia.flatMap((m) => m.clipSuggestionIds);

  // Engine funnel — counts derived from existing selectors (no new data source).
  const funnelStages: FunnelStage[] = [
    { key: 'media', label: 'Media → clips', count: clipIds.length, cap: `ideas · ${vishenMedia.length} sources`, href: '/vishen', icon: '🎬' },
    { key: 'prod', label: 'In production', count: pulse.inProduction, cap: 'being made now', href: '/studio/launches?ticketStatus=In+Progress', icon: '✂️' },
    { key: 'await', label: 'Awaiting sign-off', count: pulse.awaiting, cap: 'in review', href: '/studio/sign-off', icon: '⏳', gold: true },
  ];

  return (
    <div className="studio-bento">
      {/* Engine — the hero on top */}
      <section className="sz-funnel">
        <div className="sec-head"><h3>The engine</h3><span className="hint">your pipeline, stage by stage — click a stage to open its grid</span></div>
        <PipelineFunnel stages={funnelStages} />
      </section>

      {/* Your media → clip ideas — the work closest to Vishen */}
      <section className="sz-media">
        <div className="sec-head">
          <h3>Your media → clip ideas</h3>
          <span className="hint">your films, podcasts and talks — and the clips we can ship from them</span>
          <Link href="/vishen" className="st-seeall">See all clips →</Link>
        </div>
        <AddVishenMedia />
        {vishenMedia.length > 0 && <div style={{ marginTop: 12 }}><ClipsList media={vishenMedia} /></div>}
        {allVishenMedia.length > vishenMedia.length && (
          <Link href="/vishen" className="st-seeall" style={{ display: 'inline-block', marginTop: 10 }}>
            +{allVishenMedia.length - vishenMedia.length} more media · see all clips →
          </Link>
        )}
      </section>

      {/* Awaiting your sign-off — focal zone: shoots (purple) + clips (white card) */}
      <section className="sz-signoff">
        <div className="sec-head">
          <div>
            <span className="eyebrow gold">● Needs you</span>
            <h3>Awaiting your sign-off</h3>
          </div>
          <Link href="/studio/shoots" className="st-seeall">See all shoots →</Link>
        </div>
        <div className="space-y-4">
          {pendingShoots.length > 0
            ? <ShootSignOff items={pendingShoots} />
            : <ShootsToFilm items={shootsToFilm} />}
        </div>
      </section>

      {/* Flowing to your launches */}
      <section className="sz-launches">
        <div className="sec-head">
          <h3>Flowing to your launches</h3>
          <span className="hint">work grouped by the event it serves</span>
          {launches.length > 3 && <Link href="/studio/launches" className="st-seeall">See all →</Link>}
        </div>
        {launches.length === 0
          ? <div className="empty">No active launches.</div>
          : <LaunchesSection launches={launches} />}
      </section>

      {/* Recently shipped — thin proof strip */}
      <section className="sz-shipped">
        <div className="sec-head"><h3>Recently shipped</h3><span className="hint">who made it</span></div>
        <div className="st-shipstrip">
          <div className="lhs"><b>{data.recentShipped.length} recently shipped</b> · all delivered</div>
          <Link href="/studio/shipped" className="st-seeall">See all →</Link>
        </div>
      </section>
    </div>
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
