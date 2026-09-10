import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { BrandCard } from '@/components/mow/BrandCard';
import { DayTable } from '@/components/mow/DayTable';
import { EmptyOwned } from '@/components/ui/Empty';
import { StagedBlock } from '@/components/ui/StagedBlock';
import { BigNumber, fmt } from '@/components/ui/BigNumber';
import { CommitBar, type CommitTarget } from '@/components/mow/CommitBar';
import { Learnings } from '@/components/mow/Learnings';
import { PostGrid, type PostGridItem } from '@/components/mow/PostGrid';
import { Briefing } from '@/components/mow/Briefing';
import { getWeekPack } from '@/lib/mow/week-pack';
import { canCommitMow } from '@/lib/mow/pack';
import { auth } from '@/lib/auth';
import type { SmartNumber } from '@/lib/mow/smart-number';
import { utcDay, weekStartOf, addDays, toYmd } from '@/lib/mow/week';
import { cn } from '@/lib/cn';

// /performance/week — THE MONDAY PACK. The surface the 08:00 MYT meeting runs from.
//
// Vishen's stated complaint about the existing reporting is "too many numbers, I'm not clear what
// this means" — Glen's report puts roughly sixty on one screen. The design's answer is ELEVEN, and
// the discipline that keeps it there is: the summary is the first screen, the analysis is one click
// down (expand a day), and nothing analytical is deleted, only moved.
//
// Not founder-gated, for the same reason as the calendar: Glen, Gareth, Ramya and the editors all
// read and edit this. Sign-in is required — middleware covers non-/api routes.
//
// NOT BUILT YET, and visible as labelled gaps rather than hidden: the headline number (no app-side
// Metabase credential — decision S6 puts it session-side first), the staged→committed learnings and
// per-owner prose, and the commit bar. The page is honest about each; see §6C of the plan.

export const dynamic = 'force-dynamic';

export default async function WeekPackPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; meeting?: string }>;
}) {
  const sp = await searchParams;
  const meeting = sp.meeting === '1';
  const session = await auth();
  const canCommit = canCommitMow(session?.user?.email);

  let anchor: Date;
  try {
    anchor = sp.week ? utcDay(sp.week) : new Date();
  } catch {
    anchor = new Date();
  }
  const start = weekStartOf(anchor);
  const prev = toYmd(addDays(start, -7));
  const next = toYmd(addDays(start, 7));

  let pack: Awaited<ReturnType<typeof getWeekPack>> | null = null;
  let error: string | null = null;
  try {
    pack = await getWeekPack(anchor);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const range = pack
    ? `${new Date(`${pack.week.weekStart}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'UTC' })}–${new Date(`${pack.week.weekEnd}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`
    : '';

  return (
    <AppShell
      title="The week"
      subtitle={pack ? range : undefined}
      actions={
        <Link
          href={`/performance/week?week=${toYmd(start)}${meeting ? '' : '&meeting=1'}`}
          className={cn(
            'rounded-sm border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors',
            meeting
              ? 'border-brand bg-brand font-semibold text-white'
              : 'border-border-strong bg-surface text-text-muted hover:bg-bg-subtle',
          )}
        >
          Meeting mode
        </Link>
      }
    >
      {error ? (
        <div className="rounded-md border border-danger bg-danger-soft px-4 py-3">
          <div className="text-[13.5px] font-semibold text-danger-content">Could not build the pack</div>
          <div className="mt-1 text-xs text-text-muted">{error}</div>
        </div>
      ) : pack ? (
        <div className="flex flex-col gap-[22px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link href={`/performance/week?week=${prev}${meeting ? '&meeting=1' : ''}`}
                    className="rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-[12.5px] font-medium text-text-muted hover:bg-bg-subtle">
                ← Previous
              </Link>
              <Link href={`/performance/week?week=${next}${meeting ? '&meeting=1' : ''}`}
                    className="rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-[12.5px] font-medium text-text-muted hover:bg-bg-subtle">
                Next →
              </Link>
              <Link href={`/performance/week/assets?week=${toYmd(start)}`}
                    className="ml-1 text-[12.5px] font-medium text-brand hover:underline">
                What we delivered →
              </Link>
              <Link href={`/studio/comms-calendar?week=${toYmd(start)}`}
                    className="text-[12.5px] font-medium text-brand hover:underline">
                Open the calendar →
              </Link>
            </div>
            <span className="text-2xs text-text-subtle">
              as of {new Date(pack.asOf).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* ── The two brand weeks, deliberately different shapes ─────────── */}
          <div className="grid gap-3 md:grid-cols-2">
            {pack.week.headers.map((h) => <BrandCard key={h.brand} h={h} />)}
          </div>

          {/* ── The first five minutes: what happened, before any table ────── */}
          <section>
            <h2 className="mb-[14px] text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
              The first five minutes
            </h2>
            <Briefing briefing={pack.briefing} weekHref={toYmd(start)} />
          </section>

          {/* ── The headline number, one per brand ──────────────────────────── */}
          <section>
            <h2 className="mb-[14px] text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
              The number
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {pack.week.headers.map((h) => {
                const st = pack.brandState.find((b) => b.brand === h.brand);
                const n = st?.smartNumber as SmartNumber | null | undefined;
                return (
                  <div key={h.brand} className="rounded-md border border-border-default bg-surface p-[18px]">
                    <div className="mb-2 text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
                      {h.label}
                    </div>
                    {n && n.value !== null ? (
                      <StagedBlock
                        state={st!.smartNumberIsCommitted ? 'committed' : 'staged'}
                        by={st!.committedBy}
                        at={st!.smartNumberIsCommitted ? st!.committedAt : n.asOf}
                      >
                        <BigNumber
                          label={n.label}
                          value={fmt(n.value)}
                          target={n.target === null ? null : fmt(n.target)}
                          provenance={n.targetProvenance}
                          targetProse={n.targetProse}
                          source={n.source}
                          asOf={n.asOf ? new Date(n.asOf).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null}
                        />

                        {/*
                          The drivers, DEMOTED — smaller, never promoted automatically (S1). Social
                          and email revenue sit side by side and are never summed (AB3): Ramya
                          presents email, Glen presents social, and one total would let either be
                          mistaken for the other.
                        */}
                        {st!.drivers.length ? (
                          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-border-default pt-2.5">
                            {st!.drivers.map((d) => (
                              <div key={d.key}>
                                <div className="text-2xs text-text-subtle">{d.label}</div>
                                <div className="font-display text-[15px] font-bold tabular-nums">
                                  {d.value === null
                                    ? '—'
                                    : d.key.includes('revenue')
                                      ? `$${d.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                                      : d.value.toLocaleString('en-US')}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </StagedBlock>
                    ) : (
                      <>
                        {/*
                          No zero, no bar, no 0%-against-a-target track. The figure arrives by the
                          weekly ingest (S6/AA5) — until it does, the gap is named rather than
                          filled with a placeholder.
                        */}
                        <EmptyOwned kind="notSet" owner="no figure ingested for this week yet" />
                        <p className="mt-2 text-xs leading-relaxed text-text-muted">
                          Leads and revenue come from Metabase and are posted in weekly. The
                          delivered social numbers below are already real.
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 max-w-prose text-2xs leading-relaxed text-text-subtle">
              {/*
                Say WHY this metric leads, rather than presenting it as given. The rule is S2 and
                the signal is a link out to the Official Cal — a default a human overrides, not a
                fact about the week.
              */}
              {pack.week.liveCampaign ? (
                <>
                  <span className="font-semibold text-text-muted">Leads leads this week</span> because
                  a campaign is live — days this week link out to the Official Cal. A quiet week
                  defaults to whatever the primary offer is judged on instead.{' '}
                </>
              ) : (
                <>
                  <span className="font-semibold text-text-muted">No campaign is live this week</span>,
                  so the headline falls back to leads — the one metric sourceable for any week.{' '}
                </>
              )}
              Revenue here is <span className="font-semibold text-text-muted">organic social only</span> —
              not App, Email or Paid, and never the Braze &ldquo;engaged revenue&rdquo; figure. The
              same Metabase question unfiltered reads about 74&times; larger and describes the whole
              business, not this team&rsquo;s work.
            </p>
          </section>

          {/* ── What we learned, per brand ──────────────────────────────────── */}
          {!meeting ? (
            <section className="grid gap-3 md:grid-cols-2">
              {pack.brandState.map((st) => (
                <Learnings
                  key={st.weekId}
                  weekId={st.weekId}
                  brandLabel={pack.week.headers.find((h) => h.brand === st.brand)?.label ?? st.brand}
                  learnings={st.learnings}
                  canEdit={canCommit && !st.committed}
                />
              ))}
            </section>
          ) : null}

          {/* ── Day by day. Summary here, Glen's read one click down. ───────── */}
          <section>
            <h2 className="mb-[14px] text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
              Day by day
            </h2>
            <DayTable days={pack.days} />
            <p className="mt-2 max-w-prose text-2xs leading-relaxed text-text-subtle">
              Click a day for the platform read. {pack.postsThisWeek}{' '}
              {pack.postsThisWeek === 1 ? 'post' : 'posts'} seen this week.{' '}
              <span className="text-text-muted">
                Planned and went-live count different populations — the comms calendar plans a
                named set, while Perch watches every connected account including the regional ones.
                They are two facts side by side, not a completion rate.
              </span>
            </p>
          </section>

          {/* ── The posts themselves. The drill-down the day table only counts. ── */}
          <section>
            <h2 className="mb-[14px] text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
              What went out
            </h2>
            <PostGrid
              weekHref={toYmd(start)}
              // From `allPosts`, NOT the day lanes: those cap at two rows per day, so building the
              // grid from them would quietly drop the third post onward on a busy day.
              posts={pack.week.allPosts as PostGridItem[]}
            />
          </section>

          {/* ── ONE screen-level provenance statement, not a hedge per figure ── */}
          {pack.coverage.length ? (
            <section>
              <h2 className="mb-[14px] text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
                Where these numbers come from
              </h2>
              <div className="rounded-md border border-staged bg-staged-soft p-[18px]">
                <p className="text-xs leading-relaxed text-staged-content">
                  Hootsuite Perch, pulled nightly, deduped to the latest capture per post. The
                  platforms do not report the same things, so nothing here is totalled across them:
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {pack.coverage.map((c) => (
                    <li key={c.platform} className="text-xs text-text-muted">
                      <span className="font-semibold text-text">{c.platform}</span>{' '}
                      <span className="tabular-nums">({c.posts})</span> — {c.has.join(', ') || 'nothing'}
                      {c.missing.length ? <span className="text-text-subtle">; no {c.missing.join(' or ')}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}

          {!meeting && pack.week.warnings.length ? (
            <section>
              <h2 className="mb-[14px] text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
                Worth a look
              </h2>
              <ul className="flex flex-col gap-1.5">
                {pack.week.warnings.map((w) => (
                  <li key={w} className="text-xs leading-relaxed text-text-muted">· {w}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {pack.brandState.length ? (
            <CommitBar
              canCommit={canCommit}
              targets={pack.brandState.map((st): CommitTarget => ({
                weekId: st.weekId,
                brand: st.brand,
                label: pack.week.headers.find((h) => h.brand === st.brand)?.label ?? st.brand,
                committed: st.committed,
                committedBy: st.committedBy,
                pending: [
                  ...(st.smartNumber && !st.smartNumberIsCommitted ? ['the number'] : []),
                  ...(st.learnings.some((l) => !l.committedAt) ? ['learnings'] : []),
                  ...(st.summary && !st.summaryIsCommitted ? ['the summary'] : []),
                ],
              }))}
            />
          ) : null}

          {!meeting ? (
            <p className="max-w-prose text-2xs leading-relaxed text-text-subtle">
              The message and goal are read-only from Airtable. Everything staged here is app state
              and is snapshotted on commit, so a later ingest cannot rewrite what the room agreed.
            </p>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}
