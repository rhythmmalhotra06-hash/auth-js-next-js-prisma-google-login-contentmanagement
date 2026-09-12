// Next week, on the Monday pack.
//
// The meeting's only chance to change anything is the week ahead — everything above this section
// already happened. So the empty weekdays are the point of it, not a footnote: a Wednesday with
// nothing planned is still fixable on Monday morning and is not on Friday.
//
// It shows the PLAN and never a forecast. A blank day says it is blank; it does not guess what
// will fill it.

import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { EmptyFine } from '@/components/ui/Empty';
import { cn } from '@/lib/cn';
import type { NextWeek as NextWeekData } from '@/lib/mow/next-week';

export function NextWeek({ next, calendarHref }: { next: NextWeekData; calendarHref: string }) {
  const range = `${new Date(`${next.weekStart}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', timeZone: 'UTC' })}–${new Date(`${next.weekEnd}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })}`;

  return (
    <div className="rounded-md border border-border-default bg-surface p-[18px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="text-[13.5px] font-semibold">{range}</span>
          {next.message ? (
            <span className="ml-2 text-[13px] text-text-muted">under {next.message}</span>
          ) : (
            <span className="ml-2 text-[13px] text-text-subtle">no message committed yet</span>
          )}
        </div>
        <span className="text-2xs tabular-nums text-text-subtle">
          {next.totals.emails} emails · {next.totals.posts} posts planned
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {next.days.map((d) => {
          const empty = d.emails === 0 && d.posts === 0;
          return (
            <div
              key={d.date}
              className={cn(
                'rounded-sm border p-2.5',
                // An empty WEEKDAY is the actionable thing. An empty weekend is normal and must
                // not wear the same colour, or the signal stops meaning anything.
                empty && !d.isWeekend
                  ? 'border-warning bg-warning-soft'
                  : d.isWeekend
                    ? 'border-border-default bg-bg-muted/30'
                    : 'border-border-default bg-surface',
              )}
            >
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xs font-semibold uppercase tracking-[.06em] text-text-subtle">
                  {d.weekday.slice(0, 3)}
                </span>
                <span className="font-display text-[15px] font-bold leading-none tabular-nums">
                  {d.dayOfMonth}
                </span>
              </div>

              {empty ? (
                d.isWeekend ? (
                  <div className="mt-1.5"><EmptyFine>—</EmptyFine></div>
                ) : (
                  <div className="mt-1.5 text-2xs font-semibold text-warning-content">
                    nothing planned
                  </div>
                )
              ) : (
                <>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {d.emails > 0 ? <Badge tone="neutral" dot={false}>{d.emails} email</Badge> : null}
                    {d.posts > 0 ? <Badge tone="neutral" dot={false}>{d.posts} post{d.posts === 1 ? '' : 's'}</Badge> : null}
                  </div>
                  {d.titles.length ? (
                    <div className="mt-1.5 line-clamp-2 text-2xs leading-snug text-text-subtle">
                      {d.titles[0]}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>

      {next.emptyWeekdays.length ? (
        <p className="mt-3 text-xs leading-relaxed text-text-muted">
          <span className="font-semibold text-warning-content">
            {next.emptyWeekdays.map((d) => d.weekday).join(', ')} {next.emptyWeekdays.length === 1 ? 'has' : 'have'} nothing planned.
          </span>{' '}
          Still fixable this morning; not on Friday.
        </p>
      ) : (
        <p className="mt-3 text-xs text-text-muted">Every weekday next week has something planned.</p>
      )}

      <Link href={calendarHref} className="mt-2.5 inline-block text-[12.5px] font-medium text-brand hover:underline">
        Open next week in the calendar →
      </Link>
    </div>
  );
}
