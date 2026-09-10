// The not-dated tray — artboard `6b`.
//
// The counts are the argument, so they come first and the list is evidence beneath them. The
// published count carries the amber rule because it is the only one that is actively costing
// something: work that is live, undated, and therefore invisible to every calendar view.
//
// THE ONE GOLD ELEMENT on this page is "Live Date has no owner". Assigning that field is the
// single change that empties this tray and fills the calendar — so it gets the page's attention
// colour, and nothing else does.

import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyFine } from '@/components/ui/Empty';
import { cn } from '@/lib/cn';
import type { NotDatedTray as Tray, TrayGrouping } from '@/lib/comms-calendar/not-dated';

const GROUPINGS: { key: TrayGrouping; label: string }[] = [
  { key: 'source', label: 'Source' },
  { key: 'status', label: 'Status' },
  { key: 'channel', label: 'Channel' },
];

function Count({
  value,
  label,
  amber = false,
}: {
  value: number;
  label: React.ReactNode;
  amber?: boolean;
}) {
  return (
    <div className={cn('flex gap-3 pl-3', amber ? 'border-l-2 border-l-warning' : 'border-l-2 border-l-border-default')}>
      <span
        className={cn(
          'font-display text-[29px] font-bold leading-none tracking-[-.02em] tabular-nums',
          amber ? 'text-warning-content' : 'text-text',
        )}
      >
        {value}
      </span>
      <span className="max-w-[220px] pt-0.5 text-xs leading-snug text-text-muted">{label}</span>
    </div>
  );
}

export function NotDatedTray({ tray, hrefFor }: { tray: Tray; hrefFor: (g: TrayGrouping) => string }) {
  const { counts } = tray;

  return (
    <div className="flex flex-col gap-[22px]">
      {/* ── The counts. The argument, before the evidence. ─────────────────── */}
      <div className="flex flex-wrap gap-x-10 gap-y-5 rounded-md border border-border-default bg-surface p-[18px]">
        <Count
          value={counts.undated}
          label={<>of {counts.laneTotal} Vishen-lane assets have no Live Date</>}
        />
        <Count
          amber
          value={counts.published}
          label={<><span className="font-semibold text-warning-content">are already published</span> — live work the calendar cannot show</>}
        />
        <Count value={counts.inFlight} label="still in production, not yet scheduled" />
        {counts.retired > 0 ? (
          <Count
            value={counts.retired}
            label="rejected or parked — correctly undated, not a backlog"
          />
        ) : null}
      </div>

      {/* ── THE gold element: the field with no owner. ─────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border-2 border-gold bg-surface px-4 py-3.5">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4 flex-none text-gold-content">
          <rect x="2.5" y="4" width="15" height="13" rx="1.6" /><path d="M2.5 8h15M7 2.5v3M13 2.5v3" />
        </svg>
        <span className="text-[13.5px] font-semibold text-gold-content">Live Date has no owner</span>
        <span className="min-w-0 flex-1 text-xs text-text-muted">
          One person filling this field empties this tray and fills the calendar. It is the single
          highest-leverage change in the whole system, and it is nobody&rsquo;s job today.
        </span>
      </div>

      {/* Two gaps stacked on the same records — worth saying once, plainly. */}
      {counts.published > 0 ? (
        <p className="max-w-prose text-xs leading-relaxed text-text-muted">
          Of the {counts.published} published-but-undated,{' '}
          <span className="font-semibold text-text">only {tray.publishedWithLink} carry a published link</span>.
          So for most of them the calendar cannot place the work and nobody can reach it either.
        </p>
      ) : null}

      {/* ── Grouping ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">Group by</span>
        <Segmented
          current={tray.grouping}
          options={GROUPINGS.map((g) => ({ key: g.key, label: g.label, href: hrefFor(g.key) }))}
        />
        <span className="text-2xs text-text-subtle">
          published first — those are losing attribution every day they sit here
        </span>
      </div>

      {/* ── The list ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {tray.groups.map((g) => (
          <div key={g.key} className="overflow-hidden rounded-md border border-border-default bg-surface">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-default bg-bg-subtle px-4 py-[11px]">
              <span className="text-sm font-bold tracking-[-.01em]">
                {/* The fallback names the field being grouped on — saying "No source recorded"
                    while grouped by channel is just wrong. */}
                {g.key === '(not set)' ? `No ${tray.grouping} recorded` : g.key}
              </span>
              {g.published > 0 ? (
                <Badge tone="warning">{g.published} already published</Badge>
              ) : null}
              <span className="ml-auto text-2xs tabular-nums text-text-subtle">
                {g.total} {g.total === 1 ? 'asset' : 'assets'}
              </span>
            </div>

            <div className="flex flex-col">
              {g.assets.map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    'flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border-default px-4 py-2.5 last:border-b-0',
                    // The left edge carries state and nothing else: live-but-undated is the
                    // condition this page exists for.
                    'border-l-2',
                    a.published ? 'border-l-warning' : 'border-l-transparent',
                  )}
                >
                  <Link
                    href={`/studio/comms-calendar/asset/${a.id}`}
                    className="min-w-0 flex-1 text-[13px] leading-snug text-pretty hover:underline"
                  >
                    {a.title}
                  </Link>

                  {a.status ? (
                    <Badge tone={a.published ? 'warning' : 'neutral'} dot={false}>{a.status}</Badge>
                  ) : (
                    <EmptyFine>no status</EmptyFine>
                  )}

                  <span className="w-[150px] flex-none text-right text-2xs">
                    {a.publishedUrl ? (
                      <a href={a.publishedUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                        published link ↗
                      </a>
                    ) : a.published ? (
                      <span className="text-warning-content">no link recorded</span>
                    ) : (
                      <EmptyFine>&mdash;</EmptyFine>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
