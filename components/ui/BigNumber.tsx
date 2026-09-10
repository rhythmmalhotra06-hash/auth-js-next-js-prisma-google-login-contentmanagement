// The headline number — three cases, and the "never a zero" rule.
//
// Design handoff `3a` §"The number — three cases". The point it makes is structural, not cosmetic:
// **a missing target changes the SHAPE of the component, not just its text.** The version this
// replaces rendered `of No target set` — a value slot doing a sentence's job — and, worse, drew a
// full progress track with a target marker at 0% fill for a video that had no YouTube counterpart.
//
//   1. Target is real     → 18,240  of 35,000
//   2. Target is inferred → 18,240  of ~35,000, then ONE line carrying the sentence it was parsed
//                           from. A tilde, not a boxed callout.
//   3. No target          → the value alone, then a tier-1 gap naming who sets it.
//                           **The card stops early. No slot, no bar, no zero.**
//
// Case 3 is the common one right now: `Goal` is empty on all six real Message-of-the-Week records,
// so the lookup chain resolves to nothing and no asset inherits a goal.
//
// Pairs with `resolveTarget()` in lib/mow/smart-number.ts, whose `provenance` maps 1:1 onto these.

import { cn } from '@/lib/cn';
import { EmptyOwned } from '@/components/ui/Empty';

export type TargetProvenance = 'numeric' | 'inferred' | 'none';

/**
 * Format a value for display, or return null when there is nothing honest to show.
 *
 * Returning null rather than 0 is the whole rule: a percentage over an empty denominator renders
 * blank, never `0%` and never `NaN`. Callers render `<EmptyFine/>` or a tier-1 gap instead.
 */
export function fmt(value: number | null | undefined, opts?: { suffix?: string }): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return `${value.toLocaleString('en-US')}${opts?.suffix ?? ''}`;
}

export function BigNumber({
  label,
  value,
  target,
  provenance = 'none',
  targetProse,
  source,
  asOf,
  targetOwner = 'Ramya',
  className,
}: {
  label: string;
  /** Already formatted, or null when there is no figure. Null renders a tier-1 gap, never a zero. */
  value: string | null;
  /** Already formatted. Ignored unless provenance is 'numeric' or 'inferred'. */
  target?: string | null;
  provenance?: TargetProvenance;
  /** The sentence an inferred target was parsed from. Shown as one line, never a boxed callout. */
  targetProse?: string | null;
  /** Where the figure came from, e.g. 'session:metabase'. Rendered small so the swap is visible. */
  source?: string | null;
  /** Revenue drifts upward as late attribution lands, so no figure is ever final. */
  asOf?: string | null;
  targetOwner?: string | null;
  className?: string;
}) {
  const hasTarget = (provenance === 'numeric' || provenance === 'inferred') && !!target;

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">{label}</div>

      {value === null ? (
        // No figure at all — the metric is not connected yet. Never a 0.
        <EmptyOwned kind="notSet" owner="not connected" className="mt-0.5" />
      ) : (
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-[29px] font-bold leading-[1.05] tracking-[-.02em] tabular-nums">
            {value}
          </span>
          {hasTarget ? (
            <span className="text-sm text-text-muted">
              of {provenance === 'inferred' ? '~' : ''}
              {target}
            </span>
          ) : null}
        </div>
      )}

      {/* Case 3: the card stops early and names an owner. No slot, no bar. */}
      {value !== null && !hasTarget ? (
        <EmptyOwned kind="noGoal" owner={targetOwner} className="mt-1" />
      ) : null}

      {/* Case 2: one line, not a boxed callout. */}
      {provenance === 'inferred' && targetProse ? (
        <div className="mt-1 text-2xs leading-snug text-text-subtle">
          Parsed from “{targetProse}”
        </div>
      ) : null}

      {source || asOf ? (
        <div className="mt-1 flex flex-wrap gap-x-3 text-2xs text-text-subtle">
          {source ? <span>{source}</span> : null}
          {asOf ? <span>as of {asOf}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
