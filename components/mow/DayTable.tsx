'use client';

// The day-by-day table — artboard `2a`, and the fix for a real rendering bug.
//
// THE BUG THIS REPLACES. The exported pack wrapped each expandable row as
// `<div data-toggle="open"><tr>…</tr></div>` inside `<tbody>`. HTML table parsing does not permit
// a `div` there, so browsers HOIST it out of the table — meaning every expanded day read rendered
// somewhere other than where the markup implied, or not at all. It was invisible in review because
// the collapsed state looked correct. `build-export.mjs` still emits the same shape.
//
// A CSS grid has no such parsing rules: the expansion is a normal child spanning every column with
// `grid-column: 1 / -1`. That is the whole reason this is a grid and not a table, so please don't
// "restore" the table.
//
// The per-day Learning column from the original is deliberately gone — it duplicated the
// "What we learned" section immediately below it.

import { useState } from 'react';
import { Badge, SLOT_TONE } from '@/components/ui/Badge';
import { EmptyFine, EmptyOwned, TIER2 } from '@/components/ui/Empty';
import { cn } from '@/lib/cn';
import type { PackDay, PlatformRead } from '@/lib/mow/week-pack';

/** Seven columns: day · planned · shipped · state · the three platform reads collapsed to one. */
const COLS = 'grid-cols-[92px_84px_84px_112px_minmax(0,1fr)]';

function fmt(n: number | null): string | null {
  return n === null || !Number.isFinite(n) ? null : n.toLocaleString('en-US');
}

/**
 * One platform's numbers, with the gaps named rather than zeroed.
 *
 * Instagram reports reach and engagements but no clicks; Facebook reports clicks and neither of
 * the others; TikTok reports reach alone. Verified on live rows. So a missing value here means
 * "this platform does not report it" — printing 0 would be a claim about performance.
 */
function PlatformLine({ p }: { p: PlatformRead }) {
  const parts: string[] = [];
  const reach = fmt(p.reach);
  const eng = fmt(p.engagements);
  const clicks = fmt(p.clicks);
  if (reach !== null) parts.push(`${reach} reach`);
  if (eng !== null) parts.push(`${eng} engagements`);
  if (clicks !== null) parts.push(`${clicks} clicks`);

  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <span className="min-w-[76px] text-xs font-semibold">{p.platform}</span>
      <span className="text-2xs text-text-muted">{p.posts} {p.posts === 1 ? 'post' : 'posts'}</span>
      {parts.length ? (
        <span className="text-xs tabular-nums text-text">{parts.join(' · ')}</span>
      ) : (
        <EmptyOwned kind="notSet" owner="not reported by this platform" />
      )}
    </div>
  );
}

function DayRow({ d, open, onToggle }: { d: PackDay; open: boolean; onToggle: () => void }) {
  const expandable = d.platforms.length > 0 || d.vlTitles.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={expandable ? onToggle : undefined}
        aria-expanded={expandable ? open : undefined}
        disabled={!expandable}
        className={cn(
          'col-span-full grid items-center gap-0 border-b border-border-default text-left',
          COLS,
          d.isToday && 'bg-today-tint',
          expandable ? 'cursor-pointer hover:bg-bg-subtle' : 'cursor-default',
        )}
      >
        <span className="flex items-baseline gap-1.5 px-3 py-2.5">
          <span className="text-2xs font-semibold uppercase tracking-[.06em] text-text-subtle">
            {d.weekday.slice(0, 3)}
          </span>
          <span className={cn('font-display text-[15px] font-bold tabular-nums', d.isToday ? 'text-brand' : 'text-text')}>
            {d.dayOfMonth}
          </span>
        </span>

        <span className="px-3 py-2.5 text-xs tabular-nums text-text-muted">
          {d.planned > 0 ? d.planned : <EmptyFine>{TIER2.dash}</EmptyFine>}
        </span>

        {/* Never a zero: a future day has not failed to ship, it has not arrived. */}
        <span className="px-3 py-2.5 text-xs tabular-nums">
          {d.isFuture ? <EmptyFine>{TIER2.dash}</EmptyFine>
            : d.delivered > 0 ? <span className="font-semibold">{d.delivered}</span>
            : <EmptyFine>{TIER2.dash}</EmptyFine>}
        </span>

        <span className="px-3 py-2.5">
          {d.state ? (
            <Badge tone={SLOT_TONE[d.state]}>{d.state === 'offPlan' ? 'off plan' : d.state}</Badge>
          ) : (
            <EmptyFine>{d.isFuture ? TIER2.nothingScheduled : TIER2.dash}</EmptyFine>
          )}
        </span>

        <span className="flex items-center gap-2 px-3 py-2.5 text-2xs text-text-muted">
          {d.platforms.length
            ? d.platforms.map((p) => `${p.platform} ${p.posts}`).join(' · ')
            : d.isFuture ? '' : <EmptyFine>{TIER2.dash}</EmptyFine>}
          {expandable ? (
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
                 className={cn('ml-auto h-3.5 w-3.5 flex-none transition-transform', open && 'rotate-180')}>
              <path d="M4 6.5 8 10.5 12 6.5" />
            </svg>
          ) : null}
        </span>
      </button>

      {/*
        THE EXPANSION. `col-span-full` is the whole point — see the header comment. In the version
        this replaces the equivalent block was a div wrapping a tr, which the browser moved.
      */}
      {open && expandable ? (
        <div className="col-span-full border-b border-border-default bg-surface-recessed px-3 py-3">
          {d.platforms.length ? (
            <div className="flex flex-col gap-2">
              {d.platforms.map((p) => <PlatformLine key={p.platform} p={p} />)}
            </div>
          ) : null}

          {d.vlTitles.length ? (
            <div className={cn(d.platforms.length > 0 && 'mt-3.5 border-t border-border-default pt-3')}>
              <div className="mb-1.5 text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
                Vishen&rsquo;s lane
              </div>
              <div className="flex flex-col gap-1">
                {d.vlTitles.map((a) => (
                  <div key={a.id} className="flex items-baseline gap-2">
                    <span className={cn('mt-[5px] h-1.5 w-1.5 flex-none rounded-full', a.live ? 'bg-success' : 'bg-border-default')} />
                    <span className="text-xs">{a.title}</span>
                    {a.channel ? <span className="text-2xs text-text-subtle">{a.channel}</span> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {d.mvSlots > 0 ? (
            <div className="mt-3 text-2xs text-text-subtle">
              Mindvalley planned {d.mvSlots} {d.mvSlots === 1 ? 'slot' : 'slots'} this day — email and
              social, from the comms calendar.
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function DayTable({ days }: { days: PackDay[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-md border border-border-default bg-surface">
      <div className={cn('grid border-b border-border-default bg-surface-recessed', COLS)}>
        {/*
          "Planned" and "Went live" are two separate facts, NOT a ratio — Perch watches every
          connected account (including the regional ones) while the comms calendar plans a much
          smaller set, so "went live" routinely exceeds "planned". Labelled, and stated under the
          table, so nobody reads 7-against-19 as a completion rate.
        */}
        {['Day', 'Planned', 'Went live', 'Status', 'Platforms'].map((h) => (
          <span key={h} className="px-3 py-2 text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
            {h}
          </span>
        ))}
      </div>

      <div className={cn('grid', COLS)}>
        {days.map((d) => (
          <DayRow key={d.date} d={d} open={open === d.date} onToggle={() => setOpen(open === d.date ? null : d.date)} />
        ))}
      </div>
    </div>
  );
}
