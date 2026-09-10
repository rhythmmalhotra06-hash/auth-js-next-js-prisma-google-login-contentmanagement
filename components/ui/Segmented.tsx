// A segmented control, in two weights.
//
// WHY IT IS A PRIMITIVE. Three of these existed with two different active treatments, and the
// Week/Month one sat directly above the brand one wearing near-black (`bg-text`) while the brand
// one wore solid purple. Side by side that reads as a rendering fault rather than a hierarchy —
// which is exactly what the screenshot showed.
//
// The two weights encode what the control actually does:
//
//   PRIMARY   — solid brand fill. "Whose data am I looking at" (Main / Vishen's / Mindvalley).
//               Carries the brand colour, so Vishen's segment is teal on every surface.
//   SECONDARY — a quiet filled segment on the page's own palette. "How am I looking at it"
//               (Week / Month, Group by). It is a lens, not a subject, and it should not compete
//               with the brand control stacked above or below it.
//
// Nothing here is ever gold: gold is attention-only and belongs to one element per screen.

import Link from 'next/link';
import { cn } from '@/lib/cn';

export interface SegmentedOption<T extends string> {
  key: T;
  label: string;
  href: string;
  /** Overrides the fill for this segment when selected — used to keep VL teal. */
  tone?: 'brand' | 'vishen';
}

export function Segmented<T extends string>({
  options,
  current,
  weight = 'secondary',
  className,
}: {
  options: SegmentedOption<T>[];
  current: T;
  weight?: 'primary' | 'secondary';
  className?: string;
}) {
  return (
    <div className={cn('inline-flex overflow-hidden rounded-sm border border-border-strong', className)}>
      {options.map((o, i) => {
        const selected = o.key === current;
        return (
          <Link
            key={o.key}
            href={o.href}
            aria-current={selected ? 'page' : undefined}
            className={cn(
              'px-3.5 py-1.5 text-[12.5px] transition-colors',
              i > 0 && 'border-l border-border-default',
              selected
                ? weight === 'primary'
                  ? cn('font-semibold text-white', o.tone === 'vishen' ? 'bg-vishen' : 'bg-brand')
                  : // Secondary: a quiet fill, not an inverted one. Legible against the primary
                    // control without shouting over it.
                    'bg-bg-subtle font-semibold text-text'
                : 'bg-surface font-medium text-text-muted hover:bg-bg-subtle',
            )}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
