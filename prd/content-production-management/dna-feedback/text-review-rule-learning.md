---
title: 'Text/Metadata DNA Review + Rule Learning'
slug: 'text-review-rule-learning'
scope: feature
status: discovery
parent: content-production-management/dna-feedback.md
children: []
created: 2026-09-02
updated: 2026-09-07
resolution: 6/7
imported-from: "plans/now-lets-plan-this-reflective-thunder.md"
---

# E13.1 · Text/Metadata DNA Review + Rule Learning

> Part of [E13 · AI-Assisted DNA Feedback](../dna-feedback.md)

## Purpose

A first-pass AI review of a ticket against its asset type's DNA — before a human approver looks —
scoped to what's checkable without real video access: the brief/CTA/positioning text, the DNA
prose baseline, a learned rulebook, and a deterministic check of which deliverable dimensions are
actually attached. This is the foundation [E13.2](multimodal-video-review.md) and
[E13.3](performance-post-learning-summary.md) both build on.

It directly ports the clip engine's proven rule-learning loop (`ClipRule` +
`lib/clipping/learn.ts`) rather than inventing a new mechanism: Tier 1 turns one person's feedback
into a durable rule; Tier 2 proposes rules from aggregated signal on a schedule; both land inactive
pending human approval.

## Behavior

**Correction (2026-09-07, verified against actual code):** the `Approval` Prisma model and
`decideApproval()`/`requestApproval()` in `app/tickets/[id]/actions.ts` looked live during
planning but are **dead code** — grep confirms neither is called from any UI, and the `Approval`
table has zero rows in the live data. The real, live status-change path is
`updateTicketStatus(ticketId, newStatus)`, called from the plain `<StatusUpdater>` dropdown
(`components/tickets/StatusUpdater.tsx`) — the only caller anywhere in the app. Everything below
integrates with `updateTicketStatus()`, not the vestigial approval flow.

1. A ticket's `ticketStatus` moves to `'Review'` → a `runDnaReview()` server action fires
   automatically, best-effort (never blocks the status write itself).
2. The review composes: `AssetType.dnaRequirements`/`feedbackStandards` (prose baseline) + active
   `DnaReviewRule` rows for that asset type (learned rulebook) + the ticket's
   brief/CTA/positioning/audience + a deterministic, non-LLM check of which `Dimension`s are
   linked to the asset type vs. which deliverable fields (`final16x9`/`final9x16`/`final4x5`) are
   actually filled.
3. A structured Anthropic call produces findings, written as one `DnaReview` + several
   `DnaReviewFinding` rows, rendered in a new panel on the ticket page. Each finding is
   `info`/`suggestion`/`flag` severity. `info`/`suggestion` never block anything; `flag` gates the
   transition to `'Approved'` — see the decision lock below.
4. An editor can react (thumbs up/down + note) to any finding — this is the learning signal, not
   a gate action. Separately, an approver/manager/team-lead-of-that-asset-type can **dismiss** a
   `flag` finding with a required note — this is the gate-clearing action (see Rules & Logic).
5. Both reactions feed rule distillation (Tier 1): a required override note (given when someone
   moves a ticket to `'Approved'` past an undismissed flag or missing review) → a rule saved
   `active: true` immediately (a real, forward-moving decision carries real authority); a finding
   reaction → a rule saved `active: false` pending team-lead approval (lighter-weight signal).
6. A weekly, bearer-secret-gated cron proposes up to 3 new rules per asset type from aggregated
   override-note/reaction signal (Tier 2), landed `active: false`.
7. A team lead (or manager/exec — same permission as editing the asset type's DNA text) approves
   or dismisses pending rules in Settings → Asset Types, in a new section alongside the existing
   DNA fields.
8. A manual "Re-run" button on the ticket panel re-triggers step 2-3 on demand (e.g. after a
   revision cycle).

## Rules & Logic

- **Automatic trigger stays non-blocking.** `runDnaReview()` wraps the review call in try/catch;
  a failure never prevents the ticket's `Review` status transition from completing — same
  non-blocking contract `assignTicket`/`notifyAssignment` already use in
  `app/tickets/[id]/actions.ts`. The gate below applies later, at Review→Approved, not here.

- **Decision lock — the one deliberate exception to "propose, don't act" in this entire system.**
  Every other capability in `intelligence-layer.md`, and every other part of this epic, is
  propose-only. This one gate is not, by explicit product decision: `updateTicketStatus()` may not
  set `Ticket.ticketStatus` to `'Approved'` while either condition holds, unless overridden —
  1. the latest `DnaReview` for this ticket has any `severity: 'flag'` finding with
     `reaction IS NULL` (not yet dismissed), **or**
  2. no `DnaReview` exists for the ticket's current state (the automatic trigger never completed,
     or the ticket changed since the last review ran).
  This finally wires up `GATED_STATUSES` (declared in `lib/tickets/constants.ts`, enforced nowhere
  today — the sole existing entry is `'Shipping'`, itself unenforced; this feature is what actually
  builds the enforcement, and adds `'Approved'` alongside it) and is the first real implementation
  of the decision-lock mechanism the original product PRD scoped in its Phase 1 boundaries
  ("approval stage blocks next state transition") but never built. `info`/`suggestion` severity
  never gates anything, and no other transition (e.g. `'In Revision'`, which moves the ticket
  backward) is gated — only forward movement into `'Approved'`. `updateTicketStatus()` gains one
  new optional parameter, `overrideNote?: string`, used only by the two override paths below.
- **Dismissal is the override, not a bypass.** A `flag` finding is cleared by setting
  `DnaReviewFinding.reaction = 'dismissed'` with a required `reactionNote` — a third value on the
  same field used for the Tier-1 learning signal (`'helpful'`/`'not_helpful'`), gated to
  `isManager || isFounder(roles) || teamLeadOfThatAssetType` (never the assigned editor —
  separation of duties is the entire point of a hard gate). A missing review is cleared the same
  way, at the point of the status change itself: `updateTicketStatus(ticketId, 'Approved',
  overrideNote)` requires a non-empty `overrideNote` when no completed `DnaReview` exists — one
  new optional parameter on the one real call path, not a second field on a dead table.
- **Fail-closed, not fail-open, on a missing review.** An AI-pipeline outage must never silently
  look identical to "DNA was checked and passed" — that is a worse failure than having no gate at
  all, because it appears to work when it doesn't. So absence of a completed review blocks by
  default; the override above keeps a genuine outage a one-click, one-note fix rather than a
  launch-blocking crisis, rather than solving it by quietly letting reviews-that-never-ran count as
  passed.
- **Honesty about scope.** Until E13.2 ships, `DnaReview.usedFrames` is always `false` and no
  finding cites a frame — findings are limited to brief/DNA-text/deliverable-completeness. The
  panel states this explicitly rather than implying visual judgment it can't back up.
- **Schema size discipline.** The Tier-2 proposal schema must stay flat and capped (`maxItems: 3`,
  one level of nesting) — this repo already broke prod for 2 weeks on a "grammar too large"
  structured-output error from exactly this kind of schema growth in the clip engine
  (`lib/clipping/schema.ts`); this feature must not repeat it.
- **Rule approval permission** = `isManager || isFounder(roles) || teamLeadOfThatAssetType` —
  reuses the exact computation already in `app/settings/asset-types/page.tsx`, extended with
  `isFounder()` (the same Executive/CEO check Studio access already uses) rather than a new scheme.

## Data

Three new Postgres-native models — `DnaReviewRule`, `DnaReview`, `DnaReviewFinding` — defined in
full in the [Technical Design](technical-design.md) doc, since E13.2 and E13.3 both extend the same
schema rather than owning separate tables. This feature is the one that introduces them (one
additive Prisma migration) and is the primary writer of `DnaReview`/`DnaReviewFinding` and the
approval-flow writer of `DnaReviewRule`.

Of the three pre-existing "DNA" concepts in this codebase (orphaned `Dna` model,
`AssetType.dnaRequirements`/`feedbackStandards`, and `lib/auto-editing/dna.ts`'s `DnaRecord`), this
feature only reads `AssetType.dnaRequirements`/`feedbackStandards` — see the Technical Design doc
for why the other two are left alone.

**No new schema for the decision lock.** `DnaReviewFinding.reaction` gains a third valid value,
`'dismissed'` (alongside `'helpful'`/`'not_helpful'`), with `reactionNote`/`reactedBy`/`reactedAt`
already fitting the dismissal-with-note requirement. The gate itself is a query inside
`updateTicketStatus()`, not a new table: does the ticket's latest `DnaReview` have any
`severity: 'flag'` finding with `reaction IS NULL`, and does a `DnaReview` exist at all for the
ticket's current state. The override note itself is passed as a parameter and persisted as a
`TicketEvent.note` on the status-change event (the existing audit-trail model for ticket state
changes), not a new field.

## Failure Modes

**Review never completes (Anthropic call fails, times out, or the automatic trigger never fires):**
resolved by design, not left to guesswork — see the decision lock in Rules & Logic. No completed
`DnaReview` for the ticket's current state blocks Review→Approved by default (fail-closed); an
approver can still move forward by providing a required note on the approval decision itself,
which is the audit trail for "we approved this without a completed AI check, and here's why." The
ticket page should surface this state visibly (e.g. "DNA review pending/failed — retry") rather
than presenting an unexplained block.

[UNRESOLVED] Still open: whether the automatic trigger retries on its own (e.g. one automatic
retry before giving up and requiring the manual "Re-run" button), and what happens if the trigger
fires twice in quick succession on a status-flapping ticket (should be idempotent — a second
`DnaReview` shouldn't orphan the first — but the exact dedupe rule isn't specified). Worth defining
once the first real failures are observed rather than guessing categories in advance — same
approach E12.2 took for its own render failures.

## Acceptance Criteria

- Moving a real ticket to `Review` status creates a `DnaReview` + `DnaReviewFinding` rows, and the
  panel renders on the ticket page.
- The deterministic deliverable-completeness check correctly flags a missing dimension on a test
  ticket with an incomplete asset type — with no model call involved.
- Providing an override note when moving a ticket to `'Approved'` past a blocked gate results in a
  rule landing `active: true`; reacting to a finding results in a rule landing `active: false`
  pending team-lead approval.
- `updateTicketStatus(ticketId, 'Approved')` refuses while an undismissed `flag` finding exists on
  the ticket's latest `DnaReview`, or while no `DnaReview` exists for the ticket's current state —
  verified by attempting the transition in both states and confirming it's rejected.
- An approver/manager/team-lead can dismiss a `flag` finding with a note, after which the same
  transition succeeds; an assigned editor cannot dismiss a finding on their own ticket (permission
  check rejects it).
- Moving to `'Approved'` with no completed review succeeds only when a non-empty `overrideNote` is
  passed to `updateTicketStatus()` — confirmed by attempting it with no note and confirming
  rejection.
- Moving to `'In Revision'` (backward) is never blocked by an undismissed flag or a missing
  review — the gate only applies to forward movement into `'Approved'`.
- The Tier-2 cron endpoint rejects requests without the bearer token, and produces ≤3 proposed
  rules per run from seeded `Approval`/reaction signal.
- `npm run build` and `npm run lint` stay clean; no existing ticket/approval/asset-type flow
  changes behavior — every addition here is additive and non-blocking.

## Open Questions

- ~~**Notification hook.**~~ Resolved during discovery (2026-09-07, see the epic's User Stories):
  a blocked `flag` finding DMs the approver via Slack (same pattern as E12.4's drift alerts,
  `lib/notify/slack.ts`), with the actual dismiss/approve action still happening on the desktop
  portal — no mobile approval flow.
- **Cost control on the automatic trigger.** The call is cheap (text-only), but there's no existing
  per-ticket-per-day rerun cap in this codebase for an automatic (not button-gated) LLM trigger.
  Worth adding if repeated status-flapping on a ticket becomes a real cost pattern — not built
  pre-emptively.
