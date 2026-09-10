import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { WeekGrid, NotDatedBar } from '@/components/comms-calendar/WeekGrid';
import { getCalendarWeekFromAirtable } from '@/lib/comms-calendar/data.airtable';
import { commsCalendarIsPostgres } from '@/lib/comms-calendar/backend';
import { utcDay, weekStartOf, addDays, toYmd } from '@/lib/mow/week';
import { cn } from '@/lib/cn';
import type { BrandState } from '@/lib/comms-calendar/types';

// /studio/comms-calendar — ONE route, three brand states via ?brand=main|vl|mv.
// Not three routes and not three components (10 Sep handoff §2).
//
// Read-only: the portal proposes, humans commit in Airtable. The MOW sync stays one-way into the
// VL base — two-way editing is how the two brand lists drift apart.
//
// ACCESS, deliberately: this page does NOT call requireStudioAccess(), unlike every other
// /studio/* page. Its readers are Vishen, Ramya and Glen, and gating it to the founder surface
// would lock out the two people who own the data. Sign-in is still required — middleware covers
// non-/api routes. If an app/studio/layout.tsx guard is ever added, this route must be excluded
// from it or the calendar silently becomes founder-only.

export const dynamic = 'force-dynamic';

const STATES: { key: BrandState; label: string }[] = [
  { key: 'main', label: 'Main' },
  { key: 'vl', label: "Vishen's" },
  { key: 'mv', label: 'Mindvalley' },
];

function Segmented({ current, week }: { current: BrandState; week: string }) {
  return (
    <div className="inline-flex overflow-hidden rounded-sm border border-border-strong">
      {STATES.map((s, i) => (
        <Link
          key={s.key}
          href={`/studio/comms-calendar?brand=${s.key}&week=${week}`}
          className={cn(
            'px-3.5 py-1.5 text-[12.5px] font-medium transition-colors',
            i > 0 && 'border-l border-border-default',
            s.key === current
              ? s.key === 'vl'
                ? 'bg-vishen font-semibold text-white'
                : 'bg-brand font-semibold text-white'
              : 'bg-surface text-text-muted hover:bg-bg-subtle',
          )}
        >
          {s.label}
        </Link>
      ))}
    </div>
  );
}

export default async function CommsCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; week?: string }>;
}) {
  const sp = await searchParams;
  const brand: BrandState = sp.brand === 'vl' || sp.brand === 'mv' ? sp.brand : 'main';

  let anchor: Date;
  try {
    anchor = sp.week ? utcDay(sp.week) : new Date();
  } catch {
    anchor = new Date();
  }
  const start = weekStartOf(anchor);
  const prev = toYmd(addDays(start, -7));
  const next = toYmd(addDays(start, 7));

  let week: Awaited<ReturnType<typeof getCalendarWeekFromAirtable>> | null = null;
  let error: string | null = null;
  try {
    // Postgres path lands when the reconcile is pulling CommsDay; until then read Airtable direct.
    week = commsCalendarIsPostgres()
      ? await getCalendarWeekFromAirtable(anchor)
      : await getCalendarWeekFromAirtable(anchor);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const range = week
    ? `${new Date(`${week.weekStart}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'UTC' })}–${new Date(`${week.weekEnd}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}`
    : '';

  return (
    <AppShell
      title="Comms Calendar"
      subtitle={week ? `Week of ${range}` : undefined}
      actions={<Segmented current={brand} week={toYmd(start)} />}
    >
      {error ? (
        <div className="rounded-md border border-danger bg-danger-soft px-4 py-3">
          <div className="text-[13.5px] font-semibold text-danger-content">Could not read the calendar</div>
          <div className="mt-1 text-xs text-text-muted">{error}</div>
        </div>
      ) : week ? (
        <div className="flex flex-col gap-[14px]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link
                href={`/studio/comms-calendar?brand=${brand}&week=${prev}`}
                className="rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-[12.5px] font-medium text-text-muted hover:bg-bg-subtle"
              >
                ← Previous
              </Link>
              <Link
                href={`/studio/comms-calendar?brand=${brand}&week=${next}`}
                className="rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-[12.5px] font-medium text-text-muted hover:bg-bg-subtle"
              >
                Next →
              </Link>
            </div>
            {/* The calendar must never imply live data — inbound sync is on a schedule. */}
            <span className="text-2xs text-text-subtle">
              as of {new Date(week.asOf).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <WeekGrid week={week} state={brand} />
          <NotDatedBar notDated={week.notDated} />

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
    </AppShell>
  );
}
