// Blockers on the Monday pack — artboard `2a`, section 6.
//
// Warning, never danger: `blocked` is upstream and `missed` is work that did not happen. Colouring
// them alike is how a status meeting turns into a defence, which is the thing this pack exists to
// stop. Red on this page belongs to `missed` alone.
//
// Not gold either. The commit bar is the page's ONE gold element — "if two things are gold,
// neither reads as urgent" — and a blocker list is exactly the sort of thing that would steal it.

import Link from 'next/link';
import type { Blocker } from '@/lib/mow/blockers';
import { EmptyFine } from '@/components/ui/Empty';

export function Blockers({ blockers }: { blockers: Blocker[] }) {
  if (!blockers.length) {
    return (
      <div className="rounded-md border border-border-default bg-surface px-4 py-3">
        <EmptyFine>Nothing upstream is holding this week up.</EmptyFine>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-warning bg-warning-soft">
      {blockers.map((b) => (
        <div key={b.id} className="border-b border-warning/40 p-[18px] last:border-b-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[13.5px] font-semibold leading-snug text-warning-content text-pretty">
              {b.what}
            </span>
            {/* The owner sits on the same line as the fact, because a blocker with no name
                against it is a complaint rather than an item. */}
            <span className="flex-none text-2xs font-semibold uppercase tracking-[.06em] text-warning-content/80">
              {b.owner}
            </span>
          </div>
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-text-muted">{b.why}</p>
          {b.href ? (
            <Link href={b.href} className="mt-1.5 inline-block text-[12.5px] font-medium text-brand hover:underline">
              Open it →
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}
