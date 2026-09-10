import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { requireStudioAccess } from '@/lib/studio/guard';
import {
  loadStudio, loadVishenVideos, pulseCounts, getLaunches,
  getPendingShoots, toShootSignOffItem,
} from '@/lib/studio/data';
import { listClipsByStatus, listMediaSources } from '@/lib/media/repository';
import { getLatestMetrics } from '@/lib/metrics/social-perf';
import { MediaHub } from '@/components/studio/media/MediaHub';
import { PipelineFunnel, type FunnelStage } from '@/components/studio/PipelineFunnel';
import { LaunchesSection } from '@/components/studio/LaunchesSection';
import { VishenCard, type VishenBlocker } from '@/components/mow/VishenCard';
import { getCalendarWeekFromAirtable } from '@/lib/comms-calendar/data.airtable';
import { weekStartOf, toYmd } from '@/lib/mow/week';

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

  // Per-post performance for the "Live & performing" band. Keyed by video id, resolved
  // through the published permalink so it works under either videos backend.
  const metrics = await getLatestMetrics(videos);

  const sources = mediaRes.ok ? mediaRes.data : [];
  const sourceNames: Record<string, string> = {};
  for (const s of sources) if (s.title) sourceNames[s.id] = s.title;

  // Shoots actually awaiting Vishen's sign-off (Filming Status = "Needs Vishen's Review").
  const pendingShoots = getPendingShoots(studio.shoots).map(toShootSignOffItem);

  // ── Artboard `5c`: the blocker-first card ────────────────────────────────────────────────
  // The week's message comes from the same Airtable reader the calendar and the pack use, so all
  // three can never disagree about whose week it is. Best-effort: a founder's home page must not
  // 500 because Airtable is slow, so a failure degrades to the card's own empty states.
  const week = await getCalendarWeekFromAirtable(new Date()).catch(() => null);
  const proposedClips = proposedRes.ok ? proposedRes.data : [];

  const blockers: VishenBlocker[] = [
    ...pendingShoots.map((sh) => ({
      id: sh.id,
      title: sh.title,
      kind: 'Shoot sign-off' + (sh.format ? ` · ${sh.format}` : ''),
      when: sh.filmingDate
        ? new Date(`${sh.filmingDate.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
          })
        : null,
      href: '/studio/sign-off',
      actionLabel: 'Review',
    })),
    // Clips collapse to ONE row rather than sixteen: the ask is identical for all of them, and a
    // list of sixteen identical requests reads as a backlog instead of a decision.
    ...(proposedClips.length
      ? [{
          id: 'clips',
          title: `${proposedClips.length} clip${proposedClips.length === 1 ? '' : 's'} proposed for your approval`,
          kind: 'Clip approval',
          when: null,
          href: '/studio/sign-off',
          actionLabel: 'Open',
        }]
      : []),
  ];

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
          <Link href="/studio/timeline" className="st-seeall">See where time is going →</Link>
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
      {/* `5c` — blockers first, then the week's message. Above everything else on the page. */}
      <div className="mb-8">
        <VishenCard
          blockers={blockers}
          headers={week?.headers ?? []}
          weekHref={`/performance/week?week=${toYmd(weekStartOf(new Date()))}`}
        />
      </div>

      {videos.length === 0 ? (
        <div className="empty">No videos found in your content base yet.</div>
      ) : (
        <MediaHub
          videos={videos}
          proposedClips={proposedRes.ok ? proposedRes.data : []}
          approvedClips={approvedRes.ok ? approvedRes.data : []}
          sourceNames={sourceNames}
          metrics={metrics}
          shoots={pendingShoots}
          pipelineSlot={pipelineSlot}
        />
      )}
    </AppShell>
  );
}
