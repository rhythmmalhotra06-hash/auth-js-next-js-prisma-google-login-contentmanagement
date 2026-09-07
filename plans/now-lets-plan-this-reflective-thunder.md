# AI-assisted DNA feedback — implementation plan

## Context

`context/intelligence-layer.md` capability #4, "AI-assisted DNA feedback," describes a first-pass
AI review of a video/design asset against editorial standards before a human looks — flagged
**Phase 2, blocked on "a multimodal review pipeline"** that didn't exist when the doc was written.

Vishen's voice note (2026-09-02) described a real system that closes that gap: BlinkLife's
**Recorder Review Skills** epic (`mindvalley-ai/blinklife-proto`, `prd/P5.5-recorder-review.md`,
resolved 7/7) — record a spoken review of a video, the system distills candidate rules from what
you said, you approve, and after 2-3 reviews an auto-review mode applies the learned rulebook to
new videos going forward. Full research trail is in
`plans/vishen-recorder-dna-review-loop.md`.

This plan turns that into a concrete build for Content Management, reusing what already exists in
this repo rather than reinventing BlinkLife's architecture from scratch: this codebase already has
a near-identical, working rule-learning loop for the clip engine (`ClipRule` +
`lib/clipping/learn.ts`, Tier 1 feedback-distillation + Tier 2 performance-driven proposals). The
work here is to generalize that pattern from "steer clip generation" to "review a ticket's asset
against its asset type's DNA," and — per the user's explicit decision below — to build real video
access (not just text) into the same initiative rather than deferring it indefinitely.

**Decisions locked in during planning (confirmed with the user):**
- Rulebook data lives in **new Postgres-native tables** (not an Airtable mirror like `ClipRule`) —
  faster to build, and this data needs to cite `Ticket`/`Approval` evidence that's already Postgres-primary.
- A DNA review **fires automatically** the moment a ticket's `ticketStatus` moves to `'Review'`
  (best-effort, non-blocking), plus a manual "Re-run" button.
- **Both** the text/metadata review path and real video/frame access are in scope for this
  initiative — not sequenced as "ship text now, maybe do video later." They're built as two
  workstreams with a shared data model; Workstream A is the dependency Workstream B builds on.
- Rule approval permission mirrors the **existing** `isManager` pattern in
  `app/settings/asset-types/page.tsx`, extended with the founder/exec path already used by Studio
  access (see Roles below) — not a new bespoke permission scheme.
- Learning isn't scoped to the clip engine alone. The **Performance page** (`app/performance/page.tsx`,
  Instagram/social posts + Hootsuite metrics) gets its own **post-learning summary** — aggregate
  insights correlating *what kind of content* (asset type, positioning, audience, dimension) with
  *how it performed* — which also feeds proposed `DnaReviewRule`s, not just `ClipRule`s. This is
  Workstream C below, and it's what closes the loop `intelligence-layer.md` describes: capability #1
  (performance insight) feeding capability #4 (DNA feedback), not just #3 (clip learning).

## Roles (confirmed against `lib/roles.ts`, no new roles invented)

`lib/roles.ts` already defines `ROLES = ['Editor','Designer','Manager','Approver','Admin',
'Executive / CEO','Stakeholder','Agency / External']`, with `hasRole()`/`isFounder()` helpers.
`app/settings/asset-types/page.tsx` already computes:
```ts
const isManager = access.isAdmin || hasRole(access.roles, 'Manager') || hasRole(access.roles, 'Approver');
const teamLeadOfAny = !!employee && rows.some((r) => r.teamLeadIds.includes(employee.id));
```
DNA rule approval reuses exactly this, plus `isFounder(access.roles)` (the same Executive/CEO check
`lib/studio/guard.ts` already uses for Vishen's Studio access — no new allowlist needed, he already
carries the Executive/CEO role):
```ts
const canApproveDnaRule = isManager || isFounder(access.roles) || teamLeadIds.includes(employee.id);
```

## The three existing "DNA" concepts — what happens to each

- **`model Dna`** (orphaned — zero app code reads/writes it): left untouched. Not revived, not
  deleted in this change.
- **`AssetType.dnaRequirements` / `feedbackStandards`** (live, one-way Airtable→Postgres, E9.7):
  stays exactly as-is, becomes the **prose baseline** layer every review composes first — the
  equivalent of `ClipRule.kind === 'Base Prompt'`.
- **`lib/auto-editing/dna.ts` `DnaRecord`** (E12 Remotion pipeline, currently `STUB_PILOT_DNA`):
  left separate — it's a *construction* spec (font, LUFS, safe-area), not a *judgment* spec. Not merged.
- **New — `DnaReviewRule`**: the learned layer on top of the authored `feedbackStandards` baseline,
  structurally the analog of `ClipRule.kind === 'Rule'` rows, scoped to `AssetType` (matches how
  `team_lead`/`preferred_editor` already scope ownership there).

## Data model (`prisma/schema.prisma`)

Three new Postgres-native models (no `airtableId`/`syncedAt` mirror fields — this data is written
directly, not synced):

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
  severity     String    @default("info")          // info | suggestion | flag — never a blocker
  evidence     String?                             // quoted brief/transcript excerpt, or "frame at 0:06"
  timestampMs  Int?      @map("timestamp_ms")       // set when evidence is frame/transcript-anchored
  ruleId       String?   @map("rule_id") @db.Uuid
  reaction     String?                             // null | 'helpful' | 'not_helpful'
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
`kessel db migrate` per this repo's Kessel/Prisma conventions (see CLAUDE.md) — nothing existing
changes shape.

**Decision lock, added during PRD discovery (2026-09-07) — the one deliberate exception to
"propose, don't act" anywhere in this epic.** `info`/`suggestion` severity never blocks anything.
`flag` severity gates the Review→Approved transition specifically: `decideApproval()` refuses to
set `state: 'approved'` while the ticket's latest `DnaReview` has an undismissed `flag` finding, or
while no `DnaReview` exists for the ticket's current state. No new schema — `reaction` gains a
third value, `'dismissed'` (alongside `'helpful'`/`'not_helpful'`), requiring `reactionNote`, gated
to `isManager || isFounder(roles) || teamLeadOfThatAssetType` (never the assigned editor —
separation of duties is the point). A missing review is overridden the same way approvals already
work: `decideApproval()` requires non-empty `Approval.feedback` as the audit note when proceeding
without a completed review. Fail-closed, not fail-open, on a missing review — an AI outage must
never silently look identical to "DNA was checked and passed." `changes_requested` (backward
movement) is never gated. This finally wires up `GATED_STATUSES` (`lib/tickets/constants.ts`,
declared but enforced nowhere today) and finishes the decision-lock mechanism the original product
PRD scoped in Phase 1 boundaries but never built. Full reasoning:
`prd/content-production-management/dna-feedback/text-review-rule-learning.md`'s Rules & Logic.

`usedFrames`/`frameSourceUrl`/`frameCount`/`costMicros`/`DnaReviewFinding.timestampMs` are the
fields Workstream B needs; they're added now so the two workstreams share one review record rather
than forking into "text reviews" and "video reviews" as separate concepts.

## Workstream A — text/metadata review + rule-learning loop

Directly ports the proven `lib/clipping/learn.ts` pattern.

**New `lib/dna-review/` package:**
- `lib/dna-review/repository.ts` — Prisma CRUD for the three new models.
- `lib/dna-review/config.ts` — `getDnaReviewConfig(assetTypeId)`: composes
  `AssetType.dnaRequirements/feedbackStandards` + active `DnaReviewRule` bullets, 60s cache. Ports
  `lib/clipping/config.ts::getClipEngineConfig`.
- `lib/dna-review/generate.ts` — builds the review (baseline + rulebook + ticket brief/CTA/positioning
  + deterministic dimension check + prior `Approval.feedback`), makes the structured Anthropic call
  (add `REVIEW_MODEL = 'claude-sonnet-5'` to `lib/clipping/anthropic.ts`, reusing its client/error
  handling rather than a second SDK instance), writes `DnaReview` + `DnaReviewFinding` rows.
- `lib/dna-review/learn.ts` — `distillReviewFeedbackToRule()` (Tier 1) + `proposeAssetTypeRules()`
  (Tier 2), ported from `lib/clipping/learn.ts::distillFeedbackToRule`/`proposeLearnings`. **Keep the
  JSON schema flat and capped exactly like `PROPOSE_SCHEMA`** (`maxItems: 3`, one level of nesting) —
  this repo already broke prod for 2 weeks on a "grammar too large" structured-output error from
  exactly this kind of schema growth (`lib/clipping/schema.ts` header comment); don't repeat it.
- `lib/dna-review/deliverables.ts` — deterministic, non-LLM check: which `Dimension`s are linked to
  this `assetTypeId` via `AssetTypeDimension` vs. which of `final16x9`/`final9x16`/`final4x5` are
  actually filled on the `Ticket`. No model call, can't hallucinate — ship this even if nothing else
  in Workstream A lands first.

**Tier 1 signals** (both feed `distillReviewFeedbackToRule`):
- An approver's free-text `Approval.feedback` on `decideApproval` (`changes_requested`) — already
  flows through `app/tickets/[id]/actions.ts`. Saves `active: true` immediately (real approval authority).
- An editor's thumbs up/down + note reacting to a specific `DnaReviewFinding` in the new panel.
  Saves `active: false`, pending team-lead approval (lighter-weight signal).

**Tier 2 cron** — `app/api/dna-review/learn/route.ts`, a structural port of
`app/api/clips/learn/route.ts`: same bearer-secret (`SYNC_SECRET`, `timingSafeEqual`) + `maxDuration
= 300` pattern, iterates `AssetType` rows, signal source is `Approval` + `DnaReviewFinding.reaction`
instead of clip ratings. Wire to the same weekly-Kessel-cron convention as `/api/clips/learn`.

**Trigger + UI:**
- `app/tickets/[id]/actions.ts` — new `runDnaReview(ticketId)` server action, called best-effort
  (try/catch, never throws into the caller) from the existing `requestApproval()`, matching the
  existing non-blocking pattern `assignTicket`/`notifyAssignment` already uses in that file.
- `app/tickets/[id]/page.tsx` — new `<DnaReviewPanel>` in the "Review & approval" section, next to
  `<ApprovalRows>`. Findings grouped by dimension, reaction buttons, "Re-run" button, an explicit
  "AI first pass — still needs human approval" line per `intelligence-layer.md`'s guardrails.
- `components/settings/AssetTypeEditor.tsx` — extend with a "Learned rules" section per asset type
  (approve/dismiss pending `DnaReviewRule`s), reusing the page's existing permission computation.
  `app/settings/dna-actions.ts` — `approveDnaRule`/`setDnaRuleActive`/`dismissProposedDnaRule`,
  mirroring `addRule`/`setRuleActive`/`dismissProposedLearning` in `app/settings/actions.ts`.

**Honesty guardrail:** until Workstream B ships, `DnaReview.usedFrames` is always `false` and no
finding cites a frame — findings are scoped to brief/DNA-text/deliverable-completeness only. The
panel must not imply visual/timing judgment it can't back up (mirrors `intelligence-layer.md`'s
"cite the evidence" rule).

## Workstream B — real video access (frame extraction + multimodal review)

Builds on Workstream A's data model — same `DnaReview`/`DnaReviewFinding` rows, now populated with
frame evidence.

**Reuse `render-service/` rather than standing up a third Kessel service.** It already runs on
`node:22-bookworm-slim` with `ffmpeg` installed via apt (built for Remotion rendering) — the exact
binary dependency a frame-extraction step needs, and this repo has already paid the cost of solving
"the main app's `node:lts-alpine` image can't support ffmpeg" once. Add a new endpoint,
`POST /extract-frames`, rather than a new service + Dockerfile + deploy pipeline. Flag this as an
open call (below) — extending render-service's scope vs. keeping Remotion-rendering and
DNA-review-frame-extraction as separate concerns is a real trade-off, not a slam dunk.

**Pipeline** (mirrors the internal `/watch` skill and BlinkLife's own auto-scaled fps table, per
`plans/vishen-recorder-dna-review-loop.md`):
1. Main app resolves the ticket's deliverable link(s) (`final16x9`/`final9x16`/`final4x5`, or
   `sourceLinks` — Dropbox share links today, per `Asset.fileUrl`'s existing "Dropbox / storage link"
   comment, plus opportunistically a YouTube URL via the transcript path in (2)).
2. Transcript: reuse `lib/clipping/transcript.ts`'s existing `fetchSupadataTranscript`/
   `fetchYouTubeTranscript` unchanged when a link parses as YouTube. **Dropbox video bytes need their
   own transcript path** — Deepgram (already namechecked as BlinkLife's transcription backend) is the
   candidate; no transcription-from-Dropbox-audio exists in this repo yet. New dependency.
3. Main app calls `render-service`'s new `/extract-frames` endpoint with the video URL + duration.
   That endpoint downloads the file (needs a Dropbox-download step — confirm below whether existing
   links are fetchable via direct HTTP `?dl=1` or require Dropbox API auth), runs ffmpeg with the same
   auto-scaled frame budget BlinkLife uses (≤30s→30 frames … >10min→100 frames, capped), resizes to
   1024px/JPEG@0.85, and returns frames as **base64 inline in the response** — not persisted to any
   bucket. This sidesteps the "no storage layer yet" gap `render-service/server.mjs` already has
   open, and matches this feature's actual need (frames feed one LLM call and are discarded).
4. `lib/dna-review/generate.ts` sends frames as multimodal content blocks
   (`{type:'image', source:{type:'base64', media_type:'image/jpeg', data}}`) alongside the transcript
   and rulebook to `REVIEW_MODEL`. `DnaReviewFinding.timestampMs` gets populated from frame timestamps
   for the first time — this is where "hook lands at 0:06; DNA requires ≤0:03"-style findings become
   possible.
5. Cost/opt-in: unlike Workstream A (cheap, always-on), this is materially more expensive
   (~$0.28-0.30/review per BlinkLife's own numbers) and slower. Gate it as an explicit "Review with
   visuals" action on the `<DnaReviewPanel>`, not folded into the automatic status-change trigger —
   same opt-in reasoning BlinkLife itself landed on, and the only way to avoid needing a cost dashboard
   for v1.

**New/changed files:** `render-service/server.mjs` (+`/extract-frames` route), `lib/dna-review/frames.ts`
(client for that endpoint), `lib/dna-review/generate.ts` (extended to accept frames), a Deepgram
integration module (`lib/dna-review/transcribe-deepgram.ts` or similar) for non-YouTube sources,
`components/tickets/DnaReviewPanel.tsx` (add the "Review with visuals" button + frame strip,
mirroring BlinkLife's button/badge state machine: `available → running → done/failed`).

## Workstream C — performance-driven post-learning summary

Today's Performance page (`app/performance/page.tsx` → `SocialAccountPanel`) already computes
per-account, per-`kind` (`post`/`story`) median/percentile rollups (`lib/metrics/social-perf.ts::
rollupAccounts()`) and has a single-post, human-triggered "Teach the engine" action
(`app/performance/actions.ts::proposeLearningFromPost()`) that writes straight to `ClipRule` — no
aggregation by content attributes, no connection to DNA. This workstream adds the aggregate,
content-attribute-aware summary the user asked for, and wires it into the same `DnaReviewRule`
learning loop as Workstreams A/B, not just clip rules.

**The attribution gap is the real blocker, not the summary logic.** `SocialMetric.ticketAirtableId`
is a bare text field (no Prisma relation) and, per research, is "often near-zero" populated — most
Hootsuite-reported posts have no ticket link today, so there's little to group by content attributes
yet. Two moves, both needed before the summary is useful:

1. **Improve attribution automatically, not just via the existing manual "Attach to ticket" action.**
   `Asset.distributionUrl` already exists — add a best-effort auto-match in
   `lib/metrics/social-perf.ts` (or a new `lib/performance/attribution.ts`) that resolves
   `SocialMetric.publishedUrl` against `Asset.distributionUrl` (and falls back to `ticketAirtableId`/
   `vishenVideoId` as today) whenever metrics are ingested. This is deterministic URL matching, no
   LLM, and directly shrinks the "near-zero attribution" gap flagged in exploration.
2. **Join content attributes once attribution exists**: `SocialMetric` → `Ticket` (via `airtableId`)
   → `AssetType` (`assetTypeId`) + `Ticket.positioning`/`audience`/linked `Dimension`. No such join
   exists in app code today — new function `lib/performance/attribution.ts::attributedMetrics()`.

**`lib/performance/insights.ts::computeContentInsights()`** — groups attributed
`SocialMetric`+`Ticket` rows by `(assetTypeId × positioning × audience)`, computes aggregate
`engagementRate`/`vsMedian` per group, and **only surfaces a group once it clears a minimum sample
size** (recommend ≥3 attributed posts — same "sample-size honesty" guardrail
`intelligence-layer.md` capability #1 calls out by name: "don't present a 2-asset segment as a
trend"). v1 output is **template-composed, not LLM-narrated** — capability #1's own build note says
"a model isn't required for v1; it's required when you want free-text attributes... factored in" —
e.g. `"{assetType} · {positioning} · {audience}: {n} posts, engagement {pct}% vs. account median"`.
An LLM narration pass (via the same `REVIEW_MODEL` client from Workstream A) is a natural v1.1 once
template output is validated against real data, not a v1 requirement.

**UI:** new `components/performance/ContentInsightsPanel.tsx` on `app/performance/page.tsx`, above
or beside the existing `SocialAccountPanel`s — "What's working" cards per qualifying group, each with
an **"Add to DNA rulebook"** action that writes a `DnaReviewRule` (`source: 'tier2_proposal'`,
`active: false`, `sourceTicketId` from a representative example post) scoped to that group's
`assetTypeId`, reusing `lib/dna-review/repository.ts` from Workstream A — the same approval queue in
`components/settings/AssetTypeEditor.tsx` picks it up. `proposeLearningFromPost()`'s existing
single-post → `ClipRule` path is untouched (it's a different, still-valid signal for clip-generation
steering); this adds the aggregate, DNA-scoped sibling rather than replacing it.

**Tier 2 cron extension:** `app/api/dna-review/learn/route.ts` (Workstream A) additionally calls
`computeContentInsights()` and folds qualifying groups into the same `proposeAssetTypeRules()` call
as another evidence source alongside `Approval`/finding-reaction signals — so a proposed DNA rule can
cite either "3 approvers flagged this" or "6 published posts of this type outperform by 40%," matching
`intelligence-layer.md`'s compounding-loop design (#1 → #3/#4) rather than treating performance as a
separate, disconnected learning track.

## Verification

- `npx prisma generate` + `npx prisma migrate dev --name dna_review` locally against a dev DB; confirm
  no drift against `prisma/schema.prisma`'s existing conventions (UUID defaults, `@map`/`@@map` style).
- Workstream A: trigger a review by moving a real ticket to `Review` status in the dev app; confirm a
  `DnaReview` + `DnaReviewFinding` rows are created, the panel renders on `app/tickets/[id]/page.tsx`,
  and the deterministic deliverable-completeness check correctly flags a missing dimension on a test
  ticket with an incomplete asset type.
- Exercise both Tier 1 paths by hand: submit `changes_requested` approval feedback and confirm a rule
  lands `active: true`; react to a finding and confirm a rule lands `active: false` pending team-lead
  approval in `app/settings/asset-types/page.tsx`.
- Decision lock: confirm `decideApproval()` rejects `approved` while an undismissed `flag` finding
  exists or no `DnaReview` exists for the ticket's current state; confirm dismissal (with note,
  approver-tier only, never the assigned editor) and approve-with-note-despite-missing-review both
  unblock it; confirm `changes_requested` is never blocked.
- `curl -X POST "$URL/api/dna-review/learn" -H "Authorization: Bearer $SYNC_SECRET"` against a seeded
  set of `Approval`/finding-reaction signals; confirm ≤3 proposed rules land inactive, and confirm the
  request is rejected without the bearer token.
- Workstream B: confirm `render-service`'s `/extract-frames` endpoint round-trips a real Dropbox test
  link and a real YouTube link, that frame counts match the auto-scaled budget table, and that a
  resulting `DnaReview` has `usedFrames: true` with at least one `timestampMs`-anchored finding.
- Workstream C: confirm the `Asset.distributionUrl`↔`SocialMetric.publishedUrl` auto-match measurably
  raises attributed-row count against real data; confirm `computeContentInsights()` withholds a group
  below the sample-size floor (test with 1-2 posts) and surfaces one at/above it (test with 3+); confirm
  "Add to DNA rulebook" writes an inactive `DnaReviewRule` that appears in the `AssetTypeEditor` approval
  queue from Workstream A.
- Full regression: `npm run build` and `npm run lint` clean; no existing ticket/approval/asset-type
  flows change behavior (Workstream A additions are additive and best-effort/non-blocking throughout).

## Post-deploy fix: video-URL resolution misses `assetFolderLink` (found 2026-09-07)

### Context

E13.1 and E13.2 are both built and deployed to production (see the commits and the PRD's
revision notes). While testing E13.2's "Review with visuals" against a real ticket — "We Spent
$5 Trillion in 18 Months on COVID" (`72e141d0-4dcf-41b4-9ef9-b7bd477266b8`, asset type "VL Media
Clips - Clip - Reel (Under 3 mins)") — it failed with "No final deliverable link (9x16/16x9/4x5)
is attached to this ticket yet," even though the ticket has a real, working Dropbox video link.

Confirmed via a direct query against the real ticket: `final_9x16`, `final_16x9`, and `final_4x5`
are all empty; the actual video lives in `asset_folder_link`
(`https://www.dropbox.com/scl/fi/ppqgfm29ic3mzxrms1814/...mp4?...`), and
`team_service_level = 'Video Team - Non Campaign'`. This isn't a one-off data-entry quirk — it
matches a convention already documented elsewhere in this exact codebase: the comment in
`app/tickets/[id]/actions.ts` on `maybeNotifyAssetReady`'s trigger logic states outright that
"non-ads tickets have no ratio links, so the Asset Folder Link is their delivery signal instead."
`lib/dna-review/generate.ts::resolveTicketVideoUrl()` (E13.2) only ever checks the three ratio
fields, so it silently can't find a deliverable for the entire non-ads ticket population.

### Fix

Extend `resolveTicketVideoUrl()`'s fallback chain (currently `final9x16 → final16x9 → final4x5`)
to also check `assetFolderLink` last:

```ts
async function resolveTicketVideoUrl(ticketId: string): Promise<string | null> {
  const t = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { final9x16: true, final16x9: true, final4x5: true, assetFolderLink: true },
  });
  return t?.final9x16?.trim() || t?.final16x9?.trim() || t?.final4x5?.trim() || t?.assetFolderLink?.trim() || null;
}
```

Deliberately a flat fallback chain, not a branch on `isAds` (the existing `isAds` heuristic in
`lib/tickets/data.postgres.ts` is itself flagged `STALE`/unreliable in its own comment — reusing
a known-shaky signal to decide which field to trust would just import that unreliability here).
If the ratio fields are empty, trying `assetFolderLink` next is safe regardless of ticket type —
ads tickets that do have ratio links keep using those first.

**Known accepted risk, not fixed here:** despite its name, `assetFolderLink` sometimes holds a
single direct file link (as in this real case) and, per its own field name, could sometimes
genuinely be a multi-file *folder* share instead — which `render-service`'s `dl=1`-rewrite +
single-file download/ffprobe pipeline cannot handle. If that happens, the existing failure path
(download/ffprobe error surfaced as a real `{ok:false, error}`, shown in the panel) already
degrades honestly rather than silently misbehaving — no special-casing needed for v1, but worth
knowing if "extract-frames failed" reports start showing up for non-ads tickets.

### Verification

- Re-run `runVisualDnaReview('72e141d0-4dcf-41b4-9ef9-b7bd477266b8', null)` locally (or click
  "Review with visuals" on that ticket in the browser) and confirm it now finds the video and
  produces real findings instead of the "no deliverable link" error.
- Confirm a ratio-delivery (ads) ticket with a real `final9x16` link still resolves to that field,
  not `assetFolderLink` — the fallback order must not regress the already-working case.
- `npm run build` / `tsc --noEmit` clean; redeploy the main portal only (this fix is main-app-only,
  no `render-service` change needed).

## Post-deploy fix: render-service OOM-crashing on frame extraction (found 2026-09-07)

### Context

After the `assetFolderLink` fix, real testing hit two more failures on `render-service`:
first `extract-frames failed (HTTP 503): Service Unavailable`, then (on retry)
`extract-frames failed (HTTP 500): ffprobe failed (exit 1): moov atom not found /
Invalid data found when processing input`.

Pulled `kessel runtime-logs --since 30m` (from `render-service/`) and found the real cause: the
container is repeatedly **crashing with `FATAL ERROR: Reached heap limit — JavaScript heap out of
memory`**, visible as several back-to-back restart cycles (`[render-service] bundling
composition in the background... listening on :8080`, repeated). The 503 was Cloud Run's response
when the container died mid-request; the "moov atom not found" on the next attempt is a
half-written, truncated MP4 left on disk by a crash that happened mid-download, which `ffprobe`
then (correctly) rejected as corrupt.

**Root cause:** `downloadVideo()` in `render-service/server.mjs` reads the *entire* source video
into memory before writing it to disk —
```js
const chunks = [];
for await (const chunk of resp.body) { chunks.push(chunk); }
await writeFile(destPath, Buffer.concat(chunks));
```
This worked in earlier local/manual testing only because those test videos happened to be small
enough to fit. It was never going to scale, and it's competing for memory with Remotion's own
webpack bundling step (`bundle({...})`, E12.2), which runs unconditionally on every container
start regardless of which endpoint is actually being called — on what the V8 heap numbers in the
crash log imply is a small (~512MB) Cloud Run container, the two together are enough to OOM on a
real-sized video.

### Fix

Stream the download straight to disk instead of buffering it in memory — near-constant memory
regardless of file size, using Node's standard `pipeline()` (correct error/cleanup propagation,
unlike manual `.pipe()`), with the existing size guard enforced incrementally via a `Transform`:

```js
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';

async function downloadVideo(url, destPath) {
  const resp = await fetch(toDirectDownloadUrl(url), { redirect: 'follow' });
  if (!resp.ok || !resp.body) throw new Error(`Download failed: HTTP ${resp.status}`);
  const contentLength = Number(resp.headers.get('content-length') ?? 0);
  if (contentLength > MAX_DOWNLOAD_BYTES) throw new Error(`Source file too large (${Math.round(contentLength / 1e6)}MB, max 500MB)`);

  let total = 0;
  const guard = new Transform({
    transform(chunk, _enc, cb) {
      total += chunk.length;
      if (total > MAX_DOWNLOAD_BYTES) return cb(new Error('Source file exceeded the 500MB guard mid-download'));
      cb(null, chunk);
    },
  });

  await pipeline(Readable.fromWeb(resp.body), guard, createWriteStream(destPath));
}
```

This is the essential fix regardless of container size — buffering a whole file in memory is the
wrong pattern at any RAM allocation, not just this one.

**Complementary mitigation, not done here (web-UI only, per CLAUDE.md — Resources aren't
CLI-configurable):** recommend the user bump `render-service`'s Cloud Run memory allocation via
Kessel's dashboard. Streaming fixes the worst offender, but Remotion's bundling step alone likely
already uses a meaningful share of a 512MB container, leaving thin headroom for ffmpeg's own
process memory during a real frame-extraction run.

**Correction — this turned out to be the actual root cause, not just a compounding factor.**
Deployed the streaming fix above and re-tested the exact same production video: still a 503.
Runtime logs showed the OOM crash happening immediately after the "bundling composition in the
background..." log line, before any request-handling code had run — meaning `bundle()`'s
unconditional webpack build on every cold start was, on its own, enough to OOM this container's
small memory allocation, independent of the download fix. Fixed by making bundling lazy: `bundle()`
now only starts on the first real `/render` call (`getBundle()`, memoized), not at module load.
`/extract-frames` cold starts no longer touch Remotion or webpack at all. Verified locally: a
fresh server start's log shows only `"listening on :8080"` — no bundling line — and
`/extract-frames` against the exact video that crashed production completes cleanly (40 frames,
no heap warnings in the log).

### Verification

- Re-run the two tickets that failed ("We Spent $5 Trillion in 18 Months on COVID" and whichever
  ticket produced the 503) after redeploying `render-service` and confirm both complete without
  crashing.
- Watch `kessel runtime-logs --since 10m` (from `render-service/`) during a real run and confirm
  no `heap out of memory` / restart-cycle log lines appear.
- `node --check render-service/server.mjs` and `npm run typecheck` (from `render-service/`) clean.
- This is a `render-service`-only fix — no main-portal change or redeploy needed.

## Open items to resolve during build (not blocking, but real)

1. **render-service scope creep** — confirm the team is fine folding frame-extraction into the
   Remotion-rendering service vs. a cleaner separate service. Recommended above for pragmatism, not
   a forced call.
2. **Dropbox download mechanism** — confirm whether the existing share links are "anyone with link"
   (fetchable via direct HTTP with `?dl=1`) or need real Dropbox API OAuth. Changes Workstream B's
   scope meaningfully.
3. **Transcription for non-YouTube sources** — Deepgram (or another provider) needs to be added as a
   new dependency/credential; not currently integrated anywhere in this repo.
4. **Notification hook for `flag`-severity findings** — ticket-page-only for v1, or also a
   manager-queue badge/Slack ping (`lib/notify/slack.ts` already has a precedent from the auto-editing
   drift alerts)? Not scoped above; confirm before or shortly after Workstream A ships.
5. **Cost control on the automatic trigger** — Workstream A's automatic call is cheap (text-only,
   Haiku/Sonnet), but there's no existing per-ticket-per-day rerun cap in this codebase for an
   automatic (not button-gated) LLM trigger. Consider one if repeated status-flapping on a ticket
   becomes a real cost pattern.
6. **Attribution coverage, honestly** — even with the `distributionUrl` auto-match, a meaningful
   share of published posts (agency-run accounts, posts predating the field, off-platform shares)
   will likely stay unattributed. Workstream C's insight panel should say so explicitly (e.g. "12 of
   340 posts attributed to a ticket") rather than imply full coverage — same "cite the evidence,
   don't overclaim" guardrail applied to attribution itself, not just to individual findings.
7. **Grouping granularity** — `(assetTypeId × positioning × audience)` is the v1 grouping; confirm
   whether `Dimension`/aspect ratio should be a fourth grouping key from the start or added once real
   data shows whether it's a meaningful split (more keys = smaller, noisier groups given the
   sample-size floor).
