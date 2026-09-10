// A brand's week — artboard `2a`, items 3 and 5.
//
// **The two cards are deliberately DIFFERENT SHAPES**, and that is the design decision, not an
// inconsistency to tidy. Mindvalley has a real goal and shows it; Vishen has none, so the card
// STOPS EARLY and names who sets it. Asymmetric data deserves asymmetric treatment — the same
// argument the calendar makes about its two lanes. Forcing both into one template is how you end
// up rendering `of No target set` in a value slot, which is what this replaces.
//
// Provenance is stated ONCE at screen level (see the page), not per card. The version this
// replaces carried Staged + Sample figure + Target inferred + a session id + a parsed sentence on
// every card — honest, but the hedging read louder than the values did.

import { Badge } from '@/components/ui/Badge';
import { EmptyOwned } from '@/components/ui/Empty';
import type { BrandWeekHeader } from '@/lib/comms-calendar/types';

export function BrandCard({ h }: { h: BrandWeekHeader }) {
  return (
    <div className="flex min-w-0 flex-col rounded-md border border-border-default bg-surface p-[18px]">
      {/* VL is teal on EVERY surface. It was Mindvalley purple here while being teal on the
          calendar, which made the two brand pills byte-identical and collapsed the whole
          two-brand argument the moment you left the calendar. */}
      <Badge tone={h.brand === 'VL' ? 'vishen' : 'brand'}>{h.label}</Badge>

      <div className="mt-3">
        {h.message === null ? (
          <>
            <div className="text-lg font-semibold tracking-[-.01em] text-text-subtle">
              No message committed
            </div>
            <EmptyOwned kind="noMessage" className="mt-1" />
          </>
        ) : (
          <div className="font-display text-lg font-bold leading-[1.25] tracking-[-.02em]">
            {h.message}
          </div>
        )}
      </div>

      {h.related.length ? (
        <div className="mt-2 flex flex-col gap-0.5">
          {h.related.map((r) => (
            <div key={r.name} className="text-xs text-text-muted">
              {r.name} <span className="text-text-subtle">· {r.days === 1 ? '1 day' : `${r.days} days`}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3.5 border-t border-border-default pt-3">
        <div className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">Goal</div>
        {h.goal === null ? (
          // The card stops here. No slot, no bar, no zero — the three literal-zero violations the
          // design found were all a component carrying on past the point where it had data.
          <EmptyOwned kind="noGoal" className="mt-1" />
        ) : (
          <div className="mt-1 text-[13px] leading-snug text-pretty">{h.goal}</div>
        )}
      </div>

      <div className="mt-3.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-2xs text-text-subtle">
        <span>{h.datedCount} assets dated</span>
        {h.spanNote ? <span>{h.spanNote}</span> : null}
      </div>
    </div>
  );
}
