// Empty states — two tiers, nine canonical strings.
//
// Design handoff `3a` §4. The surfaces this replaces shipped ELEVEN different phrasings across
// five files for three conditions ("nothing dated", "not shown here — see the tray", "no message
// committed", "No message committed", "goal not set", "no goal", "not filled", "No post",
// "Nothing scheduled", "no email day", "not set"). That is a component problem showing up as a
// page problem, which is why this exists before any surface does.
//
// TIER 1 — someone owns this. A gap with a name against it. Square violet marker, and it ALWAYS
//          names who closes it. Violet-slate because everything provisional lives there
//          (staged, inferred, sample, unowned) — which is what frees red to mean `missed` alone.
// TIER 2 — this is fine. A weekend with no email is not a gap and must not look like one.
//          No marker, no owner, muted text.
//
// Never a dashed box in light mode: it reads as a component that failed to load. On dark, tier 2
// loses its surface entirely (page colour, hairline, label) — which is truer than the dashed box,
// and the reason this is a theme-aware variant rather than one component with two skins.

import { cn } from '@/lib/cn';

/** The canonical tier-1 strings. Anything else is a new condition — add it here, not inline. */
export const TIER1 = {
  nothingDated: { label: 'Nothing dated', owner: 'Live Date has no owner' },
  noMessage: { label: 'No message committed', owner: 'Ramya' },
  noGoal: { label: 'No goal set', owner: 'Ramya' },
  notFilled: { label: 'Not filled', owner: '24h read' },
  notSet: { label: 'Not set', owner: null },
} as const;

/** The canonical tier-2 strings. These are fine, not gaps. */
export const TIER2 = {
  noEmailDay: 'No email day — as planned',
  nothingScheduled: 'Nothing scheduled',
  notCrossPosted: 'Not cross-posted',
  dash: '—',
} as const;

export type Tier1Key = keyof typeof TIER1;

/**
 * A gap someone owns.
 *
 * `owner` overrides the canonical default — use it when the owner is per-record (a field owner,
 * a named editor) rather than fixed. Passing `null` suppresses the owner line, which should be
 * rare: a tier-1 gap without a name against it is just a blank.
 */
export function EmptyOwned({
  kind,
  owner,
  className,
}: {
  kind: Tier1Key;
  owner?: string | null;
  className?: string;
}) {
  const canonical = TIER1[kind];
  const who = owner === undefined ? canonical.owner : owner;
  return (
    <span className={cn('inline-flex items-baseline gap-2', className)}>
      <span
        aria-hidden
        className="mt-[5px] h-1.5 w-1.5 flex-none self-start bg-staged"
        // Square, not round: a dot means a lifecycle state on a pill. This is a gap marker.
      />
      <span className="text-[12.5px] leading-snug text-staged-content">{canonical.label}</span>
      {who ? <span className="text-xs text-text-subtle">— {who}</span> : null}
    </span>
  );
}

/**
 * A blank that is fine. No marker, no owner — it must not read as something to fix.
 *
 * Say it ONCE per boundary, not once per cell: three consecutive cells each reading
 * "nothing dated" is a rhythm failure that makes real data look like a broken fetch.
 */
export function EmptyFine({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <span className={cn('text-[12.5px] text-text-subtle', className)}>{children ?? TIER2.dash}</span>
  );
}

/**
 * The third data state the design names: **present but meaningless**.
 *
 * `test` (a message name) and `vcvdsv` (a goal) are neither filled nor empty. The value is always
 * shown and NEVER rewritten — the fix belongs upstream in Airtable — but it carries a chip so junk
 * is not mistaken for an intentional identifier. Same treatment for the `Mindalley` brand
 * misspelling and for a channel value sitting in a Priority field.
 *
 * Deliberately not monospace: mono made `vcvdsv` look like a deliberate id.
 */
export function PlaceholderValue({
  value,
  chip = 'placeholder value',
  note,
  className,
}: {
  value: string;
  chip?: string;
  note?: string;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-2', className)}>
      <span className="text-[13px] text-staged-content">{value}</span>
      <span className="rounded-sm bg-staged-soft px-2 py-0.5 text-2xs font-semibold text-staged-content">
        {chip}
      </span>
      {note ? <span className="w-full text-xs text-text-subtle">{note}</span> : null}
    </span>
  );
}
