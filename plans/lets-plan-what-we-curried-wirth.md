# Portal work — prioritisation (Aug 2026)

## Context

Three calls in August surfaced the same problem from three angles:

- **Titus (Aug 20)** — no cadence, requests bypass the system via Gareth, turnaround times unpublished.
- **Gareth + Moniek (Aug 24)** — priorities set in private 1:1s with Vision; the content team delivers against a list the requesting stakeholder never agreed to.
- **Acq/Web review (Aug 26)** — Fariz, Abhishek, Bryan, Moniek. The web team **already has** a Friday prioritisation call and it still fails. Fariz's objection is the sharpest finding in all three calls:

  > "Ten stars doesn't make a difference to me. Guilds might be two stars but I still have to launch it next week, so I do it regardless."

The portal today ranks on a **1–5 star manual rank** (`queueRank`) blended with an Airtable `SCORE` formula. Neither knows whether a date is real. That is why the ranking is decoration: **priority without date-reality is unactionable.**

Moniek and Rhythm jointly own the resulting proposal (action item from Aug 26). This plan is the portal half of it.

**Decisions taken (confirmed with Rhythm):**
1. Scope = **video + design + web pages**. Dev tickets stay in Jira.
2. Ship **date reality first**.
3. The initiative/campaign parent is the existing **`OfficialCalendar`** — no new model.

**Outcome we're aiming at:** the Monday prioritisation call runs off one portal board where each row shows a real launch date, a real turnaround, and every discipline the initiative needs.

---

## What we are NOT doing

- No Jira integration. Abhishek and Bryan value their Jira audit trail; we add a **link field**, not a sync.
- No new `Campaign`/`Initiative` model — reuse `OfficialCalendar`.
- No replacement of the star rank. Date-reality **gates** it; managers keep their override.
- No drag-to-reorder. `queueRank` is a rating, not an ordinal (there is no position field).

---

## Blockers to clear before coding

These are **manual Airtable steps** — the API token cannot create single-select options
(this caused `INVALID_MULTIPLE_CHOICE_OPTIONS` on Team/Service Level previously).
Rhythm must do these by hand in base `appFEFygXo2pRc8AR`, table `tblhrRl8GzsDMv0DD`:

| # | Step | Needed for |
|---|------|-----------|
| ~~B1~~ | ~~New singleSelect "Date Certainty"~~ — **DONE 2026-08-27**, created via the Airtable connector as `fldq4jzPRveK5KkJz` (choices: Fixed launch / Target date / Evergreen). The connector can write schema even though the app's own token cannot create select options. | Phase 1 |
| B2 | Add `Web Page` to the existing **"Type of Request"** select (`fldlfaGYlYlTxNy1s`) | Phase 2 |
| B3 | Add a web option to **"Team/Service Level"** (`fldHGT2p5SObJEzPh`), e.g. `Web Team - Pages` | Phase 2 |
| B4 | New **URL field "Jira Link"** | Phase 2 |
| B5 | `OfficialCalendar` rows exist for Guilds, the accelerators, mv.com | Phase 4 |

Capture each new field ID and paste it into `lib/airtable/field-map.ts`.
B5 is an ops task for Moniek/Titus, not a code task.

---

## Phase 0 — Stop the two score writers fighting (do first, ~1h)

`tickets.priority_score` currently has **two writers that overwrite each other**:

- `lib/airtable/ticket-upsert.ts:48` writes the Airtable `SCORE` formula on every pull (every 5 min).
- `lib/tickets/score-service.ts#scoreTicketById` writes the app formula, via the
  "Recompute scores now" button in `/settings/scoring`.

Per the E9.5 as-built note, `priorityScore` is **meant** to mirror Airtable `SCORE` (which
already includes Event Revenue); the app's contribution is the blend computed on read in
`rankTickets`. So the recompute button actively corrupts the queue until the next pull.

**Change:**
- Delete the `prisma.ticket.update({ priorityScore })` write in `lib/tickets/score-service.ts`.
- Remove `recomputeScores` from `app/settings/scoring/actions.ts` and its button in
  `components/settings/ScoringConfigEditor.tsx`.
- Leave `scoreTicket` in `lib/tickets/scoring.ts` — Phase 1 reuses its helpers.

Also fix the **set-relative display score**: `rankTickets` min-max normalises across only the
currently loaded set, so the same ticket shows a different 0–100 on `/manager` vs
`/studio/ranking`. Replace the per-set min-max with a fixed divisor so one ticket has one
number everywhere — non-negotiable if the number is going to be argued over in a meeting.

---

## Phase 1 — Date reality (the answer to Fariz)

Every request declares whether its date is real. That flag damps or amplifies the
deadline term in the existing blend, so a "2-star launching Monday" outranks a
"5-star evergreen" automatically.

### Data
- `prisma/schema.prisma` → `Ticket.dateCertainty String? @map("date_certainty")`
  — values `fixed | target | evergreen`. Plain string; this schema has no enums.
- Migration runs via **`kessel db migrate`**, not `prisma migrate` — managed Postgres is
  only reachable through `kessel db`.
- `lib/airtable/field-map.ts` → add `dateCertainty` to `TICKETS.fields` plus a
  `certainty_` option-name map, following the existing `status_` / `format_` convention.

### Sync (a new synced field touches 5 places — all of them)
| File | Change |
|---|---|
| `lib/airtable/field-map.ts` | field ID + option map |
| `lib/airtable/ticket-upsert.ts` | read Airtable → PG |
| `lib/airtable/push-map.ts` (`ticketToAirtableFields`) | write PG → Airtable |
| `lib/airtable/push-registry.ts` (`TICKET_PUSH_SELECT`) | include the column |
| `lib/tickets/write.postgres.ts` + `write.airtable.ts` | accept on create and patch |

### Scoring
- `lib/scoring-config/config.ts` — add to `ScoringConfig` and `DEFAULTS`:
  `certaintyFactor: { fixed: 1.0, target: 0.6, evergreen: 0.15 }`.
- `lib/scoring-config/repository.ts` — register keys `certainty_fixed`, `certainty_target`,
  `certainty_evergreen` in the `G` map / `applyGlobalKnob`, group `Priority weights`, so they
  are admin-tunable at `/settings/scoring` like every other weight. These are **records** in
  the ⚙️ Scoring Config table, so the token can create them (unlike select options).
- `lib/tickets/scoring.ts` — add `certaintyFactor(dateCertainty, cfg)` and extend
  `blendQueueScore` to apply it to the due term only:
  ```
  scoreNorm + w.due * dueNorm * certaintyFactor + w.campaign * campaignNorm
  ```
  Campaign proximity is left alone — it already comes from a real `OfficialCalendar` window.
- **Legacy tickets default to `target` (0.6)**, so nothing regresses on rollout.
- Thread `dateCertainty` through `rankTickets` in `lib/tickets/data.postgres.ts`, its twin in
  `lib/tickets/data.airtable.ts`, and the `QueueTicket` type.

### UI
> Load the `artifact-design` skill and re-read `DESIGN_SYSTEM.md` before touching any
> component. Reuse `components/ui/*` primitives (`Field`, `Select`, `Badge`); no raw hex,
> no arbitrary Tailwind sizes.

- `components/intake/IntakeForm.tsx` — a **required** control beside Due date in the
  *Scheduling & Priority* section. The copy is the feature; it must teach:
  - **Fixed launch** — externally committed, cannot move.
  - **Target date** — we want it by then, it can move.
  - **Evergreen** — no real deadline.
- `components/tickets/QueueTable.tsx` —
  - new optional column `dateCertainty`, and a `Badge` on the due date in the Title cell;
  - **fix `priorityVal`**: it currently sorts on `Number(queueRank ?? priorityScore ?? 0)`,
    mixing a 1–5 rating with a 0–100 score in one axis. Sort ranked-vs-scored separately,
    matching what `rankTickets` already does server-side.
- Add a **score explainer** on the Priority cell — "ranked here because: fixed launch in
  4 days · mastery tier · 6 variants". This is what makes the rank arguable instead of
  mysterious, and it is the cheapest way to answer "why is my page below theirs".

### Files
`prisma/schema.prisma`, `lib/airtable/{field-map,ticket-upsert,push-map,push-registry}.ts`,
`lib/tickets/{scoring,data.postgres,data.airtable,write.postgres,write.airtable}.ts`,
`lib/scoring-config/{config,repository}.ts`, `app/intake/actions.ts`,
`components/intake/IntakeForm.tsx`, `components/tickets/QueueTable.tsx`.

---

## Phase 2 — Web page requests in the same queue

Fariz's work is invisible to the portal today. `Ticket.typeOfRequest` already exists as
`Video | Design`; this widens it rather than adding a model.

- After **B2/B3**, extend `TYPES_OF_REQUEST` and `TEAM_SERVICE_LEVELS` in
  `lib/intake/data.ts` (both are hardcoded arrays that must mirror the Airtable selects).
- **Reference data is an ops task, not code.** Fariz/Chee create web asset types in
  `tblLbcgob2Bxevugy` (Landing page, Upsell page, Checkout page…), each with:
  - `Category` populated — a blank `Category` silently hides an asset type from forms;
  - links to the relevant Event Types (this drives the intake filter);
  - preferred editor set, so `lib/tickets/auto-assign.ts` routes to them automatically.
  Then run a **reference reconcile** — prod is `REFERENCE_BACKEND=postgres`, so Airtable
  edits do not appear until `/api/sync/reference` runs.
- **Jira bridge, cheap version:** add `Ticket.jiraUrl String?` + field B4 + the same 5-file
  sync path. Abhishek gets his "who changed this and why" trail without leaving Jira, and we
  avoid building an integration nobody asked for.
- Every non-intake caller (`app/social/actions.ts`, `app/media/actions.ts`,
  `app/content-engine/actions.ts`) hardcodes `typeOfRequest: 'Video'` — leave them alone,
  they are video by definition.

**Gate:** do not ship the web option until Fariz has agreed to raise requests here.
Build it behind the existing pattern and demo it to him with his own work in it first.

---

## Phase 3 — One request → many tickets (revive E9.8)

This is Moniek's action item verbatim: *"one questionnaire they have to fill and then it will
create video, graphic design, web page design."* It was scoped as PRD **E9.8** and deferred in
June — un-defer it and resolve the two open questions:

- `prd/content-production-management/portal-feedback-round-1/multi-asset-requests.md`
  → status `deferred` becomes `discovery`.
- **Request group:** add `Ticket.requestGroupId String? @db.Uuid`, app-generated,
  **Postgres-only — not synced to Airtable**, so this needs no manual Airtable step.
  Grouping is a read concern and prod is Postgres system-of-record.
- **Partial failure:** create every row that validates, report per-row errors back to the
  form. All-or-nothing is not achievable across an Airtable-mirrored write anyway.
- `components/intake/IntakeForm.tsx` — "add another deliverable" rows under one shared
  Event Type / brief / CTA / campaign. Each row carries its own asset type (filtered by the
  shared event type), `typeOfRequest`, due date and `dateCertainty`.
- `app/intake/actions.ts` — a `createTicketBatch` wrapper looping the existing
  `createTicket`. **Do not fork `createTicket`** — it is the single chokepoint every surface
  goes through, and its validation and auto-assign must apply per row.

---

## Phase 4 — The initiative board (what the Monday call runs off)

`lib/studio/data.ts#getLaunches()` already groups active tickets in memory — but by
**Event Type**, which is a taxonomy axis, not a launch. Group by `OfficialCalendar` instead
and the row becomes the initiative.

- New `getInitiatives(active, recentShipped)` in `lib/studio/data.ts`, mirroring the shape of
  `getLaunches` / `launchSlug` / `launchTickets`.
- New route **`/priorities`** — one row per initiative; columns for **video / design / web**
  status derived from `typeOfRequest`; sorted by nearest *fixed* launch date (Phase 1 makes
  this meaningful). Drill-down reuses `QueueTable`.
- Visible to Manager, Executive and Stakeholder roles — the stakeholder view is
  read-only and unlimited by design, which is the point of not paying per seat.
- This is the surface that answers "I have the page but no ad assets", and it is what
  prevents the content team absorbing blame for a design or page blocker.

---

## Phase 5 — Brief gate + decision log

**Brief gate** — Fariz: *"It doesn't matter where the brief is. It matters that it's there."*
Today all validation is a hand-maintained tuple array (`REQUIRED`) in `app/intake/actions.ts`,
and the form has **no blocking client-side validation at all**.
- Make `REQUIRED` discipline-aware: web pages additionally require target URL and funnel
  position; video keeps the current set.
- Add matching client-side blocking in `IntakeForm.tsx`. Stay hand-rolled — there is no
  schema library in this repo and introducing one is out of scope.

**Decision log** — answers both Marishia chasing an already-deprioritised page and
Abhishek's audit need.
- `TicketEvent` exists and is written **only** on a `ticketStatus` change.
  Extend `lib/tickets/write.postgres.ts#updateTicket` to also log `prioStatus`, `queueRank`
  and `assigneeId` changes.
- **Nothing renders `TicketEvent` today.** Add a history panel to
  `app/tickets/[id]/page.tsx` (which currently says "Change history is tracked in the Airtable
  record revision history") and a "changed since last Monday" view on `/priorities`.

---

## Verification

Per phase:

1. `npx prisma generate` after each schema change; migration applied via
   `kessel db migrate <file.sql>` — **not** `prisma migrate` (no local `DATABASE_URL` to prod).
2. `npm run build` and `npm run lint` clean. No test runner is configured.
3. Local run with the Playwright dev-login harness (`ENABLE_DEV_LOGIN=true`), exercising each
   role: raise a request at `/intake/creative`, confirm it appears on `/manager`,
   `/studio/ranking` and `/stakeholder` with the **same** priority number (Phase 0 fix).
4. **Ranking sanity check** — the whole point of Phase 1. Note the test must use two
   **unranked** tickets: a manual star rank overrides the blend entirely, so any pair
   with stars set would compare ranks and never exercise certainty at all.
   Two unranked tickets, same due date, different certainty. Verified 2026-08-27
   against the real `blendQueueScore` (same raw SCORE of 50, due in 3 days):

   | certainty | blended |
   |---|---|
   | fixed | 0.950 |
   | target | 0.770 |
   | *null* (legacy) | 0.770 — identical to target, so no regression on deploy |
   | evergreen | 0.568 |

   And the case that matters: a **lower**-scoring committed launch (raw 40, fixed → 0.850)
   outranks a **higher**-scoring evergreen (raw 60, evergreen → 0.667).
5. **Sync round-trip** — after a write, check `/admin/sync` for outbox drain and no failures;
   confirm the new field landed on the Airtable record; edit it in Airtable and confirm the
   5-minute pull brings it back without clobbering the app value (echo-suppression is
   time-only, ~90s, so leave a gap between the two edits).
6. Deploy: **`kessel deploy` builds from git, not the working tree** — commit first. Env or
   secret changes only take effect after a new commit forces a rebuild.

---

## Build log

**Phase 0 — done (2026-08-27).** Deleted `lib/tickets/score-service.ts` (dead once the
`priorityScore` write went), removed the `recomputeScores` action and its button, and
corrected the misleading formula hint on the Priority weights panel. Replaced the per-set
min-max in `rankTickets` with a cached global score range (`getScoreRange`) via a new
shared `scoreNormFor` in `lib/tickets/scoring.ts`, so one ticket now shows one priority
number on every surface.

**Phase 1 — done (2026-08-27).** `Ticket.dateCertainty` + migration `0021`; Airtable field
created and mapped both directions (`certainty_` label map in `field-map.ts`, read in
`ticket-upsert.ts`, write in `push-map.ts` / `write.airtable.ts`, selected in
`push-registry.ts`); `certaintyFactor` scales the deadline term in `blendQueueScore`, with
three admin-tunable knobs (`certainty_fixed|target|evergreen`); required radio-card control
on the intake form; certainty-aware due chip + optional column in `QueueTable`. The three
non-intake ticket surfaces (social, clips, content-engine) pass `'target'` — organic work
has real intent but no external commitment.

Also shipped the **score explainer**: `explainQueueScore` composes a plain-language reason
("base score 62/100 · campaign window open · fixed launch, due in 3d"), ordered by what
actually moved the number, surfaced as the Priority cell's tooltip. A manually ranked
ticket says so instead, since the star overrides the computed order entirely.

**Not yet deployed.** Migration `0021` is written but NOT applied — it needs
`kessel db migrate` against the managed Postgres, and `kessel deploy` builds from git, so
the work has to be committed first.

**Rank scale — decided.** The Airtable rating field is max 10 while the app validated 1–5,
so a 6–10 set in Airtable could never be written back. Added `QUEUE_RANK_MAX = 10` and
widened the server action, the push guard and `StarRating`. Ten stars don't fit the old
120px Priority column, so that column is now 190px and the in-table control uses a new
`.st-starbtns.compact` variant.

## Open questions

- **Exact wording of the three certainty levels.** Worth putting in front of Fariz and Titus
  before building — the copy is what makes the field get used honestly rather than everyone
  selecting "Fixed launch".
- **Who maintains `OfficialCalendar`?** It is Airtable-owned reference data, read-only in the
  app. If nobody keeps Guilds / accelerators / mv.com current, Phase 4 renders empty rows.
  If this turns out to be nobody's job, revisit making it app-owned.
- **Does Fariz accept portal intake at all?** He said the location doesn't matter, only that
  the brief exists — but Phase 2 is wasted if his requests keep arriving by word of mouth.
  Phase 1 does not depend on this; Phases 2–4 do.
