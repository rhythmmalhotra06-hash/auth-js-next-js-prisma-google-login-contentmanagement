# Stakeholder page → open "My requests" for everyone, clickable KPIs, assignee filter

## Context

The `/stakeholder` page ("My requests") is currently **scoped and gated**: it defaults to
only the requests *you* raised, and a `ScopeSwitch` (mine / team / campaign / all) widens the
view — but the "all" scope is locked to managers/approvers/admins ([app/stakeholder/page.tsx:44-47](app/stakeholder/page.tsx#L44-L47)).
The three KPI cards (Open requests / In production / Delivered) are **static** display boxes,
and there is **no way to filter by the assigned creative/editor**.

The user wants this surface to be a simple, shared "My requests" view:
1. **Everyone sees all requests** — no per-user scoping, no role gate. (Default load = all active
   requests + recently shipped; a filter option can pull the full delivered archive on demand.)
2. The **Open requests / In production / Delivered KPI cards become clickable** and auto-filter
   the list to that lifecycle stage.
3. A new **assignee filter** (assigned creative / editor) so people can filter the list by who's
   working on it.

## Approach

### 1. Page: drop scoping/gating, show all to everyone — [app/stakeholder/page.tsx](app/stakeholder/page.tsx)

- Remove `ScopeSwitch`, `getAdminAccess`, `hasRole`, `getRequestsForScope`, `RequestScope`,
  `parseScope`, `SCOPE_HEADING`, and the employee-match gate.
- Default data fetch = **all active requests + recently shipped**, deduped by id:
  merge `getQueueTickets()` with `getRecentShipped(50)` (both already exist in
  [lib/tickets/data.ts](lib/tickets/data.ts) — active-only and newest-Done respectively; their
  status sets are disjoint so a simple id-dedupe is enough).
- Support an optional `?archive=1` search param → fetch `getQueueTickets({ includeCompleted: true })`
  instead, so users can pull the full delivered/Done history on demand (this is the "find tickets
  in other statuses" escape hatch). `includeCompleted` is already wired in `getQueueTickets`.
- Replace the scope-switch + KPI grid + QueueTable block with a single client wrapper
  (`StakeholderRequests`, below) that owns the clickable KPIs and passes data to the table.
- Update `AppShell` title/subtitle copy to reflect "every request across the team" (drop the
  "switch scope" language). Keep the read-only/comment-access legend and the empty state.

### 2. New client wrapper — `components/tickets/StakeholderRequests.tsx`

A `'use client'` component that holds the clickable KPIs + the table (KPIs must control the
table's filter, so they share client state):
- Props: `{ tickets: QueueTicket[]; scoringConfig; archive: boolean }`.
- Local state `stage: StageKey | null` (`'open' | 'prod' | 'delivered'`).
- Compute the three counts from the **full** `tickets` list (not the filtered set) using the
  shared stage predicates (below).
- Render `KpiGrid` with three `Kpi`s, each `onClick` toggling its stage (click again to clear),
  and `active` when selected.
- Render `<QueueTable tickets stageFilter={stage} scoringConfig basePath="/stakeholder"
  storageKey="stakeholder-queue" />`.
- When `stage === 'delivered'` and `!archive`, show a subtle
  `Load full delivered history →` link to `/stakeholder?archive=1` (reuse `.legend`/`subtle`
  styling — no new CSS).

### 3. Make `Kpi` clickable — [components/ui/Kpi.tsx](components/ui/Kpi.tsx)

Add optional `onClick?: () => void` and `active?: boolean` props. When `onClick` is present,
render the card as a `<button className="kpi ...">` (add `active` class when selected) so it's
keyboard-accessible; otherwise keep the current `<div>`. Reuse the existing `.kpi` class; add a
minimal `.kpi.active`/hover affordance in [app/globals.css](app/globals.css) if the token set
doesn't already give a visible pressed state.

### 4. Stage filter + assignee filter in the shared table — [components/tickets/QueueTable.tsx](components/tickets/QueueTable.tsx)

**Stage filter (drives the KPI clicks):**
- Export `type StageKey = 'open' | 'prod' | 'delivered'` and a `STAGE_MATCH` map of predicates
  (mirrors the page's current `DONE`/`IN_PROD`: `delivered` = Done/Shipping, `prod` = In
  Progress/In Revision/Review/Approved, `open` = not delivered). The wrapper imports these so
  counts and filtering agree.
- Add prop `stageFilter?: StageKey`. Apply it as an extra AND in the `filtered` memo
  ([QueueTable.tsx:120-126](components/tickets/QueueTable.tsx#L120-L126)). Other views omit the
  prop → no behavior change.

**Assignee filter (requirement 3):**
- Add `'assignee'` to the `Dim` type ([QueueTable.tsx:25](components/tickets/QueueTable.tsx#L25)),
  to `EMPTY_SEL`, and to the `FILTERS` array as `{ key: 'assignee', label: 'All assignees' }`.
- This is the *minimal* change: `assignee` is already a `string | null` field on `QueueTicket`,
  and the existing faceted-filter machinery (`uniq`, `options`, `filtered`, the `SearchableSelect`
  render loop at [QueueTable.tsx:237-242](components/tickets/QueueTable.tsx#L237-L242)) works over
  any `Dim` key that maps to a string field — so the dropdown, faceting, and clear-all all work
  for free with no new UI code. The dropdown lists every assignee name present in the loaded set.

### Why the assignee filter reuses `Dim` instead of `EmployeePicker`

`EmployeePicker` ([components/tickets/EmployeePicker.tsx](components/tickets/EmployeePicker.tsx))
re-fetches server-side via `?assignee=<id>` and is right for the editor page. Here the full set is
already loaded client-side, so a faceted `Dim` dropdown filters instantly with zero extra fetch or
plumbing — the simpler, consistent choice.

## Files touched

- [app/stakeholder/page.tsx](app/stakeholder/page.tsx) — remove scope/gate, new data fetch, use wrapper
- [components/tickets/StakeholderRequests.tsx](components/tickets/StakeholderRequests.tsx) — **new** client wrapper (clickable KPIs)
- [components/ui/Kpi.tsx](components/ui/Kpi.tsx) — optional `onClick`/`active`, render as button
- [components/tickets/QueueTable.tsx](components/tickets/QueueTable.tsx) — `stageFilter` prop + `assignee` faceted filter
- [app/globals.css](app/globals.css) — `.kpi.active` affordance only if needed (per DESIGN_SYSTEM.md, no raw hex / arbitrary sizes — use `--mv-*` tokens)

`ScopeSwitch` becomes unused on this page; leave the component in place (it's harmless) unless a
follow-up cleanup is requested.

## Verification

1. `npm run lint` and `npm run build` — no type errors from the new `Dim`/`StageKey`/`Kpi` props.
2. `npm run dev`, open `/stakeholder`:
   - Confirm the scope tabs are gone and the list shows **all** active requests + recently shipped
     for the logged-in user regardless of role (test with a non-manager account if available).
   - Click **Open requests / In production / Delivered** cards → the list filters to that stage;
     clicking the active card again clears it. Counts on the cards reflect the full set.
   - Use the new **All assignees** dropdown → list filters to that person; combines with the
     stage filter and the existing status chips; **Clear** resets everything.
   - With **Delivered** selected, click **Load full delivered history →** → page reloads with
     `?archive=1` and the older Done tickets appear.
3. Confirm the editor and manager pages still render (shared `QueueTable` unchanged in behavior
   when `stageFilter` is omitted).
