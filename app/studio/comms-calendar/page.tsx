import { Suspense } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { WeekGrid, NotDatedBar } from '@/components/comms-calendar/WeekGrid';
import { MonthGrid } from '@/components/comms-calendar/MonthGrid';
import { getCalendarWeekFromAirtable } from '@/lib/comms-calendar/data.airtable';
import { getCalendarMonthFromAirtable } from '@/lib/comms-calendar/month';
import { commsCalendarIsPostgres } from '@/lib/comms-calendar/backend';
import { utcDay, weekStartOf, weekBounds, addDays, toYmd } from '@/lib/mow/week';
import { Segmented } from '@/components/ui/Segmented';
import { CalendarSkeleton } from '@/components/ui/Skeletons';
import type { BrandState } from '@/lib/comms-calendar/types';

// /studio/comms-calendar — ONE route, three brand states via ?brand=main|vl|mv, two grains via
// ?view=week|month. Not three routes and not three components (10 Sep handoff §2).
//
// Week and Month are deliberately DIFFERENT SHAPES: the week is a schedule (day-rows, two brand
// columns) because its question is "on Tuesday, what goes out for each brand"; the month keeps the
// calendar shape because its question is "what is this month about, and where are the holes".
// That is a considered split, not an inconsistency to reconcile.
//
// Read-only: the portal proposes, humans commit in Airtable. The MOW sync stays one-way into the
// VL base — two-way editing is how the two brand lists drift apart.
//
// ACCESS, deliberately: this page does NOT call requireStudioAccess(), unlike every other
// /studio/* page. Its readers are Vishen, Ramya and Glen, and gating it to the founder surface
// would lock out the two people who own the data. Sign-in is still required — middleware covers
// non-/api routes. If an app/studio/layout.tsx guard is ever added, this route must be excluded
// from it or the calendar silently becomes founder-only.
//
// STREAMED: the shell, title and the two segmented controls depend only on the URL and render at
// once; the grid arrives inside a Suspense boundary when Airtable answers. See `<CalendarBody>`.

export const dynamic = 'force-dynamic';

const STATES: { key: BrandState; label: string }[] = [
  { key: 'main', label: 'Main' },
  { key: 'vl', label: "Vishen's" },
  { key: 'mv', label: 'Mindvalley' },
];

export default async function CommsCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; week?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const brand: BrandState = sp.brand === 'vl' || sp.brand === 'mv' ? sp.brand : 'main';
  const view: 'week' | 'month' = sp.view === 'month' ? 'month' : 'week';

  let anchor: Date;
  try {
    anchor = sp.week ? utcDay(sp.week) : new Date();
  } catch {
    anchor = new Date();
  }
  const start = weekStartOf(anchor);
  // Paging steps by the grain on screen: a week at a time in week view, a month in month view.
  const prev =
    sp.view === 'month'
      ? toYmd(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1)))
      : toYmd(addDays(start, -7));
  const next =
    sp.view === 'month'
      ? toYmd(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1)))
      : toYmd(addDays(start, 7));

  // Title facts come from the URL, the same way the readers derive them, so they need no data.
  const { end } = weekBounds(start);
  const range = `${start.toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'UTC' })}–${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}`;
  const monthLabel = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1))
    .toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <AppShell
      title="Comms Calendar"
      subtitle={view === 'month' ? monthLabel : `Week of ${range}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {/* Secondary: which LENS. Primary: whose DATA. Two weights, so a stacked pair reads as
              a hierarchy rather than as two controls fighting. */}
          <Segmented
            current={view}
            options={(['week', 'month'] as const).map((v) => ({
              key: v,
              label: v === 'week' ? 'Week' : 'Month',
              href: `/studio/comms-calendar?brand=${brand}&week=${toYmd(start)}&view=${v}`,
            }))}
          />
          <Segmented
            weight="primary"
            current={brand}
            options={STATES.map((s) => ({
              key: s.key,
              label: s.label,
              href: `/studio/comms-calendar?brand=${s.key}&week=${toYmd(start)}&view=${view}`,
              tone: s.key === 'vl' ? ('vishen' as const) : ('brand' as const),
            }))}
          />
        </div>
      }
    >
      <Suspense fallback={<CalendarSkeleton view={view} />}>
        <CalendarBody anchor={anchor} brand={brand} view={view} start={start} prev={prev} next={next} />
      </Suspense>
    </AppShell>
  );
}

/** The data-dependent half — one Airtable-backed read, then the grid for the grain on screen. */
async function CalendarBody({
  anchor, brand, view, start, prev, next,
}: {
  anchor: Date; brand: BrandState; view: 'week' | 'month'; start: Date; prev: string; next: string;
}) {
  let week: Awaited<ReturnType<typeof getCalendarWeekFromAirtable>> | null = null;
  let month: Awaited<ReturnType<typeof getCalendarMonthFromAirtable>> | null = null;
  let error: string | null = null;
  try {
    // Only the Airtable reader exists so far, so the flag cannot change the source yet — it is
    // read here purely to caveat the freshness line below. Both branches were literally identical
    // before, which read as a working switch and was not one. `assembleWeek()` is already split
    // out as the pure half so the Postgres reader can share it when it lands.
    if (view === 'month') {
      month = await getCalendarMonthFromAirtable(anchor);
    } else {
      week = await getCalendarWeekFromAirtable(anchor);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <>
      {error ? (
        <div className="rounded-md border border-danger bg-danger-soft px-4 py-3">
          <div className="text-[13.5px] font-semibold text-danger-content">Could not read the calendar</div>
          <div className="mt-1 text-xs text-text-muted">{error}</div>
        </div>
      ) : month ? (
        <div className="flex flex-col gap-[14px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link
                href={`/studio/comms-calendar?brand=${brand}&week=${prev}&view=month`}
                className="rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-[12.5px] font-medium text-text-muted hover:bg-bg-subtle"
              >
                ← Previous
              </Link>
              <Link
                href={`/studio/comms-calendar?brand=${brand}&week=${next}&view=month`}
                className="rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-[12.5px] font-medium text-text-muted hover:bg-bg-subtle"
              >
                Next →
              </Link>
            </div>
            <span className="text-2xs text-text-subtle">
              read from Airtable, as of{' '}
              {new Date(month.asOf).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Clicking a day drops into that week — days are not entities, so they do not open. */}
          <MonthGrid
            month={month}
            state={brand}
            weekHref={(ymd) => `/studio/comms-calendar?brand=${brand}&week=${ymd}&view=week`}
          />

          {month.warnings.length ? (
            <ul className="flex flex-col gap-1 text-2xs text-text-subtle">
              {month.warnings.map((w) => <li key={w}>· {w}</li>)}
            </ul>
          ) : null}

          <p className="text-2xs text-text-subtle">
            Read-only. The portal proposes; humans commit in Airtable.
          </p>
        </div>
      ) : week ? (
        <div className="flex flex-col gap-[14px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link
                href={`/studio/comms-calendar?brand=${brand}&week=${prev}&view=week`}
                className="rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-[12.5px] font-medium text-text-muted hover:bg-bg-subtle"
              >
                ← Previous
              </Link>
              <Link
                href={`/studio/comms-calendar?brand=${brand}&week=${next}&view=week`}
                className="rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-[12.5px] font-medium text-text-muted hover:bg-bg-subtle"
              >
                Next →
              </Link>
            </div>
            {/* The calendar must never imply live data — inbound sync is on a schedule. */}
            <span className="text-2xs text-text-subtle">
              read from Airtable, as of{' '}
              {new Date(week.asOf).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {commsCalendarIsPostgres() ? ' · COMMS_CALENDAR_BACKEND=postgres is set but no Postgres reader exists yet' : ''}
            </span>
          </div>

          <WeekGrid
            week={week}
            state={brand}
            assetHref={(id) => `/studio/comms-calendar/asset/${id}?brand=${brand}&week=${toYmd(start)}`}
            emailHref={(id) => `/studio/comms-calendar/email/${id}?week=${toYmd(start)}`}
          />
          <NotDatedBar
            notDated={week.notDated}
            href={`/studio/comms-calendar/not-dated?brand=${brand}&week=${toYmd(start)}`}
          />

          {week.warnings.length ? (
            <ul className="flex flex-col gap-1 text-2xs text-text-subtle">
              {week.warnings.map((w) => <li key={w}>· {w}</li>)}
            </ul>
          ) : null}

          <p className="text-2xs text-text-subtle">
            Read-only. The portal proposes; humans commit in Airtable.
          </p>
        </div>
      ) : null}
    </>
  );
}
