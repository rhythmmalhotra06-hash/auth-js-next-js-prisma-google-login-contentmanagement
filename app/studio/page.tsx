import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { requireStudioAccess } from '@/lib/studio/guard';
import {
  loadStudio, loadVishenVideos, pulseCounts, getLaunches,
  getPendingShoots, toShootSignOffItem,
} from '@/lib/studio/data';
import { listClipsByStatus, listMediaSources } from '@/lib/media/repository';
import { MediaHub } from '@/components/studio/media/MediaHub';
import { PipelineFunnel, type FunnelStage } from '@/components/studio/PipelineFunnel';
import { LaunchesSection } from '@/components/studio/LaunchesSection';

export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  await requireStudioAccess();

  const [videos, proposedRes, approvedRes, mediaRes, studio] = await Promise.all([
    loadVishenVideos(),
    listClipsByStatus('Proposed'),
    listClipsByStatus('Approved'),
    listMediaSources(100),
    loadStudio(),
  ]);

  const sources = mediaRes.ok ? mediaRes.data : [];
  const sourceNames: Record<string, string> = {};
  for (const s of sources) if (s.title) sourceNames[s.id] = s.title;

  // Shoots actually awaiting Vishen's sign-off (Filming Status = "Needs Vishen's Review").
  const pendingShoots = getPendingShoots(studio.shoots).map(toShootSignOffItem);

  // Pipeline tab (server-rendered slot): the ticket production funnel + launches + shipped.
  const pulse = pulseCounts(studio.active, studio.metrics);
  const launches = getLaunches(studio.active, studio.recentShipped);
  const readyToPublish = studio.active.filter((t) => t.ticketStatus === 'Approved' || t.ticketStatus === 'Shipping').length;
  const funnelStages: FunnelStage[] = [
    { key: 'prod', label: 'In production', count: pulse.inProduction, cap: 'being made now', href: '/studio/launches?ticketStatus=In+Progress', icon: '✂️', tone: 'prod' },
    { key: 'await', label: 'Awaiting sign-off', count: pulse.awaiting + pendingShoots.length, cap: 'clips + shoots', sub: `${pendingShoots.length} shoot${pendingShoots.length === 1 ? '' : 's'} for you`, href: '/studio/sign-off', icon: '⏳', tone: 'review' },
    { key: 'ready', label: 'Ready to publish', count: readyToPublish, cap: 'approved · queued', href: '/studio/launches', icon: '📤', tone: 'ready' },
  ];

  const pipelineSlot = (
    <div className="space-y-8">
      <section className="sec">
        <div className="sec-head">
          <div><span className="eyebrow">⛓ The engine</span><h3>Your pipeline, stage by stage</h3></div>
          <span className="hint">click a stage to open its grid</span>
        </div>
        <PipelineFunnel stages={funnelStages} />
      </section>

      <section className="sec">
        <div className="sec-head">
          <div><span className="eyebrow">⛁ Launches</span><h3>Flowing to your launches</h3></div>
          <span className="hint">work grouped by the event it serves</span>
          {launches.length > 4 && <Link href="/studio/launches" className="st-seeall">See all →</Link>}
        </div>
        {launches.length === 0 ? <div className="empty">No active launches.</div> : <LaunchesSection launches={launches} />}
      </section>

      <section className="sec">
        <div className="sec-head">
          <div><span className="eyebrow green">✓ Delivered</span><h3>Recently shipped</h3></div>
          <Link href="/studio/shipped" className="st-seeall">See all →</Link>
        </div>
        <div className="st-shipstrip">
          <div className="lhs"><b>{studio.recentShipped.length} recently shipped</b> · all delivered</div>
          <Link href="/studio/shipped" className="st-seeall">See all →</Link>
        </div>
      </section>
    </div>
  );

  return (
    <AppShell title="Your media" subtitle="Everything made for your channels — catch up, approve, and see what's coming">
      {videos.length === 0 ? (
        <div className="empty">No videos found in your content base yet.</div>
      ) : (
        <MediaHub
          videos={videos}
          proposedClips={proposedRes.ok ? proposedRes.data : []}
          approvedClips={approvedRes.ok ? approvedRes.data : []}
          sourceNames={sourceNames}
          shoots={pendingShoots}
          pipelineSlot={pipelineSlot}
        />
      )}
    </AppShell>
  );
}
