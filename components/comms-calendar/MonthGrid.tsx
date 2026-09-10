// The month zoom-out — artboard `5a`.
//
// The message bands at the top are, per the design handoff, "the strongest single element in the
// whole export". They answer "what is this month about" spatially, before you read anything.
//
// Four rules from the handoff, and each one has a failure mode it is preventing:
//
//  1. **Absence must not have a band's shape.** A stretch with no message is a hairline rule plus
//     a named owner, never a grey filled block — a full-width grey band reads at a glance as a
//     message that spans the month, which is the opposite of what it means. On live data this is
//     the ENTIRE Vishen row: one asset in the base carries a message link and that message is
//     junk, so Vishen has no committed message all month. That row is the whole point of the view.
//  2. **No zero-width bars.** A lane with nothing that day emits no bar, so the bar count in a
//     cell is the real lane count. `width: 0px` with a blank label was a literal-zero violation.
//  3. **Provisional is not missed, and is never red.** Days past the last dated day keep their own
//     cells with a shared tint and ONE marker where the stretch begins. A reader must be able to
//     point at any individual day — an earlier revision used a spanning banner that erased 23-27
//     and merged 28/29.
//  4. **The boundary sentence sits BENEATH the grid**, not spanning cells inside it.

import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { EmptyOwned } from '@/components/ui/Empty';
import { cn } from '@/lib/cn';
import type { CalendarMonth, MonthBand, MonthDay } from '@/lib/comms-calendar/month';
import type { Brand, BrandState } from '@/lib/comms-calendar/types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * 9px of bar per asset, per the handoff's spec — a FIXED scale, not one normalised to the month's
 * busiest day. Fixed means a bar is comparable across months; normalised would make a quiet month
 * look as full as a busy one. Capped so a heavy day cannot overflow its cell.
 */
const PX_PER_ASSET = 9;
const MAX_BAR_PX = 100;

const shows = (state: BrandState, brand: Brand) =>
  state === 'main' || (state === 'vl' && brand === 'VL') || (state === 'mv' && brand === 'MV');

const shortRange = (a: string, b: string): string => {
  const f = (ymd: string, withMonth: boolean) =>
    new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric',
      ...(withMonth ? { month: 'short' as const } : {}),
      timeZone: 'UTC',
    });
  return a === b ? f(a, true) : `${f(a, false)}–${f(b, true)}`;
};

/**
 * One brand's band track.
 *
 * A narrow band cannot carry its label inside it — a single day is ~3% of the month, which is
 * about 36px, and an 11px label would clip. Those bands stay unlabelled here and are named in the
 * legend below instead, rather than being widened to fit text they do not own.
 */
function BandRow({ brand, label, bands }: { brand: Brand; label: string; bands: MonthBand[] }) {
  const named = bands.filter((b) => !b.gap);
  const allGap = named.length === 0;

  return (
    <div className="flex items-center gap-3 px-[18px] py-2.5">
      <div className="w-[154px] flex-none">
        <Badge tone={brand === 'VL' ? 'vishen' : 'brand'}>{label}</Badge>
      </div>

      {allGap ? (
        // RULE 1. No track, no block — a rule and an owner. The absence is stated, not drawn.
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span aria-hidden className="h-px flex-1 bg-border-default" />
          <EmptyOwned kind="noMessage" />
          <span aria-hidden className="h-px flex-1 bg-border-default" />
        </div>
      ) : (
        <div className="relative h-6 min-w-0 flex-1 overflow-hidden rounded-sm bg-surface-recessed">
          {named.map((b) => (
            <div
              key={`${b.brand}-${b.startYmd}`}
              title={`${b.name} · ${shortRange(b.startYmd, b.endYmd)}`}
              className={cn(
                'absolute inset-y-0 flex items-center overflow-hidden rounded-sm px-2',
                brand === 'VL' ? 'bg-vishen' : 'bg-brand',
              )}
              // Dynamic by nature: position and width are a share of the month.
              style={{ left: `${b.leftPct}%`, width: `${b.widthPct}%` }}
            >
              {b.widthPct >= 8 ? (
                <span className="truncate text-2xs font-semibold text-white">{b.name}</span>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <div className="w-[96px] flex-none text-right text-2xs text-text-subtle">
        {allGap ? '—' : shortRange(named[0].startYmd, named[named.length - 1].endYmd)}
      </div>
    </div>
  );
}

function DayCell({ d, state, href }: { d: MonthDay; state: BrandState; href: string | null }) {
  if (!d.inMonth) {
    // A padding cell. Not a day, so it carries nothing at all — not a zero, not a dash.
    return <div className="min-h-[78px] border-b border-r border-border-default bg-bg-muted/30" aria-hidden />;
  }

  // RULE 2: a lane with nothing emits NO bar. The array is built, not rendered conditionally
  // inside a fixed set of slots, so the cell's bar count is the day's real lane count.
  const bars: { brand: Brand; n: number }[] = [];
  if (d.vl > 0) bars.push({ brand: 'VL', n: d.vl });
  if (d.mv > 0) bars.push({ brand: 'MV', n: d.mv });
  const visible = bars.filter((b) => shows(state, b.brand));

  const body = (
    <>
      <div className="flex items-baseline justify-between">
        <span
          className={cn(
            'font-display text-[15px] font-bold leading-none tabular-nums',
            d.isToday ? 'text-brand' : d.isWeekend ? 'text-text-subtle' : 'text-text',
          )}
        >
          {d.dayOfMonth}
        </span>
        {d.isToday ? (
          <span className="text-[9.5px] font-semibold uppercase tracking-[.06em] text-brand">today</span>
        ) : null}
      </div>

      {/* RULE 3: ONE marker, where the stretch begins — not repeated on every cell after it. */}
      {d.boundaryStart ? (
        <div className="mt-1 flex items-center gap-1.5">
          <span aria-hidden className="h-1.5 w-1.5 flex-none bg-staged" />
          <span className="text-[9.5px] font-semibold uppercase tracking-[.05em] text-staged-content">
            nothing dated past here
          </span>
        </div>
      ) : null}

      {visible.length ? (
        <div className="mt-2 flex flex-col gap-1">
          {visible.map((b) => (
            <div key={b.brand} className="flex items-center gap-1.5">
              <span
                className={cn('h-[9px] rounded-[3px]', b.brand === 'VL' ? 'bg-vishen' : 'bg-brand')}
                style={{ width: `${Math.min(b.n * PX_PER_ASSET, MAX_BAR_PX)}px` }}
              />
              <span className="text-[9.5px] tabular-nums text-text-subtle">{b.n}</span>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );

  return (
    <div
      className={cn(
        'min-h-[78px] border-b border-r border-border-default p-2',
        // Provisional is a tint, never red — nothing here was missed, it was never dated.
        d.provisional ? 'bg-staged-soft' : d.isToday ? 'bg-today-tint' : d.isWeekend ? 'bg-bg-muted/25' : 'bg-surface',
      )}
    >
      {href && visible.length ? (
        <Link href={href} className="block h-full rounded-xs hover:opacity-80">
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}

export function MonthGrid({
  month,
  state,
  weekHref,
}: {
  month: CalendarMonth;
  state: BrandState;
  weekHref: (ymd: string) => string;
}) {
  const lanes: { brand: Brand; label: string }[] = [
    { brand: 'VL', label: 'Vishen Lakhiani Media' },
    { brand: 'MV', label: 'Mindvalley' },
  ].filter((l) => shows(state, l.brand as Brand)) as { brand: Brand; label: string }[];

  // Bands too narrow to carry their own label are named here instead of being widened.
  const unlabelled = month.bands.filter((b) => !b.gap && b.widthPct < 8 && shows(state, b.brand));

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="overflow-hidden rounded-md border border-border-default bg-surface">
        {lanes.map((l) => (
          <div key={l.brand} className="border-b border-border-default">
            <BandRow brand={l.brand} label={l.label} bands={month.bands.filter((b) => b.brand === l.brand)} />
          </div>
        ))}

        <div className="grid grid-cols-7 border-b border-border-default bg-surface-recessed">
          {WEEKDAYS.map((w) => (
            <span key={w} className="px-2 py-1.5 text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
              {w}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 border-l border-border-default">
          {month.weeks.flat().map((d, i) => (
            <DayCell
              key={`${d.date}-${i}`}
              d={d}
              state={state}
              href={d.inMonth ? weekHref(d.date) : null}
            />
          ))}
        </div>
      </div>

      {unlabelled.length ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {unlabelled.map((b) => (
            <span key={`${b.brand}-${b.startYmd}`} className="flex items-center gap-1.5 text-2xs text-text-muted">
              <span className={cn('h-2 w-2 flex-none rounded-[2px]', b.brand === 'VL' ? 'bg-vishen' : 'bg-brand')} />
              {b.name}
              <span className="text-text-subtle">· {shortRange(b.startYmd, b.endYmd)}</span>
            </span>
          ))}
        </div>
      ) : null}

      {/* RULE 4: the boundary sentence lives here, beneath the grid, never spanning cells. */}
      <div className="rounded-md border border-border-default bg-surface-recessed px-4 py-3">
        <div className="text-xs text-text-muted">
          {month.datedInMonth} Vishen assets are dated in {month.label}, across {month.vlDaysCovered} of{' '}
          {month.weeks.flat().filter((d) => d.inMonth).length} days.
          {month.datedAfterMonth > 0
            ? ` ${month.datedAfterMonth} more sit after this month.`
            : month.datedThrough
              ? ` Nothing is dated after ${new Date(`${month.datedThrough}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })} anywhere in the base.`
              : ''}
        </div>
        {month.notDated.total > 0 ? (
          <div className="mt-1.5 text-xs text-text-muted">
            A further <span className="font-semibold text-text">{month.notDated.total}</span> assets
            {month.notDated.sharePct !== null ? ` (${month.notDated.sharePct}% of the lane)` : ''} have no
            Live Date at all, so no month can place them —{' '}
            <span className="font-semibold text-warning-content">{month.notDated.published} already published.</span>{' '}
            <Link href="/studio/comms-calendar/not-dated" className="font-semibold text-brand hover:underline">
              Open the tray →
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
