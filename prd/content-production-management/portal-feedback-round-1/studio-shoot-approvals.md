---
title: 'Shoot approvals in Studio'
slug: 'studio-shoot-approvals'
scope: feature
status: discovery
parent: content-production-management/portal-feedback-round-1.md
children: []
created: 2026-06-29
updated: 2026-06-29
resolution: 7/7
build-status: built
build-date: 2026-06-29
build-log: .builds/studio-shoot-approvals.build.md
---

# E9.2 · Shoot approvals in Studio

> Part of [Portal Feedback / Usability Round 1](../portal-feedback-round-1.md)

## Purpose

Gareth: "I don't want to send Vision a request every time I need to shoot something… I want to send Vision a link" where all shoot requests sit and he marks yes/no. The shoot approval data model already exists (Filming Status + "Vishen's Approval" checkbox), but approval lives only on the `/shoots` board. This feature surfaces shoots awaiting sign-off inside Vision's one studio view so he approves/kills them there, replacing WhatsApp.

## Behavior

1. A new **"Shoots awaiting your sign-off"** section on [app/studio/page.tsx](../../../app/studio/page.tsx), listing shoots with Filming Status = `New Requests - Needs Vishen's Review`, each showing title, format, requested-by, filming date, brief.
2. Per-row actions **Approve** and **Decline**, wired to `approveShoot(id)` / `declineShoot(id)` in [app/studio/actions.ts](../../../app/studio/actions.ts).
3. `approveShoot` sets Filming Status → `New Requests - Approved by Vishen` and ticks the approval checkbox; the row leaves the pending section. `declineShoot` sets Filming Status → `Cancelled`.
4. `loadStudio()` ([lib/studio/data.ts](../../../lib/studio/data.ts)) is extended to include the pending-shoots set, reusing [lib/shoots/repository.ts](../../../lib/shoots/repository.ts) (no extra round-trips beyond one list call).

## Rules & Logic

- **Propose-only:** a shoot moves forward only on an explicit founder tap (Approve/Decline) — no auto-approval.
- Access gated by `requireStudioAccess()` ([lib/studio/guard.ts](../../../lib/studio/guard.ts)) — Executive/CEO or Admin only.
- Approving flips both the singleSelect Filming Status (`fldfz4B7S765leTIT`) and the checkbox (`fldhqZbEmxjEK703f`) so the existing `/shoots` board and any downstream filters stay consistent.

## Data

- Shoots table: Filming Status `fldfz4B7S765leTIT`, Vishen's Approval `fldhqZbEmxjEK703f` (existing, in `field-map.ts`).
- No new fields.

## Failure Modes

- **Airtable write fails** → surface an inline error on the action; do not optimistically remove the row.
- **Shoot already approved by someone else** (board vs studio race) → re-read on action; if status already advanced, no-op with a notice.

## Acceptance Criteria

- A shoot with status "Needs Vishen's Review" appears in the studio section.
- Approve flips Airtable to "Approved by Vishen" + checkbox, and the row leaves the pending list.
- Decline sets the shoot to Cancelled.
- Non-founder users never see the section (guarded).

## Open Questions

**Resolved (Jun 29):** Decline accepts an **optional note** (not required) and sets Filming Status → `Cancelled`; the note appends to the shoot's notes when present, mirroring the sign-off "send back" pattern but without forcing a reason.
