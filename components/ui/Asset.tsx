// Asset row / card, and the overflow collapse.
//
// Design handoff `3a`. Two densities, ONE anatomy — title first and heaviest.
//
// **The left edge carries state and nothing else.** The version this replaces put a brand-coloured
// border on every card even when the container already named the brand, which spent the only place
// a state signal reads pre-attentively on information the reader already had.
//
// Resting (`null`) is not an error and gets no colour — a plain hairline. An asset with no state
// recorded yet is the normal case, not a problem.

import { cn } from '@/lib/cn';

export type AssetState = 'live' | 'blocked' | 'missed' | null;

/** The left edge. Resting is a hairline, never a colour. */
const EDGE: Record<'live' | 'blocked' | 'missed', string> = {
  live: 'border-l-success',
  blocked: 'border-l-warning',
  missed: 'border-l-danger',
};
const edgeClass = (s: AssetState) => (s ? EDGE[s] : 'border-l-border-default');

export interface AssetLike {
  title: string;
  /** "LinkedIn · live" — channel and status as text, not a third pill. */
  meta?: React.ReactNode;
  state?: AssetState;
  /** Max TWO. The third is metadata and belongs on the meta line. */
  pills?: React.ReactNode;
  onClick?: () => void;
}

/**
 * Row density — week view (`1a`) and lists.
 *
 * Titles get 13px on one or two lines instead of 11.5px on five, and `text-wrap: pretty` keeps a
 * two-line title from orphaning its last word. In row layouts titles fit on one line and do not
 * truncate, which is why the overflow collapse can be dropped entirely there.
 */
export function AssetRow({ title, meta, state = null, pills, onClick, className }: AssetLike & { className?: string }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'flex w-full items-center gap-3 border-l-2 pl-2.5 text-left',
        edgeClass(state),
        onClick && 'cursor-pointer rounded-r-sm transition-colors hover:bg-bg-subtle',
        className,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold leading-snug tracking-[-.01em] text-pretty">
          {title}
        </span>
        {meta ? <span className="mt-0.5 block text-2xs text-text-muted">{meta}</span> : null}
      </span>
      {pills ? <span className="flex flex-none items-center gap-1.5">{pills}</span> : null}
    </Tag>
  );
}

/** Card density — 186px columns, month, compact grids. */
export function AssetCard({ title, meta, state = null, pills, onClick, className }: AssetLike & { className?: string }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'block w-full rounded-sm border border-border-default border-l-2 bg-surface px-2.5 py-2 text-left',
        edgeClass(state),
        onClick && 'cursor-pointer transition-colors hover:border-brand-border',
        className,
      )}
    >
      <span className="block text-xs font-semibold leading-[1.4] tracking-[-.01em] text-pretty">{title}</span>
      {meta ? <span className="mt-1.5 block text-2xs text-text-muted">{meta}</span> : null}
      {pills ? <span className="mt-1.5 flex flex-wrap gap-1">{pills}</span> : null}
    </Tag>
  );
}

/**
 * The overflow collapse — "5 more social".
 *
 * The single worst failure in the version this replaces: an 11px grey footnote representing 60–70%
 * of the day's volume, visually outweighed by one Email card. **It must never be quieter than a
 * single asset**, because it usually outnumbers them.
 *
 * `detail` carries channel composition ("2 IG · 2 FB · 1 X") where the Platform field is readable —
 * that answers the meeting's actual question, did every channel get fed. Where it isn't, say so
 * rather than inventing a breakdown.
 */
export function OverflowCollapse({
  count,
  label,
  detail,
  onClick,
  className,
}: {
  count: number;
  label: string;
  detail?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'flex w-full items-center gap-2 rounded-sm bg-bg-subtle px-2.5 py-1.5 text-left',
        onClick && 'cursor-pointer transition-colors hover:bg-border-default',
        className,
      )}
    >
      <span className="font-display text-[13px] font-bold leading-none tracking-[-.01em] tabular-nums">
        {count}
      </span>
      <span className="text-2xs font-medium text-text-muted">{label}</span>
      {detail ? <span className="ml-auto text-2xs text-text-subtle">{detail}</span> : null}
    </Tag>
  );
}

/**
 * A missing thumbnail states its reason VISIBLY. It was in a `title` attribute — invisible in a
 * meeting, which is the only place it matters. Never a broken-image icon.
 */
export function ThumbPlaceholder({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('block h-11 w-11 flex-none rounded-sm border border-border-default', className)}
      style={{
        // Dynamic-free but not expressible as a token: a hatch, so it reads as "deliberately absent".
        backgroundImage: 'repeating-linear-gradient(45deg,#f4f2f8 0 5px,#ece9f1 5px 10px)',
      }}
    />
  );
}
