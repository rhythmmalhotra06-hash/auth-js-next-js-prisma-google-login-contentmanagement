---
title: 'Auto-assign by preferred editor'
slug: 'auto-assign-preferred-editor'
scope: feature
status: discovery
parent: content-production-management/portal-feedback-round-1.md
children: []
created: 2026-06-29
updated: 2026-06-29
resolution: 7/7
build-status: built
build-date: 2026-06-29
build-log: .builds/auto-assign-preferred-editor.build.md
---

# E9.6 · Auto-assign by preferred editor

> Part of [Portal Feedback / Usability Round 1](../portal-feedback-round-1.md)

## Purpose

Monique: "if a VSSL short ad is released it will already go to Marwaq, so then it doesn't even need to go through Titus — it will be auto-assigned already." Preferred editors are already synced onto asset types (`AssetTypePreferredEditor`) but never consulted at ticket creation. This feature auto-assigns the unambiguous cases, honoring the phase-1 manual-assisted principle (CLAUDE.md §5: auto-assignment covers only the ~20–30% of unambiguous cases).

## Behavior

1. On `createTicket` ([app/intake/actions.ts](../../../app/intake/actions.ts)) and on `convertClipsToTickets` ([app/media/actions.ts](../../../app/media/actions.ts)): after the asset type is known, look up its preferred editors.
2. If the asset type has **exactly one** preferred editor, set the ticket assignee to that employee and ticket status `To Do`.
3. Otherwise (zero or multiple), leave the ticket unassigned for the manager (current behavior).
4. Reuse `getEligibleAssignees` ([lib/tickets/data.ts](../../../lib/tickets/data.ts)) to resolve the employee.

## Rules & Logic

- **Single preferred editor only** — zero or multiple preferred editors is treated as ambiguous and **left to the manager** (no round-robin, no team-lead fallback in this round).
- **Capacity is not checked** — when there is exactly one preferred editor, always assign them and set status `To Do`, regardless of their current load. (Managers rebalance later; keeps the rule simple and predictable.)
- Respect active status — if the sole preferred editor is inactive, leave unassigned.
- Does not bypass the `createTicket` invariant (required taxonomy + scoring) — assignment is an added step after the ticket is built.
- On a successful auto-assign, fire the assignee DM (E9.4 `notifyEditorAssigned`).

## Data

- `AssetTypePreferredEditor` join (existing, synced). No new fields.

## Failure Modes

- **Preferred editor inactive / unresolvable** → leave unassigned, do not error.
- **Asset type changed after creation** → no retro-reassignment in v1 (manager handles).

## Acceptance Criteria

- A ticket created for an asset type with one preferred editor lands pre-assigned to that editor and appears in their `/editor` queue.
- A ticket for an asset type with zero or multiple preferred editors stays unassigned in `/manager`.
- Auto-assignment also fires on clip→ticket conversion.

## Open Questions

**Resolved (Jun 29):** **No** team-lead fallback and **no** round-robin — zero/multiple preferred editors stay unassigned for the manager. Capacity is **not** consulted; the sole preferred editor is always assigned and set to `To Do`.
