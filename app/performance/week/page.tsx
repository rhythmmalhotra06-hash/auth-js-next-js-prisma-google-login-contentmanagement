import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { BrandCard } from '@/components/mow/BrandCard';
import { DayTable } from '@/components/mow/DayTable';
import { EmptyOwned } from '@/components/ui/Empty';
import { getWeekPack } from '@/lib/mow/week-pack';
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

          {/* ── The headline number. Not connected, and says so once. ──────── */}
          <section>
            <h2 className="mb-[14px] text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
              The number
            </h2>
            <div className="rounded-md border border-border-default bg-surface p-[18px]">
              {/*
                No zero, no bar, no 0%-against-a-target track. Leads and revenue come from Metabase
                questions 31846 / 32044, and there is no app-side credential yet (S6: a scheduled
                session-side ingest lands them first). Stating the gap is the honest render, and it
                is what gets the credential prioritised.
              */}
              <EmptyOwned kind="notSet" owner="leads and revenue not connected yet" />
              <p className="mt-2 max-w-prose text-xs leading-relaxed text-text-muted">
                Delivered social numbers below are real. Leads and revenue are not wired into the
                app yet, so no headline figure is shown rather than a placeholder one.
                {' '}Glen hand-enters the YouTube figures for week one, as he does today.
              </p>
            </div>
          </section>

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

          {!meeting ? (
            <p className="max-w-prose text-2xs leading-relaxed text-text-subtle">
              Still to come on this page: the staged→committed learnings, the per-owner blocks, and
              the commit bar. Until they land, the message and goal are read-only from Airtable.
            </p>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}
