# Prep for next Vishen meeting: Masterclass production-timeline view

## Context

On the 2026-08-31 portals call, Vishen named the single biggest thing blocking
revenue right now: **Masterclass production timeline**. Masterclasses are
taking ~20 days when he believes they should take far less, and nobody — least
of all him — can currently see stage-by-stage where the time is actually going
("that's it, that's the biggest issue in the company right now").

The good news: the data to answer this already exists. Every ticket-status
change writes a `TicketEvent` row (`fromState`, `toState`, `actorId`,
`createdAt`) — verified live in [lib/tickets/write.postgres.ts](lib/tickets/write.postgres.ts#L94-L106)
(on every status change) and [lib/tickets/write.postgres.ts:192-195](lib/tickets/write.postgres.ts#L192-L195)
(seeded at creation). [getTicketDetail](lib/tickets/data.postgres.ts#L379)
already fetches this history into a `TicketEventRow[]`. **Nothing renders it
anywhere.** [app/tickets/[id]/page.tsx:103-108](app/tickets/%5Bid%5D/page.tsx#L103-L108)
even has a stale "Lifecycle" card claiming *"Change history is tracked in the
Airtable record revision history"* — no longer true since Postgres became the
system of record (2026-07-10 cutover).

This plan builds the view that turns that dormant data into the answer to
Vishen's exact question, in time for the next meeting. It also folds in two
small non-build items raised on the same call: drafting the first-cut
video-editing-agent brief Rhythm referenced (which doesn't yet exist anywhere
in this repo — see below), and a short Composio research note.

## Two corrections to the CLAUDE.md spec, confirmed by reading the code

1. **`TicketEvent` only tracks `ticketStatus` transitions, not `prioStatus`.**
   The event-append in `updateTicket` is gated on
   `statusChanged = patch.ticketStatus !== undefined && ...` — there's no
   equivalent for `prioStatus`. That's fine here: production timeline is
   inherently the editor-owned `ticket_status` axis.
2. **The real lifecycle isn't the 8-stage list in CLAUDE.md §6**
   (`Requested → Prioritized → ... → Performance Tracked`) — that's
   aspirational copy. The live `ticket_status` enum is: `Backlog, To Do, In
   Progress, Review, In Revision, Approved, Done, Won't Do, Shipping, Request
   on Hold`. Two existing groupings already bucket these for display and
   should be reused rather than inventing a third:
   - [components/ui/FunnelCapacity.tsx:13-18](components/ui/FunnelCapacity.tsx#L13-L18) — 4 buckets: Requested / In production / In review / Published (`Won't Do` excluded).
   - `/studio`'s own pipeline section uses a different 3-bucket split (`pulseCounts` — In production / Awaiting sign-off / Ready to publish, [app/studio/page.tsx:42-46](app/studio/page.tsx#L42-L46)).
   Use the `FunnelCapacity` 4-bucket grouping for the timeline averages — it's
   the more analytical/duration-shaped one and already used for capacity math.

## Where this lives: `/studio`, not `/stakeholder`

[lib/studio/guard.ts](lib/studio/guard.ts) gates every `/studio/*` route to
founders/admins + a named allowlist that explicitly includes Vishen. `/studio`
is his actual home page (`homeRouteForRoles` sends Executive/CEO there) and
already has a **"Your pipeline, stage by stage"** section
([app/studio/page.tsx:48-56](app/studio/page.tsx#L48-L56)). `/stakeholder` is
the broader shared read-only surface for agencies/stakeholders generally —
not CEO-specific. Build the new aggregate view as `/studio/timeline`, and add
a `st-seeall`-style link into it from the existing pipeline section header
(same pattern already used for the "Launches"/"Delivered" sections there).

## Implementation

**1. New pure logic — `lib/tickets/timeline.ts`** (new file, no new queries):
- `buildStageHistory(createdAt, events: TicketEventRow[]): StageSpan[]` — walks
  the already-ordered events pairwise into spans
  `{ status, enteredAt, exitedAt, days, actor, note }`, with the last span
  open (`exitedAt: null`) if the ticket is still in that state. The creation
  event (`toState`, note `'created'`) anchors span 0, so no fallback to
  `ticket.createdAt` should be needed except for pre-audit-trail legacy rows
  with zero events — spot-check a few old tickets during verification
  (see below) rather than assuming.
- `summarizeTimelines(rows): TimelineSummary` — aggregates:
  - avg total days Requested→Published over **completed** tickets
    (`ticketStatus in ('Done','Shipping')`, matching `FunnelCapacity`'s
    delivered bucket),
  - avg days per `FunnelCapacity` bucket over completed tickets,
  - in-flight tickets sorted by `daysInCurrentStage` descending (the
    bottleneck list).
- Plain elapsed wall-clock math (ms / 86400000), no business-day/timezone
  adjustment. **Flag this explicitly in the demo** — if leadership expects
  "working days" the numbers will read differently for anything spanning a
  weekend.

**2. Extend `lib/tickets/data.postgres.ts`** with
`getTicketTimelines(opts: { eventType?: string }): Promise<TicketTimelineRow[]>`
— one `prisma.ticket.findMany` joining `events` (already the same include
shape as `getTicketDetail`), excluding `Won't Do`, bounded the way
`ManagerInsights` already avoids scanning the full ~9k `Done` history (cap
completed tickets to a recent window, e.g. last 90 days; include all
non-terminal tickets unconditionally since that's the live queue and
inherently bounded). Add a matching stub returning `[]` in
`lib/tickets/data.airtable.ts` (consistent with how `events: []` is already
stubbed there) and export through the `lib/tickets/data.ts` dispatcher — keep
the existing backend-switch contract intact.

**3. Add `createdAt` to `TicketDetail`** ([lib/tickets/data.postgres.ts:309-356](lib/tickets/data.postgres.ts#L309-L356))
— the value is already computed locally (`t.createdAt.toISOString()`, line
387) for asset timestamps but isn't exposed on the interface. One-line
addition.

**4. New component — `components/tickets/StageHistory.tsx`** — renders a
`StageSpan[]` as a simple vertical list: status pill (reuse the existing
ticket-status badge component), duration ("3.2 days" / open spans marked
"current — 4 days and counting"), reusing the `card pad` / `subtle` classes
already used on these same detail pages — no new CSS, no raw colors.

**5. Wire `StageHistory` into ticket detail pages:**
- [app/tickets/[id]/page.tsx:103-108](app/tickets/%5Bid%5D/page.tsx#L103-L108) — **replace** the stale "Lifecycle" card (wrong Airtable-history claim) with `<StageHistory createdAt={t.createdAt} events={t.events} />`.
- [app/stakeholder/[id]/page.tsx](app/stakeholder/%5Bid%5D/page.tsx) — add the same card to the right-hand stack.

**6. New page — `app/studio/timeline/page.tsx`**:
- `await requireStudioAccess()` (same gate as every other `/studio/*` page).
- `getTicketTimelines({ eventType: pick('eventType') })` +
  `summarizeTimelines(...)`, server-rendered — reuse the exact
  `?eventType=` querystring pattern [app/studio/launches/page.tsx](app/studio/launches/page.tsx)
  already uses for its `initialFilters`.
- Layout with existing primitives only: `Kpi`/`KpiGrid` for the headline
  numbers (avg Requested→Published, # in flight), `MetricCard`/`MetricGrid`
  for the 4 per-stage averages, and a "most delayed" list styled like the
  existing `RiskList` pattern in `app/performance/capacity/page.tsx` (linking
  each row to `/tickets/[id]`).
- Filter to "Masterclass" via `?eventType=Masterclass` for the actual demo.

**7. Link into it from `/studio`** — add a `st-seeall`-style "See where time
is going →" link in the pipeline section header
([app/studio/page.tsx:50-54](app/studio/page.tsx#L50-L54)), matching the
existing "See all →" links used for Launches/Shipped.

### Open questions to flag before/during the demo, not to silently assume
- **"Completed" definition** — proposing `Done` or `Shipping`; confirm
  `Shipping` (in transit to publish) should count.
- **Bounce-backs** — a ticket that loops `Review → In Revision → Review →
  Approved` will sum both `In Revision` spans into the per-stage average
  (more honest about where time is lost, but can make that stage look worse
  than a first-pass-only count would).
- **Legacy/backfilled tickets** — `lib/airtable/migrate.ts` backfilled
  `TicketEvent` rows during the Postgres cutover; spot-check a handful of old
  tickets to confirm those backfilled timestamps are plausible and
  monotonically increasing before trusting the aggregate in front of the CEO.

## Also before the next meeting (non-build items from the same call)

- **First-cut video agent MD**: Rhythm told Vishen a plan/MD file for a
  first-cut agent (YouTube ID or Dropbox link → ~20 rated reel candidates →
  edit recommendations → editor fine-tune, via a Premiere Pro plugin, shared
  with Gareth, reviewed by Titus) already exists. It doesn't — confirmed
  nothing like it exists anywhere in this repo's `plans/`, `prd/`, or git
  history. Draft this MD (separate from this build plan; it's a
  content/spec-writing task, not a code change) before the next meeting so
  the claim is backed by something real. The closest existing reference to
  build from is the shipped AI Content Clipping Engine
  ([prd/content-production-management/content-clipping-engine.md](prd/content-production-management/content-clipping-engine.md)),
  which already does transcript → scored clips, just not the ~20-candidate/
  Premiere-plugin/first-cut-render flow described to Vishen.
- **Composio research spike**: Vishen wants the video/funnel-monitoring agents
  to reach beyond this app's own data — e.g. read Instagram/LinkedIn directly
  via [Composio](https://composio.dev) to auto-surface "this hook is working
  best" style learnings. No build decision should be made yet; just a short
  written note on what Composio would actually add on top of the existing
  Hootsuite Perch MCP connection already powering the performance loop (per
  project memory: performance data already flows in via Hootsuite Perch, no
  app-side token) — i.e. is Composio additive (new platforms/actions) or
  redundant with what's already wired.

## Verification

- `npm run build` and `npm run lint` after the code changes above.
- Load `/studio/timeline` and `/studio/timeline?eventType=Masterclass` locally
  against real data (or the dev DB) and sanity-check the numbers: do the
  bottleneck rankings and averages look plausible against what's known about
  current in-flight masterclasses?
- Open a ticket detail page (`/tickets/[id]` and `/stakeholder/[id]`) for a
  ticket that has moved through several statuses and confirm `StageHistory`
  renders a sensible, chronological span list with a correctly "open" final
  span.
- Spot-check 2-3 old (pre-2026-07-10 migration) tickets specifically for
  plausible backfilled event timestamps, per the open question above.
