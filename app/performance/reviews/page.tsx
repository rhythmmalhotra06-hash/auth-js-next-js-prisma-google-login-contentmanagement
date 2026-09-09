import { Suspense } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { Kpi, KpiGrid } from '@/components/ui/Kpi';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { QueueSkeleton } from '@/components/ui/Skeletons';
import {
  listRecentDnaReviews,
  listTicketsAwaitingDnaReview,
  type DnaReviewListRow,
  type AwaitingDnaReviewRow,
} from '@/lib/dna-review/repository';

// DNA reviews — the browse surface for the AI first pass (E13.2).
//
// Why this page exists: the review itself has always worked, but the only way to reach it
// was the panel on one ticket's page, so a person had to already know which ticket to open.
// Nothing showed what had been flagged across the studio, or which tickets were sitting
// unreviewed — and an unreviewed ticket at `Review` is a BLOCKED ticket, because
// checkDnaGate() fails closed on a missing review.
//
// Deliberately read-only. Running a review, reacting to a finding and dismissing a flag all
// stay on the ticket page, where the asset-type-scoped permission check
// (getDnaAccessForAssetType) already lives. Duplicating those controls here would mean
// duplicating that gating, which is exactly how a permission bug gets born.

export const dynamic = 'force-dynamic';

const WINDOW_DAYS = 30;

/** "2h ago" / "3d ago" — precise enough for a review queue, no dependency needed. */
function ago(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** A frame-anchored finding cites a moment in the video — render it as 0:06, not 6000ms. */
function timecode(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function dueLabel(due: Date | null): string | null {
  if (!due) return null;
  const days = Math.round((due.getTime() - Date.now()) / 86400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'due today';
  return `due in ${days}d`;
}

/** Shared row chrome: a whole-card link to the ticket. */
function RowCard({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="card pad row-between no-underline text-inherit">
      {children}
      <Icon name="arrow" size={16} />
    </Link>
  );
}

function FlaggedRow({ r }: { r: DnaReviewListRow }) {
  return (
    <RowCard href={`/tickets/${r.ticketId}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <b className="text-sm">{r.ticketTitle}</b>
          <Badge tone="danger">{r.openFlags} flag{r.openFlags === 1 ? '' : 's'}</Badge>
          {r.usedFrames && (
            <Badge tone="info" dot={false}>
              👁️ {r.frameCount ?? 0} frames
            </Badge>
          )}
        </div>
        {r.topFlag && (
          <div className="mt-1.5 text-xs leading-relaxed text-text-muted">
            {r.topFlag.timestampMs != null && (
              <span className="font-medium text-text">{timecode(r.topFlag.timestampMs)} · </span>
            )}
            {r.topFlag.note}
          </div>
        )}
        <div className="t-meta">
          <span>{r.assetTypeName ?? 'No asset type'}</span>
          <span>·</span>
          <span>{r.ticketStatus ?? 'No status'}</span>
          <span>·</span>
          <span>{ago(r.createdAt)}</span>
        </div>
      </div>
    </RowCard>
  );
}

function AwaitingRow({ t }: { t: AwaitingDnaReviewRow }) {
  const due = dueLabel(t.dueDate);
  return (
    <RowCard href={`/tickets/${t.id}`}>
      <div className="min-w-0 flex-1">
        <b className="text-sm">{t.title}</b>
        <div className="t-meta">
          <span>{t.assetTypeName ?? 'No asset type'}</span>
          <span>·</span>
          <span>{t.assigneeName ?? 'Unassigned'}</span>
          {due && (
            <>
              <span>·</span>
              <span>{due}</span>
            </>
          )}
        </div>
      </div>
    </RowCard>
  );
}

function CleanRow({ r }: { r: DnaReviewListRow }) {
  const notes = r.counts.suggestion + r.counts.info;
  return (
    <RowCard href={`/tickets/${r.ticketId}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <b className="text-sm">{r.ticketTitle}</b>
          {r.usedFrames ? (
            <Badge tone="info" dot={false}>👁️ visuals</Badge>
          ) : (
            <Badge tone="neutral" dot={false}>text only</Badge>
          )}
        </div>
        <div className="t-meta">
          <span>{r.assetTypeName ?? 'No asset type'}</span>
          <span>·</span>
          <span>{notes === 0 ? 'no findings' : `${notes} note${notes === 1 ? '' : 's'}`}</span>
          <span>·</span>
          <span>{ago(r.createdAt)}</span>
        </div>
      </div>
    </RowCard>
  );
}

async function Reviews() {
  const [reviews, awaiting] = await Promise.all([
    listRecentDnaReviews({ days: WINDOW_DAYS }),
    listTicketsAwaitingDnaReview(),
  ]);
  const shownAwaiting = awaiting.rows.length;
  const moreAwaiting = awaiting.total - shownAwaiting;

  const flagged = reviews.filter((r) => r.openFlags > 0);
  const clean = reviews.filter((r) => r.openFlags === 0);
  const withVisuals = reviews.filter((r) => r.usedFrames).length;
  // The share of reviews that actually saw the video. This is the honest gauge of delivery-link
  // coverage: ~56% of tickets resolve to a downloadable video today, and it should climb to
  // ~84% once render-service gets its Dropbox credentials (the folder-link path).
  const visualPct = reviews.length ? Math.round((withVisuals / reviews.length) * 100) : null;

  return (
    <>
      <KpiGrid>
        <Kpi i={0} label={`Reviewed · ${WINDOW_DAYS}d`} value={reviews.length} sub="latest run per ticket" />
        <Kpi i={1} label="Open flags" value={flagged.length} tone={flagged.length ? 'danger' : undefined} sub="blocking approval" />
        <Kpi i={2} label="Awaiting review" value={awaiting.total} tone={awaiting.total ? 'attention' : undefined} sub="at Review, never reviewed" />
        <Kpi i={3} label="Saw the video" value={visualPct == null ? '—' : `${visualPct}%`} sub={`${withVisuals} of ${reviews.length} used frames`} />
      </KpiGrid>

      <div className="sec-head">
        <h3>Needs attention</h3>
        <span className="hint">A flag blocks approval until it&rsquo;s dismissed with a note — or a manager, team lead or exec approves past it.</span>
      </div>
      {flagged.length === 0 ? (
        <div className="empty">Nothing flagged in the last {WINDOW_DAYS} days.</div>
      ) : (
        <div className="stack">{flagged.map((r) => <FlaggedRow key={r.id} r={r} />)}</div>
      )}

      <div className="sec-head">
        <h3>Awaiting review</h3>
        <span className="hint">At Review with no review run. Approving one needs a review first, or an override note from a manager, team lead or exec.</span>
      </div>
      {awaiting.total === 0 ? (
        <div className="empty">Every ticket at Review has been reviewed.</div>
      ) : (
        <div className="stack">
          {awaiting.rows.map((t) => <AwaitingRow key={t.id} t={t} />)}
          {moreAwaiting > 0 && (
            <p className="t-meta">
              …and {moreAwaiting} more. Soonest due first.
            </p>
          )}
        </div>
      )}

      <div className="sec-head">
        <h3>Recently reviewed</h3>
        <span className="hint">Clean passes, newest first.</span>
      </div>
      {clean.length === 0 ? (
        <div className="empty">No clean reviews in the last {WINDOW_DAYS} days.</div>
      ) : (
        <div className="stack">{clean.map((r) => <CleanRow key={r.id} r={r} />)}</div>
      )}

      <div className="st-footnote">
        <Icon name="sparkle" size={15} />
        <span>
          This is an AI first pass, not a decision. Every finding is a suggestion for a human
          reviewer — approval, and dismissing a flag, always stay with a person. Open a ticket to
          react to a finding or re-run its review.
        </span>
      </div>
    </>
  );
}

export default async function DnaReviewsPage() {
  return (
    <AppShell title="DNA reviews" subtitle="What the AI first pass flagged, and what’s still waiting.">
      <Suspense fallback={<QueueSkeleton kpis={4} />}>
        <Reviews />
      </Suspense>
    </AppShell>
  );
}
