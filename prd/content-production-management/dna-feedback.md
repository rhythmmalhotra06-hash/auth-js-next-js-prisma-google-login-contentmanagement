---
title: 'AI-Assisted DNA Feedback'
slug: 'dna-feedback'
scope: epic
status: resolved
parent: content-production-management.md
children:
  - content-production-management/dna-feedback/text-review-rule-learning.md
  - content-production-management/dna-feedback/multimodal-video-review.md
  - content-production-management/dna-feedback/performance-post-learning-summary.md
  - content-production-management/dna-feedback/technical-design.md
created: 2026-09-02
updated: 2026-09-07
resolution: 7/7
imported-from: "plans/now-lets-plan-this-reflective-thunder.md"
---

# E13 · AI-Assisted DNA Feedback

> Part of [Mindvalley Content Production & Management System](../content-production-management.md)

> **Imported 2026-09-02** from an implementation plan built during a planning session, itself
> triggered by Vishen describing Mindvalley's own **BlinkLife "Recorder Review Skills"** epic
> (`mindvalley-ai/blinklife-proto`, resolved 7/7) — record a spoken review of a video, the system
> distills candidate rules from what you said, and after 2-3 reviews an auto-review mode applies
> the learned rulebook to new videos going forward. Full research trail:
> `plans/vishen-recorder-dna-review-loop.md`. Split into an epic with three features (matching the
> shape of E8 and E12) because the source plan bundles three separable workstreams — text/metadata
> review, real video access, and performance-driven learning — plus a shared data model, exactly
> the pattern that justified splitting E12. The plan was engineering-facing (file paths, Prisma
> models, verification steps); this import maps that content to product framing where it exists
> and is honest about the gaps (User Stories, business-facing Success Criteria) it doesn't cover —
> those are real, not artifacts of the import.

> **Discovery session, 2026-09-07:** the User Stories walkthrough surfaced a real product decision
> the import couldn't have had — the ticket should not be approvable while a DNA violation stands.
> Resolved as a decision lock: `flag`-severity findings gate Review→Approved specifically, with a
> required-note override (dismiss-with-note, or approve-anyway-with-a-note if no review ran) —
> fail-closed on a missing review, never fail-open, so an AI outage can't silently look identical
> to "DNA was checked and passed." This is the one deliberate exception to "propose, don't act"
> anywhere in this epic. Full reasoning in E13.1's Rules & Logic.

## Purpose

`context/intelligence-layer.md` capability #4, "AI-assisted DNA feedback," describes a first-pass
AI review of a video/design asset against editorial standards before a human looks — flagged
**Phase 2, blocked on "a multimodal review pipeline"** that didn't exist when the doc was written.
This epic closes that gap, and also wires capability #1 ("performance insight") into it — a
published post's real engagement numbers become another signal for what the DNA rulebook should
say, not just human review feedback.

The differentiator isn't the review itself — it's that the underlying **rules are learned, not
hand-authored**. Today `AssetType.dnaRequirements`/`feedbackStandards` are prose someone has to sit
down and write. This epic adds a second, learned layer on top: rules distilled from real approval
feedback, editor reactions to AI findings, and published performance, each proposed for approval
rather than silently applied — matching `intelligence-layer.md`'s "propose, don't act" guardrail
that governs all five of its capabilities.

Critically, this isn't new architecture. This codebase already runs a near-identical, working
loop for the clip engine — `ClipRule` + `lib/clipping/learn.ts` (Tier 1 feedback-distillation +
Tier 2 performance-driven proposals, `app/settings/clip-rules` approval queue). This epic
generalizes that proven pattern from "steer clip generation" to "review a ticket's asset against
its asset type's DNA," rather than reinventing BlinkLife's architecture from scratch.

## User Stories

**Titus (editor) — the finding fires, and it has teeth.** Titus finishes cutting a reel and moves
the ticket to Review. A DNA finding appears on the ticket page: "No 9x16 cut attached — DNA
requires one for this asset type" (`severity: flag`, from the deterministic deliverable-completeness
check — this doesn't need a populated rulebook to fire, so it works from day one on a brand-new
asset type). Titus can see it, but he can't clear it himself — he's not the one who decides whether
it's real. He either fixes it (attaches the missing cut) or leaves it for the approver to weigh in
on. This matters because of what happens next.

**An approver — the gate.** When the ticket comes up for approval, moving its status to
`'Approved'` refuses while that flag stands (verified against actual code, 2026-09-07: this lives
in `updateTicketStatus()`, the one real status-change path — not the `decideApproval()`/`Approval`
table, which turned out to be dead code, never called from any UI). The approver has two paths:
dismiss it with a required note ("intentionally single-format this cycle, client asked for 16x9
only") — which is the audit trail, not a bypass — or send it back to `'In Revision'`, which is
never gated (only forward movement into `'Approved'` is). If the review never completed at all
(pipeline outage, timeout), the same approver can still move it to `'Approved'`, but only by
providing a non-empty override note explaining why — the system never lets "no review ran" silently
look identical to "DNA was checked and passed."

**A team lead (or manager/exec)** periodically reviews a queue of proposed rules in Settings →
Asset Types and approves or dismisses them — the same triage pattern clip-rule proposals already
use today. Separately, and using the same permission tier, they're who's allowed to dismiss a
`flag` finding on a live ticket — never the assigned editor, since letting the person being checked
clear their own violation would make the gate decorative.

**A manager/founder** scans the Performance page and sees "what's working" cards grouped by
content attributes, with an option to promote a pattern into the DNA rulebook.

**Device/context:** desktop-only, v1 through v-whatever — this is a desktop portal end to end, no
mobile approval flow exists anywhere in this system. When a ticket is blocked on a `flag`, the
approver gets a Slack DM (same pattern as E12.4's drift alerts — DM the person, optional channel
post via `lib/notify/slack.ts`) so they don't have to be watching the ticket page to notice — but
the actual dismiss/approve action happens on the desktop portal, not from the notification. This
also resolves E13.1's previously-open "notification hook" question.

**Explicit anti-users:** the assigned editor (settled above — can't dismiss their own finding) and
Stakeholder/Agency, consistent with their read-only role everywhere else in this system — they
never see or touch the rulebook or findings at all.

**Evidence visibility, resolved:** an editor sees the same `evidence`/`rationale` an approver sees
on a finding — hiding it from the person doing the work while showing it only to the person
judging them is exactly the black-box problem that erodes trust in an AI reviewer. The distinction
is visibility vs. authority: everyone who can see the ticket sees *why* a finding fired; only the
approver tier can act on it (dismiss, or approve past a missing review).

## Workflows

**Text/metadata review (E13.1):** ticket status → `Review` fires a best-effort DNA review
automatically; findings render on the ticket page; editor/approver reactions and approval feedback
feed a Tier-1 rule-distillation call; a weekly cron proposes Tier-2 rules from aggregated signal;
a team lead approves/dismisses proposals in Settings.

**Real video access (E13.2):** an explicit, opt-in "Review with visuals" action (not automatic —
cost/latency reasons) triggers frame extraction + transcription, producing timestamp-anchored
findings the text-only path can't (visual composition, on-screen text, cut timing).

**Performance-driven learning (E13.3):** published-post metrics get auto-matched to tickets by
URL, grouped by content attributes once enough samples exist, and surfaced as a summary panel on
the Performance page with a one-click path into the same DNA rulebook proposal queue.

All three converge on one shared review record (`DnaReview`/`DnaReviewFinding`) and one shared
rulebook (`DnaReviewRule`) — see the [Technical Design](dna-feedback/technical-design.md) doc for
the schema and exact file-by-file breakdown per feature.

## Boundaries

**In scope (this epic):**
- Both the text/metadata review path and real video/frame access — deliberately *not* sequenced
  as "ship text now, defer video indefinitely." Text review is the dependency the other two build
  on, not a standalone v1 that might never get a sequel.
- Learning is not scoped to the clip engine alone — the Performance page gets the same rule-learning
  loop, using real published performance as a third evidence source alongside approvals and
  editor reactions.
- Rulebook data is Postgres-native (new tables), not an Airtable mirror like `ClipRule` — this data
  needs to cite `Ticket`/`Approval` evidence that's already Postgres-primary.
- Rule approval permission mirrors the *existing* `isManager` pattern (`app/settings/asset-types`),
  extended with the founder/exec path Studio access already uses — no new permission scheme.
- **`info`/`suggestion` severity never blocks anything** — those remain pure propose-only, matching
  every other `intelligence-layer.md` capability. **`flag` severity is the one deliberate
  exception**, decided during discovery (2026-09-07): it gates the Review→Approved transition
  specifically (finishing the decision-lock mechanism the original product PRD scoped in Phase 1
  and never built), with a required-note override so a real AI outage or a judgment-call
  disagreement is a one-click fix rather than a permanent block — see E13.1's Rules & Logic for
  the exact mechanism. This is intentionally the only hard gate anywhere in this epic, and should
  stay that way rather than becoming a template for gating other transitions without the same
  scrutiny.

**Explicitly deferred / out of scope:**
- A per-ticket-per-day cost cap on the automatic trigger — flagged as a real risk, not built until
  it's a real cost pattern (see E13.1 Open Questions).
- A dedicated notification channel (Slack/manager-queue badge) for high-severity findings beyond
  the ticket page itself — undecided, not built in this epic.
- Full attribution coverage on the Performance page — the auto-match (via `Asset.distributionUrl`)
  measurably improves on today's near-zero attribution but will not reach 100%; the UI must say so
  explicitly rather than imply full coverage.

## Dependencies

- **`lib/clipping/learn.ts` / `ClipRule`** — the proven Tier-1/Tier-2 rule-learning pattern this
  epic ports, not reinvents.
- **`render-service/`** — already runs `ffmpeg` on a custom Docker image (built for Remotion, E12)
  and is reused for frame extraction rather than standing up a third Kessel service.
- **`lib/clipping/transcript.ts`** — existing Supadata/YouTube transcript fetch, reused as-is for
  YouTube-sourced tickets.
- **New: Deepgram** (or similar) for transcribing non-YouTube (Dropbox-hosted) video — not
  currently integrated anywhere in this repo.
- **`lib/roles.ts`, `lib/studio/guard.ts`** — existing role/permission model, reused for rule
  approval rather than inventing a new scheme.
- **`Asset.distributionUrl`, `SocialMetric.publishedUrl`** — existing fields this epic's
  auto-attribution join depends on.
- E7 (Performance Loop) and E9.7 (Asset-type DNA editor) — this epic extends both rather than
  duplicating their surfaces.

## Success Criteria

The [Verification](dna-feedback/technical-design.md) steps in the technical design doc establish
*that the system works* (migrations apply cleanly, reviews fire and render, cron proposes and
gates rules correctly, `npm run build`/`lint` stay clean) — those are engineering acceptance
checks. The criteria below are the business-facing signal that it's working, resolved during
discovery (2026-09-07) — structured the same way the product PRD's own Success Criteria section
is (ship gate / committed operational criterion / tracked-but-not-gated), and deliberately backed
only by fields this epic already writes to durable Postgres tables (`DnaReviewRule.active`/
`source`/`updatedAt`, `DnaReviewFinding.reaction`) — **not** a separate event-log model, unlike
E12.4's in-memory-only `AcceptanceEvent` array (a flagged gap in that epic, not a pattern to repeat)
or `ClipSuggestion`'s own acceptance-rate target, which is PRD prose with no code computing it.

**Ship gate:** by an asset type's 3rd DNA review, ≥60% of Tier-1/Tier-2 `DnaReviewRule` proposals
for that asset type land `active: true` without edits — mirrors BlinkLife's own "≥70% accepted by
the 3rd recording" signal (the mechanism this epic borrows), pulled down to 60% since this system
has no spoken-review onboarding and shouldn't be held to a bar it hasn't earned yet.

**Committed operational criterion:** the decision-lock override rate (% of Review→Approved
transitions needing a dismiss-with-note or approve-despite-missing-review override) trends down
week-over-week as the rulebook matures — same diagnostic shape as the product PRD's own
"queue-override rate trends down as trust in scoring grows." A flat-high rate signals the AI is
too noisy or the rules are wrong.

**Tracked, but NOT gated:**
- The missing-review override rate specifically, isolated from the general override rate — should
  stay near-zero; a climbing rate means the review pipeline itself is unreliable, a different
  problem than noisy findings.
- Performance-page attribution coverage, reported as a before/after delta once the
  `distributionUrl` auto-match ships (E13.3) — not an absolute target, since today's baseline is
  "near-zero" per exploration and an absolute number would be a guess, not a measurement.

## Features

| # | Feature | Purpose | Depends on |
|---|---------|---------|-----------|
| E13.1 | [Text/Metadata DNA Review + Rule Learning](dna-feedback/text-review-rule-learning.md) | Automatic first-pass review on ticket→Review; Tier-1/Tier-2 rule-learning loop; approval queue. Foundation the other two build on. | E1, E5 (Approval), E9.7 (AssetType DNA fields) |
| E13.2 | [Multimodal Video Review](dna-feedback/multimodal-video-review.md) | Opt-in real video access — frame extraction + transcription — for findings the text-only path can't produce (visual, timing). | E13.1, E12.2 (render-service) |
| E13.3 | [Performance-Driven Post-Learning Summary](dna-feedback/performance-post-learning-summary.md) | Auto-attribute published posts to tickets, surface aggregate "what's working" insights on the Performance page, feed them into the same rulebook. | E13.1, E7 (Performance Loop) |

Shared schema and file-by-file plan for all three: [Technical Design](dna-feedback/technical-design.md).

**Dependency order:** E13.1 → {E13.2 ∥ E13.3} (both build on E13.1's data model but are independent
of each other).
