// Every owner's delivered work — artboard `4a`.
//
// WHAT THIS REPLACES. The export had the worst ink-to-information ratio in the set: four separate
// tables, four repeated six-column headers, ONE data row each. Twenty-four header cells to carry
// four records. This is one table with the owner as a spanning group row — six header cells total,
// however many owners there are.
//
// A CSS grid, not a `<table>`, for the same reason the pack's day rows are: the group row spans
// every column with `grid-column: 1 / -1`, and a real table would need `<td colspan>` inside a
// `<tr>` inside a `<tbody>` — the arrangement that produced a live rendering bug when a `<div>`
// got involved. There is no `<table>` on any of these surfaces now.
//
// THE MANDATED FIVE COLUMNS (DESIGN_SYSTEM §0.3) are all here and in order — Title, Priority,
// Assigned, Ticket Status, Priority Status — because this is a ticket list. The pack's day table
// is a calendar and is exempt; this one is not.

import { Badge, TicketStatusBadge, PrioStatusBadge } from '@/components/ui/Badge';
import { EmptyOwned, EmptyFine } from '@/components/ui/Empty';
import { cn } from '@/lib/cn';
import type { OwnerGroup, WeekAssets } from '@/lib/mow/week-assets';

/** The six columns from the handoff. Title flexes; the rest are fixed so rows align across groups. */
const COLS = 'grid-cols-[minmax(0,1fr)_92px_112px_118px_122px_288px]';

const HEADERS = ['Title', 'Priority', 'Assigned', 'Ticket status', 'Priority status', 'Delivery'];

function GroupRow({ g }: { g: OwnerGroup }) {
  const unassigned = g.owner === '(unassigned)';
  return (
    <div className="col-span-full flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-default bg-bg-subtle px-3 py-[11px]">
      {unassigned ? (
        // Not a person. Naming it as one would credit a gap to somebody.
        <span className="text-sm font-bold tracking-[-.01em] text-text-muted">Nobody assigned</span>
      ) : (
        <span className="text-sm font-bold tracking-[-.01em]">{g.owner}</span>
      )}

      {g.exTeam ? (
        // The credit stands; the person has left. Stated, not silently dropped.
        <Badge tone="neutral" dot={false}>no longer on the roster</Badge>
      ) : null}

      {g.pillars.map((p) => (
        <Badge key={p} tone="neutral" dot={false}>{p}</Badge>
      ))}

      <span className="ml-auto text-2xs tabular-nums text-text-subtle">
        {g.assets.length} {g.assets.length === 1 ? 'item' : 'items'}
      </span>
    </div>
  );
}

export function AssetsTable({ week }: { week: WeekAssets }) {
  if (!week.total) {
    return (
      <div className="rounded-md border border-border-default bg-surface px-4 py-6 text-center">
        <EmptyFine>Nothing reached a delivered status this week.</EmptyFine>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className={cn('grid min-w-[1040px] overflow-hidden rounded-md border border-border-default bg-surface', COLS)}>
        {/* Six header cells. Once, not once per owner. */}
        {HEADERS.map((h) => (
          <span
            key={h}
            className="border-b border-border-default bg-surface-recessed px-3 py-2 text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle"
          >
            {h}
          </span>
        ))}

        {week.groups.map((g) => (
          <div key={g.owner} className="contents">
            <GroupRow g={g} />

            {g.assets.map((a) => (
              <div key={a.id} className="contents">
                <span className="border-b border-border-default p-3 text-[13px] leading-snug text-pretty">
                  {a.title}
                  {a.eventType ? (
                    <span className="mt-0.5 block text-2xs text-text-subtle">{a.eventType}</span>
                  ) : null}
                </span>

                {/* Priority. A missing score is a gap, never a 0 — 0 is a real priority. */}
                <span className="border-b border-border-default p-3 text-[13px] tabular-nums">
                  {a.priorityScore === null ? <EmptyFine /> : a.priorityScore.toLocaleString('en-US')}
                </span>

                <span className="border-b border-border-default p-3 text-[13px]">
                  {a.assignee ? (
                    <span className={cn(a.assigneeExTeam && 'text-text-muted')}>{a.assignee}</span>
                  ) : (
                    <EmptyOwned kind="notSet" owner="unassigned" />
                  )}
                </span>

                <span className="border-b border-border-default p-3">
                  {a.ticketStatus ? <TicketStatusBadge status={a.ticketStatus} /> : <EmptyFine />}
                </span>

                <span className="border-b border-border-default p-3">
                  {a.prioStatus ? <PrioStatusBadge status={a.prioStatus} /> : <EmptyFine />}
                </span>

                {/* Where the output actually is — the thing the stakeholder view exists to answer. */}
                <span className="border-b border-border-default p-3 text-[13px]">
                  {a.deliveryUrl ? (
                    <a
                      href={a.deliveryUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-baseline gap-1.5 text-brand hover:underline"
                    >
                      <span className="truncate">{a.deliveryLabel}</span>
                      <span aria-hidden className="flex-none text-2xs">↗</span>
                    </a>
                  ) : (
                    // U8: name the gap and its owner, so a thin row reads as an action item rather
                    // than as a broken tool.
                    <EmptyOwned kind="notSet" owner={a.assignee ? `no link recorded · ${a.assignee}` : 'no link recorded'} />
                  )}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * What the table found out about itself.
 *
 * Two of these settle open questions the design handoff raised, so they are stated on the page
 * rather than left for someone to wonder about in the meeting.
 */
export function AssetsFootnotes({ week }: { week: WeekAssets }) {
  const stuck = week.prioStatusSpread.find((p) => p.value === 'New Request');

  return (
    <div className="flex flex-col gap-2 text-2xs leading-relaxed text-text-subtle">
      <p>
        <span className="font-semibold text-text-muted">&ldquo;Delivered&rdquo; is approximate.</span>{' '}
        There is no completion timestamp in the database, so this is work in a delivered status that
        the sync last touched during the week — an edit to an older ticket can pull it in. Mirroring
        the Airtable publish date is the fix.
      </p>

      {week.missingDelivery > 0 ? (
        <p>
          <span className="font-semibold text-warning-content">
            {week.missingDelivery} of {week.total} have no delivery link recorded
          </span>{' '}
          — so the work exists and nobody can point at where it went. That is the single field that
          would make this page answer &ldquo;where is it&rdquo; as well as &ldquo;who made it&rdquo;.
        </p>
      ) : null}

      {stuck ? (
        <p>
          {/* Settles the handoff's "122px of chrome" question: the column has real variance. */}
          <span className="font-semibold text-text-muted">
            {stuck.count} shipped while Priority status still reads &ldquo;New Request&rdquo;
          </span>{' '}
          — the manager axis never moved. The design pass asked whether this column earns its width
          when it reads the same on every row; on live data it does not read the same, and the
          disagreement is the point.
        </p>
      ) : null}
    </div>
  );
}
