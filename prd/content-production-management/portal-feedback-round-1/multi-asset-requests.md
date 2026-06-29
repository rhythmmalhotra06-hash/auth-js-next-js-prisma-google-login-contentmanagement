---
title: 'Multi-asset campaign requests'
slug: 'multi-asset-requests'
scope: feature
status: deferred
parent: content-production-management/portal-feedback-round-1.md
children: []
created: 2026-06-29
updated: 2026-06-29
resolution: 4/7
---

# E9.8 · Multi-asset campaign requests

> Part of [Portal Feedback / Usability Round 1](../portal-feedback-round-1.md)

> **DEFERRED (Jun 29):** Multi-ticket creation from one request will be tackled as a **separate later effort**, not part of E9. Captured here for continuity; do not build in this round. The remaining open questions stay open until it's picked up.

## Purpose

Rhythm noted Glenn's friction: "Glenn came back saying oh we can't do form creation, or maybe for a campaign we have multi-assets." A single campaign often needs many deliverables, but intake is one-request-one-ticket today. This feature lets a requester raise one campaign request that fans out into multiple asset tickets.

## Behavior

1. Extend the creative intake ([components/intake/IntakeForm.tsx](../../../components/intake/IntakeForm.tsx)) with an "add another deliverable" affordance: multiple asset rows under one request, each with asset type + dimensions + due date, all linked to one `OfficialCalendar` and sharing the brief/CTA/positioning.
2. On submit, `createTicket` ([app/intake/actions.ts](../../../app/intake/actions.ts)) fans out into N tickets sharing campaign + brief; each is scored (E9.5) and auto-assigned (E9.6) independently.
3. The single-asset path remains the default — multi-asset is additive.

## Rules & Logic

- Each deliverable becomes its own ticket (own status, assignee, score) — they are grouped by the shared `OfficialCalendar`, not merged into one ticket.
- Each row honors the `createTicket` invariant (required taxonomy + scoring) independently.
- A partial failure (one row invalid) should not silently drop tickets — see Failure Modes.

## Data

- Reuses `Ticket` + `OfficialCalendar`; no new model. *(Whether a lightweight "request group" id is needed to relate the fanned-out tickets is an open question.)*

## Failure Modes

[UNRESOLVED] Transactional behavior when some deliverable rows succeed and others fail (all-or-nothing vs. partial-with-report), and how to surface per-row validation errors in the form.

## Acceptance Criteria

- A request with three deliverable rows creates three tickets sharing the campaign and brief.
- Each ticket is independently scored and (where unambiguous) auto-assigned.
- The single-asset flow is unchanged when only one row is present.

## Open Questions

[UNRESOLVED] Whether the fanned-out tickets need a shared "request group" identifier for later reporting/rollup; and whether multi-asset applies to shoot requests too or only creative requests in this round.
