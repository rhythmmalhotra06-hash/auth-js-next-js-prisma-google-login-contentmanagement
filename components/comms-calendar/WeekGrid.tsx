// The week calendar — artboard `1a`, day-rows with two brand columns.
//
// Days are ROWS and brands are COLUMNS, which is the decision the handoff asked for (X1). In
// day-columns at 186px a cell holds two titles plus a count, six expanded assets is ~560px tall,
// and that sets the height of the whole week row. As rows, the same six are six single lines at
// 13px that never truncate — and both brands land on the same line, which *is* the Monday
// question: on this day, what went out for Vishen and what went out for Mindvalley.
//
// Week is a schedule; Month keeps the calendar shape. A deliberate split, not an inconsistency.

import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { AssetRow, OverflowCollapse } from '@/components/ui/Asset';
import { EmptyOwned, EmptyFine, TIER2 } from '@/components/ui/Empty';
import { cn } from '@/lib/cn';
import type { BrandState, BrandWeekHeader, CalendarDay, CalendarWeek } from '@/lib/comms-calendar/types';

const LANE_COLS: Record<BrandState, string> = {
  // 104px day gutter, then one column per visible lane.
  main: 'grid-cols-[104px_minmax(0,1fr)_minmax(0,1fr)]',
  vl: 'grid-cols-[104px_minmax(0,1fr)]',
  mv: 'grid-cols-[104px_minmax(0,1fr)]',
};

const shows = (state: BrandState, brand: 'VL' | 'MV') =>
  state === 'main' || (state === 'vl' && brand === 'VL') || (state === 'mv' && brand === 'MV');

/**
 * The lane header — message, goal and volume.
 *
 * Lane weighting is `6c` option C: both lanes keep a full readable column and a 6px bar declares
 * the volume difference. Sizing the columns 6fr/21fr would make the layout say Vishen's brand
 * *matters less*, and the grid would reflow every week so nothing is comparable.
 */
function LaneHeader({ h }: { h: BrandWeekHeader }) {
  const tone = h.brand === 'VL' ? 'vishen' : 'brand';
  return (
    <div className="px-[18px] py-[14px]">
      <Badge tone={tone}>{h.label}</Badge>

      <div className="mt-2">
        {h.message === null ? (
          // Never borrowed from the other brand, and never scanned for outside this week — both
          // are how an earlier version put a message on Vishen's lane that he never committed.
          //
          // Y2: a junk value (`test`) lands here too. It renders as the ordinary gap rather than
          // as itself with a chip, because the founder reads this surface and junk-plus-caveat
          // still reads as a broken tool. The value is never rewritten, only not shown — it
          // reaches `week.warnings` for whoever can fix it upstream.
          <>
            <div className="text-base font-semibold tracking-[-.01em] text-text-subtle">
              No message committed
            </div>
            <div className="mt-0.5 text-xs text-text-subtle">Nothing is inherited from the other brand</div>
          </>
        ) : (
          <div className="text-base font-semibold tracking-[-.01em]">{h.message}</div>
        )}
      </div>

      {/* A one-day beat inside the week's campaign message. Kept, not ranked against it. */}
      {h.related.length ? (
        <div className="mt-1.5 flex flex-col gap-0.5">
          {h.related.map((r) => (
            <div key={r.name} className="text-xs text-text-muted">
              <span className="text-text">{r.name}</span>
              <span className="text-text-subtle"> · {r.days === 1 ? '1 day' : `${r.days} days`}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
        <span>{h.datedCount} assets dated this week</span>
        {h.spanNote ? <span className="text-text-subtle">{h.spanNote}</span> : null}
      </div>

      {/* Volume, declared rather than encoded in the column width. */}
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle">
        <div
          className={cn('h-full rounded-full', h.brand === 'VL' ? 'bg-vishen' : 'bg-brand')}
          style={{ width: `${Math.max(h.volumePct, 2)}%` }}
        />
      </div>
    </div>
  );
}

function LaneCell({
  assets,
  overflow,
  brand,
  emptyLabel,
  assetHref,
  emailHref,
}: {
  assets: CalendarDay['vl'];
  overflow: number;
  brand: 'VL' | 'MV';
  emptyLabel: 'gap' | 'fine';
  /** Opens the asset detail (`5b`) for a VL asset or a 📣 Social post. */
  assetHref?: (id: string) => string;
  /** Opens the email detail. Separate because an email is a different record in a different table. */
  emailHref?: (id: string) => string;
}) {
  if (!assets.length && !overflow) {
    return (
      <div className="px-[18px] pb-[13px] pt-3">
        {emptyLabel === 'gap' ? (
          <EmptyOwned kind="nothingDated" />
        ) : (
          <EmptyFine>{TIER2.noEmailDay}</EmptyFine>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 px-[18px] pb-[13px] pt-3">
      {assets.map((a) => (
        <AssetRow
          key={a.id}
          title={a.title}
          // Everything with a record behind it links now. The exception that remains is a day
          // that declares emails by a bare count with nothing linked — there is nothing to open.
          href={
            a.emailId
              ? emailHref?.(a.emailId)
              : assetHref && !a.id.includes(':')
                ? assetHref(a.id)
                : undefined
          }
          state={a.live ? 'live' : null}
          meta={[a.channel, a.status].filter(Boolean).join(' · ') || undefined}
          pills={
            <>
              {a.channel ? (
                <Badge tone="neutral" dot={false}>{a.channel}</Badge>
              ) : null}
              {/*
                Max two pills. Delivered numbers win the second slot when we have them — that is
                what the meeting is looking for — and a missing goal takes it otherwise.
              */}
              {a.results?.reach ? (
                <Badge tone="success" dot={false}>
                  {a.results.reach.toLocaleString('en-US')} reach
                </Badge>
              ) : !a.goal ? (
                <Badge tone="staged" dot={false}>no goal</Badge>
              ) : null}
            </>
          }
        />
      ))}
      {overflow > 0 ? (
        <OverflowCollapse
          count={overflow}
          label={brand === 'MV' ? 'more social' : 'more'}
          detail="channels not in this view"
        />
      ) : null}
    </div>
  );
}

export function WeekGrid({
  week,
  state,
  assetHref,
  emailHref,
}: {
  week: CalendarWeek;
  state: BrandState;
  assetHref?: (id: string) => string;
  emailHref?: (id: string) => string;
}) {
  const headers = week.headers.filter((h) => shows(state, h.brand));
  const weekdays = week.days.filter((d) => !d.isWeekend);
  const weekend = week.days.filter((d) => d.isWeekend);

  return (
    <div className="overflow-hidden rounded-md border border-border-default bg-surface">
      {/* ── Lane headers, declared once ─────────────────────────────────── */}
      <div className={cn('grid border-b border-border-default', LANE_COLS[state])}>
        <div className="bg-surface-recessed" />
        {headers.map((h) => (
          <div key={h.brand} className="border-l border-border-default">
            <LaneHeader h={h} />
          </div>
        ))}
      </div>

      {/* ── The one gold element: the gap the meeting is blocked by ──────── */}
      {week.brandsWithoutGoal.length ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-gold bg-gold-soft px-[18px] py-2.5">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4 flex-none text-gold-content">
            <circle cx="10" cy="10" r="7.5" /><path d="M10 6.5v4.5" /><circle cx="10" cy="13.6" r=".8" fill="currentColor" stroke="none" />
          </svg>
          <span className="text-[13px] font-semibold text-gold-content">
            {week.brandsWithoutGoal.length === week.headers.length
              ? 'No goal is committed on either brand this week.'
              : `No goal is committed on ${week.headers
                  .filter((h) => week.brandsWithoutGoal.includes(h.brand))
                  .map((h) => h.label)
                  .join(' or ')} this week.`}
          </span>
          <span className="text-[12.5px] text-text-muted">
            Its assets inherit nothing. Goal has no owner.
          </span>
        </div>
      ) : null}

      {/* ── Day rows ─────────────────────────────────────────────────────── */}
      {weekdays.map((d) => (
        <div
          key={d.date}
          className={cn(
            'grid border-b border-border-default last:border-b-0',
            LANE_COLS[state],
            d.isToday && 'bg-today-tint',
          )}
        >
          <div className="flex flex-col items-end justify-start bg-surface-recessed px-3 pt-3 text-right">
            <span className="text-[10.5px] font-semibold uppercase tracking-[.06em] text-text-subtle">
              {d.weekday.slice(0, 3)}
            </span>
            <span
              className={cn(
                'font-display text-[19px] font-bold leading-[1.15] tracking-[-.02em]',
                d.isToday ? 'text-brand' : 'text-text',
              )}
            >
              {d.dayOfMonth}
            </span>
            {d.isToday ? (
              <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[.06em] text-brand">today</span>
            ) : null}
          </div>

          {headers.map((h) => (
            <div key={h.brand} className="min-h-[70px] border-l border-border-default">
              <LaneCell
                assets={h.brand === 'VL' ? d.vl : d.mv}
                overflow={h.brand === 'VL' ? d.vlOverflow : d.mvOverflow}
                brand={h.brand}
                emptyLabel="gap"
                assetHref={assetHref}
                emailHref={emailHref}
              />
            </div>
          ))}
        </div>
      ))}

      {/* ── Weekend, collapsed to one row: said once per boundary, not per cell ── */}
      {weekend.length ? (
        <div className={cn('grid border-b border-border-default bg-bg-muted/40', LANE_COLS[state])}>
          <div className="flex flex-col items-end bg-surface-recessed px-3 py-3 text-right">
            <span className="text-[10.5px] font-semibold uppercase tracking-[.06em] text-text-subtle">Sat–Sun</span>
            <span className="font-display text-[15px] font-bold leading-tight tracking-[-.02em] text-text-subtle">
              {weekend.map((d) => d.dayOfMonth).join('–')}
            </span>
          </div>
          {headers.map((h) => {
            const any = weekend.some((d) => (h.brand === 'VL' ? d.vl.length : d.mv.length));
            return (
              <div key={h.brand} className="min-h-[52px] border-l border-border-default px-[18px] py-3">
                {any ? (
                  weekend.flatMap((d) => (h.brand === 'VL' ? d.vl : d.mv)).map((a) => (
                    <AssetRow
                      key={a.id}
                      title={a.title}
                      href={assetHref && h.brand === 'VL' ? assetHref(a.id) : undefined}
                      state={a.live ? 'live' : null}
                    />
                  ))
                ) : h.brand === 'MV' ? (
                  <EmptyFine>{TIER2.noEmailDay}</EmptyFine>
                ) : (
                  <EmptyOwned kind="nothingDated" />
                )}
              </div>
            );
          })}
        </div>
      ) : null}

      {/*
        ── The grid states its own boundary, so an empty future week is not read as a broken tool ──

        Y3: this is COMPUTED, never a constant. The design was written when the last Vishen date was
        22 Sep, which made "content stops here" a fair sentence. It no longer is — the tail is
        sparse (3 assets across 23, 26 and 30 Sep), so the strip states how many are out there
        rather than implying either a full future or a cliff. Future days are provisional, never red.
      */}
      {week.datedThrough ? (
        <div className="bg-surface-recessed px-[18px] py-2.5 text-center text-2xs text-text-muted">
          Vishen&rsquo;s lane is dated through{' '}
          {new Date(`${week.datedThrough}T00:00:00Z`).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', timeZone: 'UTC',
          })}
          {week.datedAfterWeek > 0
            ? ` — ${week.datedAfterWeek} ${week.datedAfterWeek === 1 ? 'asset' : 'assets'} after this week, spread thin.`
            : '. Later weeks will page, and will be empty.'}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The not-dated tray. Its count is the nag — published assets the calendar can never show.
 *
 * The prose is computed, not asserted. It read "More than half the Vishen workflow" from the
 * handoff's 221-undated-against-219-dated snapshot; by the first live run Ramya had moved it to
 * 204 against 238, making the sentence quietly false. A number that moves weekly does not belong
 * in a hardcoded phrase.
 */
export function NotDatedBar({ notDated, href }: { notDated: CalendarWeek['notDated']; href?: string }) {
  if (!notDated.total) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-warning bg-warning-soft px-4 py-3">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4 flex-none text-warning-content">
        <rect x="2.5" y="4" width="15" height="13" rx="1.6" /><path d="M2.5 8h15M7 2.5v3M13 2.5v3" />
      </svg>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-warning-content">
          Not dated · {notDated.total} assets, {notDated.published} of them already published
        </div>
        <div className="mt-0.5 text-xs text-text-muted">
          {notDated.sharePct === null ? 'Some' : `${notDated.sharePct}%`} of the Vishen workflow has no Live Date, so the
          calendar cannot place it. Nothing here is dropped — it is just not on a day yet.
        </div>
      </div>
      {href ? (
        <Link
          href={href}
          className="flex-none rounded-sm border border-warning bg-surface px-3 py-1.5 text-2xs font-semibold text-warning-content hover:bg-warning-soft"
        >
          Open the tray
        </Link>
      ) : null}
    </div>
  );
}
