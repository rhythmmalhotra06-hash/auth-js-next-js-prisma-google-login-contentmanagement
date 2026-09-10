// Vishen's card — artboard `5c`, the top of `/studio`.
//
// The design handoff calls this "the closest surface to what Vishen actually asked for": the
// week's message, the one number, and what is blocked on HIM. Decision U3 puts the blockers
// first and loudest, because he is the bottleneck he cannot see — everything else on this page
// is information, and this is the only part that is a request.
//
// ── Colour discipline, which is the whole of `5c`'s feedback ───────────────────────────────────
//
// The original had gold on the block border, on the date pills AND on a rule — three golds, and
// "if two things are gold, neither reads as urgent". So:
//
//   • GOLD is the block FRAME and nothing else. It is the page's single gold element; the
//     awaiting-sign-off funnel lane below gave up its gold accent for this (globals.css).
//   • The date pills inside are AMBER/warning — blocked is a STATE, not attention.
//   • The action is a neutral outline button. It is a link, not an alarm.
//   • Brand pills are TEAL for VL on every surface. They were Mindvalley purple here while being
//     teal on the calendar, which made the two brand pills byte-identical and collapsed the
//     entire two-brand argument the moment you left the calendar.
//
// There is deliberately NO "N blocked on you" summary line at the foot: the block directly above
// already says it and names each one. Two mentions, one fact.

import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { EmptyOwned } from '@/components/ui/Empty';
import type { BrandWeekHeader } from '@/lib/comms-calendar/types';

export interface VishenBlocker {
  id: string;
  title: string;
  /** What is being asked of him, e.g. 'Shoot sign-off' or 'Clip approval'. */
  kind: string;
  /** Filming date or similar. Rendered as an amber pill — a state, not an alarm. */
  when: string | null;
  href: string;
  actionLabel: string;
}

export function VishenCard({
  blockers,
  headers,
  weekHref,
}: {
  blockers: VishenBlocker[];
  headers: BrandWeekHeader[];
  weekHref: string;
}) {
  return (
    <div className="flex flex-col gap-[22px]">
      {/* ── Blocked on you. First, and the page's ONE gold element. ────────── */}
      {blockers.length > 0 ? (
        <div className="rounded-md border-2 border-gold bg-surface p-[18px]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-base font-bold tracking-[-.01em]">
              Waiting on you
            </h2>
            <span className="text-2xs text-text-subtle">
              nothing moves past these until you look
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {blockers.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-sm border border-border-default bg-surface-recessed px-3 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold leading-snug text-pretty">{b.title}</span>
                  <span className="mt-0.5 block text-2xs text-text-muted">{b.kind}</span>
                </span>

                {/* Amber, not gold: this is a state. */}
                {b.when ? (
                  <span className="flex-none rounded-sm bg-warning-soft px-2 py-1 text-2xs font-semibold text-warning-content">
                    {b.when}
                  </span>
                ) : null}

                {/* Neutral outline. It is a link, not an alarm. */}
                <Link
                  href={b.href}
                  className="flex-none rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-2xs font-semibold text-text hover:bg-bg-subtle"
                >
                  {b.actionLabel}
                </Link>
              </div>
            ))}
          </div>
        </div>
      ) : (
        // Nothing waiting is genuinely good news and must not wear the urgent frame.
        <div className="rounded-md border border-border-default bg-surface px-[18px] py-3.5">
          <span className="text-[13px] text-text-muted">Nothing is waiting on you right now.</span>
        </div>
      )}

      {/* ── This week's message, per brand ─────────────────────────────────── */}
      <div className="grid gap-3 md:grid-cols-2">
        {headers.map((h) => (
          <div key={h.brand} className="rounded-md border border-border-default bg-surface p-[18px]">
            <Badge tone={h.brand === 'VL' ? 'vishen' : 'brand'}>{h.label}</Badge>

            <div className="mt-3">
              {h.message === null ? (
                <>
                  <div className="text-base font-semibold tracking-[-.01em] text-text-subtle">
                    No message committed
                  </div>
                  <EmptyOwned kind="noMessage" className="mt-1" />
                </>
              ) : (
                <div className="font-display text-base font-bold leading-[1.3] tracking-[-.02em]">
                  {h.message}
                </div>
              )}
            </div>

            <div className="mt-3.5 border-t border-border-default pt-3">
              <div className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
                The number
              </div>
              {/*
                The card STOPS HERE when there is no target. No slot, no bar, no 0% track — the
                three literal-zero violations the design pass found were all a component carrying
                on past the point where it had data. Leads and revenue are not wired into the app.
              */}
              {h.goal === null ? (
                <EmptyOwned kind="noGoal" className="mt-1" />
              ) : (
                <>
                  <div className="mt-1 text-[13px] leading-snug text-pretty">{h.goal}</div>
                  <EmptyOwned kind="notSet" owner="not measured in here yet" className="mt-1.5" />
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <Link href={weekHref} className="text-[12.5px] font-medium text-brand hover:underline">
        See the whole week →
      </Link>
    </div>
  );
}
