---
prd: 'content-production-management/portal-feedback-round-1/team-campaign-visibility.md'
feature: 'E9.3 · Team + campaign visibility'
started: 2026-06-29
completed: 2026-06-29
status: completed
current_step: 4
total_steps: 4
---

# Build Log: E9.3 · Team + campaign visibility

## Approved Plan

Add My requests / My team / Campaign / All scopes to the stakeholder requests view,
plus a campaign column + filter on QueueTable (D2). Additive; locked first-5 untouched.

- **Step 1** — `lib/tickets/data.ts`: add `officialCalendarId` + `officialCalendar` to `QueueTicket`, QUEUE_FIELDS, mapTicketRow; resolve name via `nameMap('officialCalendars')`.
- **Step 2** — `getRequestsForScope(employee, scope, {calendarId})` (mine/team/campaign/all).
- **Step 3** — `components/tickets/ScopeSwitch.tsx` (new) + `app/stakeholder/page.tsx` wiring (searchParams, canViewAll from roles).
- **Step 4** — `components/tickets/QueueTable.tsx`: campaign optional column + filter.

team is single-valued → "My team" = the user's team. Verify: lint + build + manual.

## Progress

- [x] Step 1: Ticket model — add campaign
- [x] Step 2: getRequestsForScope
- [x] Step 3: ScopeSwitch UI + page wiring
- [x] Step 4: QueueTable campaign column + filter

## Result

Files created: 1 (`components/tickets/ScopeSwitch.tsx`)
Files modified: 3 (`lib/tickets/data.ts`, `app/stakeholder/page.tsx`, `components/tickets/QueueTable.tsx`)
Verification: `npm run lint` clean (only pre-existing `_drop` warnings), `npm run build` passes.
Note: also delivered D2 (campaign optional column + "All campaigns" filter) on QueueTable.
