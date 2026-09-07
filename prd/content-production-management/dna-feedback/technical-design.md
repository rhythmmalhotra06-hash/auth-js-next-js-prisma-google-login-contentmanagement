---
title: 'AI-Assisted DNA Feedback — Technical Design'
slug: 'dna-feedback-techdesign'
scope: technical-design
status: discovery
parent: content-production-management/dna-feedback.md
created: 2026-09-02
updated: 2026-09-07
imported-from: "plans/now-lets-plan-this-reflective-thunder.md"
---

# AI-Assisted DNA Feedback — Technical Design

> **2026-09-07:** E13.1 built + deployed to production. E13.2 built and verified locally against
> real production data (see its own PRD's revision note and Verification below) — not yet deployed.

> Companion to [E13 · AI-Assisted DNA Feedback](../dna-feedback.md) and its children
> ([E13.1 Text/Metadata Review](text-review-rule-learning.md),
> [E13.2 Multimodal Video Review](multimodal-video-review.md),
> [E13.3 Performance-Driven Learning](performance-post-learning-summary.md)).
> The feature PRDs answer *what/why*; this answers *how we build it*. Full planning trail:
> `plans/now-lets-plan-this-reflective-thunder.md` and `plans/vishen-recorder-dna-review-loop.md`.

## Roles (no new roles invented)

`lib/roles.ts` defines `ROLES = ['Editor','Designer','Manager','Approver','Admin',
'Executive / CEO','Stakeholder','Agency / External']`, with `hasRole()`/`isFounder()` helpers.
`app/settings/asset-types/page.tsx` already computes:
```ts
const isManager = access.isAdmin || hasRole(access.roles, 'Manager') || hasRole(access.roles, 'Approver');
const teamLeadOfAny = !!employee && rows.some((r) => r.teamLeadIds.includes(employee.id));
```
DNA rule approval reuses exactly this, plus `isFounder(access.roles)` (the same Executive/CEO check
`lib/studio/guard.ts` already uses for Vishen's Studio access — no new allowlist needed):
```ts
const canApproveDnaRule = isManager || isFounder(access.roles) || teamLeadIds.includes(employee.id);
```

## The three pre-existing "DNA" concepts — what happens to each

- **`model Dna`** (orphaned — zero app code reads/writes it, confirmed by grep): left untouched.
  Not revived, not deleted by this epic.
- **`AssetType.dnaRequirements` / `feedbackStandards`** (live, one-way Airtable→Postgres, E9.7):
  stays exactly as-is, becomes the **prose baseline** layer every review composes first — the
  equivalent of `ClipRule.kind === 'Base Prompt'`.
- **`lib/auto-editing/dna.ts` `DnaRecord`** (E12 Remotion pipeline, currently `STUB_PILOT_DNA`):
  left separate — it's a *construction* spec (font, LUFS, safe-area), not a *judgment* spec.
- **New — `DnaReviewRule`** (below): the learned layer on top of the authored `feedbackStandards`
  baseline, structurally the analog of `ClipRule.kind === 'Rule'` rows, scoped to `AssetType`.

## Data model (`prisma/schema.prisma`)

Three new Postgres-native models (no `airtableId`/`syncedAt` mirror fields — written directly, not
synced), introduced by E13.1 and extended by E13.2/E13.3:

```prisma
model DnaReviewRule {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  assetTypeId    String   @map("asset_type_id") @db.Uuid
  statement      String                        // imperative, <200 chars
  rationale      String?
  example        String?
  weight         Int      @default(3)          // 1-5
  confidence     Float    @default(0.5)        // 0-1
  active         Boolean  @default(false)       // proposals land inactive
  source         String                        // 'tier1_decision' | 'tier1_reaction' | 'tier2_proposal' | 'manual'
  sourceTicketId String?  @map("source_ticket_id") @db.Uuid
  note           String?
  createdBy      String?  @map("created_by")
  updatedBy      String?  @map("updated_by")
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz

  assetType    AssetType @relation(fields: [assetTypeId], references: [id], onDelete: Cascade)
  sourceTicket Ticket?   @relation("DnaRuleSourceTicket", fields: [sourceTicketId], references: [id], onDelete: SetNull)
  findings     DnaReviewFinding[]

  @@index([assetTypeId, active])
  @@map("dna_review_rules")
}

model DnaReview {
  id                  String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  ticketId            String   @map("ticket_id") @db.Uuid
  assetTypeId         String?  @map("asset_type_id") @db.Uuid   // snapshot at review time
  model               String                                    // provenance, e.g. claude-sonnet-5
  usedTranscript      Boolean  @default(false) @map("used_transcript")
  usedFrames          Boolean  @default(false) @map("used_frames")
  transcriptSourceUrl String?  @map("transcript_source_url")
  frameSourceUrl      String?  @map("frame_source_url")
  frameCount          Int?     @map("frame_count")
  costMicros          Int?     @map("cost_micros")
  summary             String?
  triggeredBy         String                                    // 'status_change' | 'manual'
  requestedBy         String?  @map("requested_by")
  createdAt           DateTime @default(now()) @map("created_at") @db.Timestamptz

  ticket   Ticket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  findings DnaReviewFinding[]

  @@index([ticketId, createdAt])
  @@map("dna_reviews")
}

model DnaReviewFinding {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  reviewId     String    @map("review_id") @db.Uuid
  dimension    String                             // 'brief_compliance' | 'wording' | 'deliverable_metadata' | 'visual' | 'timing'
  note         String
  severity     String    @default("info")          // info | suggestion | flag — flag gates Review→Approved (see Decision Lock below); info/suggestion never block
  evidence     String?                             // quoted brief/transcript excerpt, or "frame at 0:06"
  timestampMs  Int?      @map("timestamp_ms")       // set when evidence is frame/transcript-anchored (E13.2)
  ruleId       String?   @map("rule_id") @db.Uuid
  reaction     String?                             // null | 'helpful' | 'not_helpful' | 'dismissed' — 'dismissed' clears a flag for the gate, requires reactionNote
  reactionNote String?   @map("reaction_note")
  reactedBy    String?   @map("reacted_by")
  reactedAt    DateTime? @map("reacted_at") @db.Timestamptz
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz

  review DnaReview      @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  rule   DnaReviewRule? @relation(fields: [ruleId], references: [id], onDelete: SetNull)

  @@map("dna_review_findings")
}
```
Plus reverse relations: `AssetType.dnaReviewRules`, `Ticket.dnaReviews`,
`Ticket.dnaReviewRuleSources`. One additive migration (`npx prisma migrate dev`), applied via
`kessel db migrate` per this repo's Kessel/Prisma conventions — nothing existing changes shape.

`usedFrames`/`frameSourceUrl`/`frameCount`/`costMicros`/`DnaReviewFinding.timestampMs` are the
fields E13.2 needs; they're added by E13.1 so all three features share one review record rather
than forking into separate "text review" and "video review" concepts.

## Decision lock (E13.1 — the one hard gate in this epic)

**Correction (2026-09-07):** planning assumed `decideApproval()`/`Approval.feedback` were the live
approval mechanism. Verified against actual code, they are not — `decideApproval()`/
`requestApproval()` in `app/tickets/[id]/actions.ts` are never called from any UI, and `Approval`
has zero rows in the live data. The real, live status-change path — the only caller anywhere in
the app — is `updateTicketStatus(ticketId, newStatus)` from `components/tickets/StatusUpdater.tsx`'s
plain dropdown. The gate below integrates with that function, not the dead approval flow.

`updateTicketStatus()` gains one new optional parameter, `overrideNote?: string`, and refuses to
set `Ticket.ticketStatus` to `'Approved'` while either holds:
1. the ticket's latest `DnaReview` has a `severity: 'flag'` finding with `reaction IS NULL`, or
2. no `DnaReview` exists for the ticket's current state.

Override paths reuse existing fields rather than adding new ones — no new schema:
- **Dismiss a flag:** `DnaReviewFinding.reaction = 'dismissed'` + required `reactionNote`, gated to
  `isManager || isFounder(roles) || teamLeadOfThatAssetType` (never the assigned editor).
- **Approve despite a missing review:** `updateTicketStatus(ticketId, 'Approved', overrideNote)`
  requires a non-empty `overrideNote`, persisted via `updateTicket()`'s existing
  `opts.note` → `TicketEvent.note` mechanism (the audit-trail model status changes already use,
  per `lib/tickets/write.postgres.ts`) — no new table.

`'In Revision'` (moving the ticket backward) is never gated — only forward movement into
`'Approved'`. `GATED_STATUSES` (`lib/tickets/constants.ts`) currently lists only `'Shipping'`,
itself unenforced anywhere — this feature is the first actual enforcement and adds `'Approved'`
alongside it. This finishes the decision-lock mechanism the original product PRD scoped in its
Phase 1 boundaries ("approval stage blocks next state transition") but never implemented, and is
the one deliberate exception to "propose, don't act" anywhere in this epic.

## E13.1 — file-by-file

**New `lib/dna-review/` package:**
- `lib/dna-review/repository.ts` — Prisma CRUD for the three models.
- `lib/dna-review/config.ts` — `getDnaReviewConfig(assetTypeId)`: composes
  `AssetType.dnaRequirements/feedbackStandards` + active `DnaReviewRule` bullets, 60s cache. Ports
  `lib/clipping/config.ts::getClipEngineConfig`.
- `lib/dna-review/generate.ts` — builds the review, makes the structured Anthropic call (add
  `REVIEW_MODEL = 'claude-sonnet-5'` to `lib/clipping/anthropic.ts`, reusing its client/error
  handling), writes `DnaReview` + `DnaReviewFinding` rows.
- `lib/dna-review/learn.ts` — `distillReviewFeedbackToRule()` (Tier 1) + `proposeAssetTypeRules()`
  (Tier 2), ported from `lib/clipping/learn.ts`. Keep the JSON schema flat and capped exactly like
  `PROPOSE_SCHEMA` (`maxItems: 3`, one level of nesting) — see E13.1's Rules & Logic for why.
- `lib/dna-review/deliverables.ts` — deterministic, non-LLM check: `Dimension`s linked via
  `AssetTypeDimension` vs. filled `final16x9`/`final9x16`/`final4x5` fields.

**Ticket page + settings:**
- `app/tickets/[id]/actions.ts` — new `runDnaReview(ticketId)` server action, called best-effort
  from `updateTicketStatus()` when `newStatus === 'Review'` (the only live status-change path —
  `requestApproval()`/`decideApproval()` are dead code, never called from any UI). The decision
  lock (gate check + `overrideNote` param) also lives in `updateTicketStatus()`, gating only the
  transition into `'Approved'`.
- `app/tickets/[id]/page.tsx` — new `<DnaReviewPanel>` next to `<ApprovalRows>`.
- `components/settings/AssetTypeEditor.tsx` — "Learned rules" section per asset type.
- `app/settings/dna-actions.ts` — `approveDnaRule`/`setDnaRuleActive`/`dismissProposedDnaRule`,
  mirroring `addRule`/`setRuleActive`/`dismissProposedLearning` in `app/settings/actions.ts`.

**Tier 2 cron:**
- `app/api/dna-review/learn/route.ts` — structural port of `app/api/clips/learn/route.ts`: same
  bearer-secret (`SYNC_SECRET`, `timingSafeEqual`) + `maxDuration = 300` pattern.

## E13.2 — file-by-file (built and verified 2026-09-07)

Reused `render-service/` rather than a third Kessel service, confirmed the right call — it already
runs `node:22-bookworm-slim` with `ffmpeg` installed via apt (built for Remotion, E12.2), so
`/extract-frames` needed zero new system dependencies. **No transcription was built** — scope
narrowed to frames-only during implementation (see the feature PRD's Purpose); Deepgram remains
deferred, not integrated.

- `render-service/server.mjs` — `POST /extract-frames`: downloads the video (Node's built-in
  `fetch`, 500MB guard, Dropbox `dl=1` rewrite via `toDirectDownloadUrl()`), `ffprobe`s duration,
  runs one `ffmpeg` pass for the auto-scaled frame budget (≤30s→30 … >10min→100, capped) +
  1024px-longest-edge scaling, returns frames base64-inline. Not idempotent/cached — each call
  re-downloads and re-extracts (see the feature PRD's Rules & Logic for why that's an accepted gap).
- `lib/dna-review/frames.ts` — client for that endpoint, bounded retry (429/502/503 only) matching
  `lib/mcp/client.ts`'s established pattern.
- `lib/dna-review/generate.ts::runVisualDnaReview()` — new function (not a modification of
  `runDnaReview()`) that resolves the ticket's Dropbox video URL (`final9x16` → `final16x9` →
  `final4x5`), extracts frames, and sends them as multimodal content blocks with a **separate**
  `VISUAL_FINDINGS_SCHEMA`/`VISUAL_SYSTEM_PROMPT` (allows `dimension: 'visual'|'timing'` and
  `timestampMs`) at `max_tokens: 4096` — raised from an initial 2000 after hitting a real, silent
  `stop_reason: 'max_tokens'` failure in testing (see the feature PRD's Rules & Logic). Writes a
  **new** `DnaReview` row per run, not an update to the prior one.
- `lib/dna-review/repository.ts::CreateDnaReviewInput` — extended with `usedFrames`/
  `frameSourceUrl`/`frameCount` (all optional, default false/null) so one `createDnaReview()` call
  serves both the text-only and visual paths.
- `app/tickets/[id]/actions.ts::runVisualDnaReviewAction()` — thin wrapper, same
  best-effort/revalidate shape as `rerunDnaReview()`.
- `components/tickets/DnaReviewPanel.tsx` (extended) — "👁️ Review with visuals" button with an
  inline confirm step (cost/time estimate) before firing, a `running` state, and a
  "✓ Visual review included (N frames)" indicator once done. No frame-strip preview — frames aren't
  persisted anywhere to show one (by design, see Data in the feature PRD).

## E13.3 — file-by-file

- `lib/metrics/social-perf.ts` (or new `lib/performance/attribution.ts`) — best-effort auto-match
  of `SocialMetric.publishedUrl` against `Asset.distributionUrl` at ingestion time, alongside the
  existing `ticketAirtableId`/`vishenVideoId` resolution.
- `lib/performance/attribution.ts::attributedMetrics()` — new join: `SocialMetric` → `Ticket` (via
  `airtableId`) → `AssetType`/`positioning`/`audience`. No such join exists in app code today.
- `lib/performance/insights.ts::computeContentInsights()` — groups attributed rows by
  `(assetTypeId × positioning × audience)`, computes aggregate `engagementRate`/`vsMedian`,
  withholds groups below the sample-size floor (≥3), template-composes output text (no LLM in v1).
- `components/performance/ContentInsightsPanel.tsx` — new panel on `app/performance/page.tsx`,
  "What's working" cards with an "Add to DNA rulebook" action writing a `DnaReviewRule`
  (`source: 'tier2_proposal'`) via E13.1's `lib/dna-review/repository.ts`.
- `app/api/dna-review/learn/route.ts` (extended, from E13.1) — additionally calls
  `computeContentInsights()` and folds qualifying groups into `proposeAssetTypeRules()` as another
  evidence source alongside `Approval`/reaction signals.

`proposeLearningFromPost()`'s existing single-post → `ClipRule` path
(`app/performance/actions.ts`) is untouched — this adds a DNA-scoped sibling, not a replacement.

## Verification

- `npx prisma generate` + `npx prisma migrate dev --name dna_review` locally; confirm no drift
  against `prisma/schema.prisma`'s existing conventions (UUID defaults, `@map`/`@@map` style).
- **E13.1:** trigger a review by moving a real ticket to `Review` status; confirm `DnaReview` +
  `DnaReviewFinding` rows are created and the panel renders; confirm the deterministic
  deliverable-completeness check flags a missing dimension on a test ticket. Exercise both Tier-1
  paths by hand (approval feedback → active rule; finding reaction → inactive rule pending
  approval). `curl -X POST "$URL/api/dna-review/learn" -H "Authorization: Bearer $SYNC_SECRET"`
  against seeded signals — confirm ≤3 proposed rules land inactive, and the request is rejected
  without the bearer token. Confirm the decision lock: `decideApproval()` rejects `approved` while
  an undismissed `flag` finding exists or no `DnaReview` exists for the ticket's current state;
  confirm dismissal (with note, approver-tier only) and approve-with-note-despite-missing-review
  both unblock it; confirm the assigned editor cannot dismiss their own ticket's finding; confirm
  `changes_requested` is never blocked.
- **E13.2 — done, 2026-09-07:** `render-service`'s `/extract-frames` endpoint verified against a
  real production Dropbox link (87s video → 60 frames, each a valid decodable JPEG); a real
  `runVisualDnaReview()` run produced genuine, evidence-grounded findings (over-length flag, brief
  divergence past the provided script, confirmed specific caption corrections); the full
  click → confirm → complete UI flow verified via a real Playwright browser run. YouTube-source
  frame extraction was explicitly descoped, not tested (see the feature PRD's Purpose).
- **E13.3:** confirm the `distributionUrl` auto-match measurably raises attributed-row count
  against real data; confirm `computeContentInsights()` withholds a group below the sample-size
  floor (1-2 posts) and surfaces one at/above it (3+ posts); confirm "Add to DNA rulebook" writes
  an inactive `DnaReviewRule` that appears in the E13.1 approval queue.
- Full regression: `npm run build` and `npm run lint` clean; no existing ticket/approval/asset-type
  flow changes behavior.
