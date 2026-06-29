---
title: 'Team + campaign visibility'
slug: 'team-campaign-visibility'
scope: feature
status: discovery
parent: content-production-management/portal-feedback-round-1.md
children: []
created: 2026-06-29
updated: 2026-06-29
resolution: 7/7
build-status: built
build-date: 2026-06-29
build-log: .builds/team-campaign-visibility.build.md
---

# E9.3 · Team + campaign visibility

> Part of [Portal Feedback / Usability Round 1](../portal-feedback-round-1.md)

## Purpose

Glenn: "Can it be a team thing? Because I'll need to see what Vidura is also doing." Monique: "Rama might want to see what is all raised for this campaign from everyone… we don't necessarily need to gate-keep who raised what." The requests view today shows only the signed-in user's requests (`getMyRequests` filters by requesterId). This feature adds Team and Campaign scopes without fully ungating.

## Behavior

1. A scope switch on [app/stakeholder/page.tsx](../../../app/stakeholder/page.tsx): **`My requests | My team ▾ | Campaign ▾`** (default `My requests`), plus an **`All`** scope visible only to managers/admins.
2. A new `getRequestsForScope(employee, scope)` in [lib/tickets/data.ts](../../../lib/tickets/data.ts):
   - **My requests** — existing `getMyRequests` behavior (by requesterId).
   - **My team** — the user **picks one of their teams** from a dropdown (when they belong to more than one `Employee.team` value); shows tickets whose requester is a member of that selected team.
   - **Campaign** — tickets linked to a chosen `OfficialCalendar` (`officialCalendarId`), via a campaign dropdown.
   - **All** — every request, no requester/team filter; rendered only when the user has a Manager/Approver/Admin role.
3. The 5-column [components/tickets/QueueTable.tsx](../../../components/tickets/QueueTable.tsx) renders the scoped rows unchanged.

## Rules & Logic

- Default remains **My requests** — the change is opt-in, preserving the rollout-safe individual default.
- Team membership is derived from `Employee.team` (Airtable "Creative Team", multi-value). When a user belongs to multiple teams they **pick which one** to view; a user with no team sees the "My team" option disabled with a hint.
- The **All** scope is gated to Manager/Approver/Admin roles ([lib/roles.ts](../../../lib/roles.ts)); other users never see it. (The full cross-team queue still also lives in `/manager`.)
- Campaign scope is independent of requester — it shows everything for the campaign regardless of who raised it (the explicit non-gate-keeping ask).

## Data

- `Employee.team` (existing), `Ticket.officialCalendarId` + `OfficialCalendar` (existing). No new fields.

## Failure Modes

- **User has no team** → "My team" shows an empty state, not an error.
- **Campaign with no tickets** → empty state.
- Large result sets respect the existing 1000-record cap; note truncation if hit.

## Acceptance Criteria

- Glenn switches to "My team" and sees Vidura's requests (same team).
- Rama picks a campaign and sees all tickets for it across requesters.
- Default load is still "My requests."

## Open Questions

**Resolved (Jun 29):** "My team" lets the user **pick one of their teams** (not auto-union of all teams). Managers/Admins **do** get an "All" scope on this view in addition to `/manager`.
