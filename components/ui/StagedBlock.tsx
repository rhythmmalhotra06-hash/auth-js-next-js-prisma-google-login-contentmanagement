// Staged vs committed — the guardrail Glen asked for, as one component.
//
// This is the most important novel pattern in the pack, and the reason it is a shared primitive
// rather than three near-copies: the headline number, the week summary and every learning all wear
// it, and if they drift apart the distinction stops being legible exactly when it matters.
//
// **A staged value that looks committed is worse than no value at all.** Glen's condition was
// specific — "if efficiency is a recommendation and that's not true, it might derail everything" —
// so the difference has to be visible at a glance, not on inspection.
//
//   STAGED    — dashed rule, violet-slate, `Staged` badge, and when it was drafted.
//   PROPOSED  — staged, plus an explicit marker that the SYSTEM wrote it (AA2). Never hidden: an
//               AI line must not read as a colleague's judgement. Editing one drops the marker,
//               because a human has then put their name behind the words.
//   COMMITTED — solid rule, ordinary ink, and the NAME of whoever committed it. The room should
//               know whose numbers these are.
//
// Gold is not used here at all. Gold is attention-only and belongs to the commit bar alone; if the
// staged blocks were gold too, nothing on the page would read as urgent.

import { cn } from '@/lib/cn';

export type BlockState = 'staged' | 'proposed' | 'committed';

const when = (d: Date | string | null | undefined): string | null => {
  if (!d) return null;
  const date = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
};

export function StagedBadge({ state, by, at }: { state: BlockState; by?: string | null; at?: Date | string | null }) {
  if (state === 'committed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-2xs font-semibold text-success-content">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3 w-3">
          <path d="M3.5 8.5 6.5 11.5 12.5 5" />
        </svg>
        {by ? `Committed by ${by.split('@')[0]}` : 'Committed'}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="rounded-sm bg-staged-soft px-2 py-0.5 text-2xs font-semibold text-staged-content">
        {state === 'proposed' ? 'Proposed by the system' : 'Staged'}
      </span>
      {when(at) ? <span className="text-2xs text-text-subtle">drafted {when(at)}</span> : null}
    </span>
  );
}

/**
 * The wrapper. `title` is optional — a learning does not need one, the headline number does.
 *
 * The left rule is the pre-attentive signal: dashed and violet while provisional, solid and quiet
 * once committed. Deliberately NOT a dashed box around the whole thing, which in light mode reads
 * as a component that failed to load.
 */
export function StagedBlock({
  state,
  by,
  at,
  title,
  children,
  actions,
  className,
}: {
  state: BlockState;
  by?: string | null;
  at?: Date | string | null;
  title?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const provisional = state !== 'committed';

  return (
    <div
      className={cn(
        'border-l-2 pl-3.5',
        provisional ? 'border-l-staged border-dashed' : 'border-l-border-strong',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {title ? (
          <span className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">{title}</span>
        ) : null}
        <StagedBadge state={state} by={by} at={at} />
        {actions ? <span className="ml-auto flex items-center gap-2">{actions}</span> : null}
      </div>
      <div className={cn('mt-1.5', provisional && 'text-staged-content')}>{children}</div>
    </div>
  );
}
